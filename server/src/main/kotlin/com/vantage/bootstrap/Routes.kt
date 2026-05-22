package com.vantage.bootstrap

import com.vantage.AppContext
import com.vantage.auth.authenticateRequest
import com.vantage.auth.handleLogin
import com.vantage.db.Queries
import com.vantage.enrichment.GeoIpService
import com.vantage.model.*
import com.vantage.service.AiService
import com.vantage.service.SquadClient
import com.vantage.service.TrustService
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sse.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import org.jetbrains.exposed.sql.selectAll

@Suppress("DEPRECATION")
fun Route.configureApiRoutes() {
    intercept(ApplicationCallPipeline.Call) {
        if (call.request.httpMethod == HttpMethod.Options) {
            proceed()
            return@intercept
        }
        val path = call.request.uri.substringBefore('?')
        if (path.endsWith("/login")) {
            proceed()
            return@intercept
        }
        if (!authenticateRequest(call)) {
            call.respond(HttpStatusCode.Unauthorized, buildJsonObject { put("error", "Unauthorized") })
            return@intercept
        }
        proceed()
    }
    val memgraph = AppContext.memgraph
    val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    val trustService = TrustService()
    val squadClient = SquadClient()
    val geoIpService = GeoIpService()

    post("/ingest/account") {
        val req = call.receive<AccountCreateRequest>()
        var geoCity: String? = null
        var geoCountry: String? = null
        if (req.ipAddress != null) {
            val geo = geoIpService.lookup(req.ipAddress)
            if (geo != null) {
                geoCity = geo.city
                geoCountry = geo.country
            }
        }
        memgraph.execute(Queries.createAccount(), mapOf<String, Any?>(
            "id" to req.id,
            "email" to req.email,
            "bvn" to req.bvn,
            "nin" to req.nin,
            "deviceFingerprint" to req.deviceFingerprint,
            "ipAddress" to req.ipAddress,
            "geoCity" to geoCity,
            "geoCountry" to geoCountry
        ))
        call.respond(HttpStatusCode.Created, buildJsonObject {
            put("status", "created")
            put("id", req.id)
        })
    }

    post("/ingest/transaction") {
        val req = call.receive<TransactionCreateRequest>()
        val account = memgraph.readSingle(Queries.findAccountById(), mapOf("id" to req.accountId))
        if (account == null) {
            call.respond(HttpStatusCode.NotFound, buildJsonObject { put("error", "Account not found") })
            return@post
        }
        memgraph.readSingle(Queries.findCounterpartyById(), mapOf("id" to req.counterpartyId))
            ?: memgraph.execute(Queries.createCounterparty(), mapOf<String, Any?>(
                "id" to req.counterpartyId,
                "name" to null,
                "type" to req.counterpartyType.name,
                "category" to null
            ))
        val ts = req.timestamp ?: "NOW()"
        memgraph.execute(Queries.createTransaction(), mapOf<String, Any?>(
            "accountId" to req.accountId,
            "counterpartyId" to req.counterpartyId,
            "amount" to req.amount,
            "currency" to req.currency,
            "timestamp" to ts,
            "transactionRef" to req.transactionRef,
            "sessionId" to req.sessionId
        ))
        trustService.compute(req.accountId)
        call.respond(HttpStatusCode.Created, buildJsonObject {
            put("status", "created")
            put("transactionRef", req.transactionRef)
        })
    }

    get("/trust/{accountId}") {
        try {
            val accountId = call.parameters["accountId"] ?: return@get
            val account = memgraph.readSingle(Queries.findAccountById(), mapOf("id" to accountId))
            if (account == null) {
                call.respond(HttpStatusCode.NotFound, buildJsonObject { put("error", "Account not found") })
                return@get
            }
            val ts = trustService.compute(accountId)
            val explanation = AppContext.aiService.explain(ts)
            
            // Save the explanation to history - Wrapped to prevent blocking
            try {
                com.vantage.db.TransactionRepository.saveHistory(ts, explanation.summary, explanation.verdict)
            } catch (e: Exception) {
                println("[Routes] Failed to save history to Postgres: ${e.message}")
            }
            
            val result = ts.copy(explanation = explanation)
            call.respondText(json.encodeToString(result), ContentType.Application.Json)
        } catch (e: Exception) {
            println("[Routes] Forensic analysis failed: ${e.message}")
            e.printStackTrace()
            call.respond(HttpStatusCode.InternalServerError, buildJsonObject {
                put("error", e.message ?: "Internal forensic analysis failure")
                put("exception", e.javaClass.simpleName)
            })
        }
    }

    post("/audit/proof-of-life") {
        val body = call.receive<Map<String, String>>()
        val accountId = body["accountId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, buildJsonObject { put("error", "accountId required") })
            return@post
        }
        val account = memgraph.readSingle(Queries.findAccountById(), mapOf("id" to accountId))
        if (account == null) {
            call.respond(HttpStatusCode.NotFound, buildJsonObject { put("error", "Account not found") })
            return@post
        }
        val ts = trustService.compute(accountId)
        val explanation = AppContext.aiService.explain(ts)
        val response = buildJsonObject {
            put("accountId", accountId)
            put("trustScore", ts.ts)
            put("tier", ts.tier.name)
            put("verdict", explanation.verdict)
            put("summary", explanation.summary)
            putJsonArray("riskFactors") {
                explanation.riskFactors.forEach { add(it) }
            }
            put("recommendedAction", explanation.recommendedAction)
        }
        call.respondText(response.toString(), ContentType.Application.Json)
    }

    get("/status/{transactionRef}") {
        val transactionRef = call.parameters["transactionRef"] ?: return@get
        val squadVerification = squadClient.verifyTransaction(transactionRef)
        call.respondText(json.encodeToString(mapOf(
            "transactionRef" to transactionRef,
            "squadVerification" to (squadVerification?.let { mapOf(
                "status" to it.status,
                "success" to it.success,
                "message" to it.message,
                "data" to it.data
            ) } ?: "not found"),
            "vantage" to "ok"
        )), ContentType.Application.Json)
    }

    post("/admin/flag/{id}") {
        val id = call.parameters["id"] ?: return@post
        memgraph.execute(Queries.flagAccount(), mapOf("id" to id))
        val flagData = buildJsonObject {
            put("accountId", id)
            put("isBlacklisted", true)
            put("reason", "Admin flagged")
        }.toString()
        AppContext.sseService.emit("flag_update", flagData)
        call.respond(buildJsonObject {
            put("status", "flagged")
            put("id", id)
        })
    }

    post("/admin/unflag/{id}") {
        val id = call.parameters["id"] ?: return@post
        memgraph.execute(Queries.unflagAccount(), mapOf("id" to id))
        val flagData = buildJsonObject {
            put("accountId", id)
            put("isBlacklisted", false)
            put("reason", "Admin unflagged")
        }.toString()
        AppContext.sseService.emit("flag_update", flagData)
        call.respond(buildJsonObject {
            put("status", "unflagged")
            put("id", id)
        })
    }

    get("/admin/flagged") {
        val results = memgraph.query(Queries.getFlaggedAccounts())
        val accounts = results.mapNotNull { row ->
            val node = row["a"] as? Map<*, *>
            node?.let {
                val id = it["id"] as? String ?: ""
                
                // Fetch state from Postgres using repository
                val state = com.vantage.db.TransactionRepository.getAccountState(id)

                Account(
                    id = id,
                    email = it["email"] as? String,
                    isBlacklisted = it["isBlacklisted"] as? Boolean ?: false,
                    trustScore = (it["trustScore"] as? Number)?.toDouble() ?: 0.5,
                    lastSeen = state?.get(com.vantage.db.AccountStatesTable.lastSeen)?.toString(),
                    isFrozen = state?.get(com.vantage.db.AccountStatesTable.isFrozen) ?: false,
                    latestRecommendation = state?.get(com.vantage.db.AccountStatesTable.latestRecommendation)
                )
            }
        }
        call.respondText(json.encodeToString(accounts), ContentType.Application.Json)
    }


    post("/admin/import/accounts") {
        val req = call.receive<BatchImportRequest>()
        var imported = 0
        for (acct in req.accounts) {
            memgraph.execute(Queries.createAccount(), mapOf<String, Any?>(
                "id" to acct.id,
                "email" to acct.email,
                "bvn" to acct.bvn,
                "nin" to acct.nin,
                "deviceFingerprint" to acct.deviceFingerprint,
                "ipAddress" to acct.ipAddress,
                "geoCity" to null,
                "geoCountry" to null
            ))
            imported++
        }
        call.respond(buildJsonObject {
            put("status", "imported")
            put("count", imported)
        })
    }

    get("/graph/network") {
        val search = call.request.queryParameters["search"] ?: call.request.queryParameters["accountId"]
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 100
        val results = memgraph.query(Queries.graphNetwork(), mapOf("search" to search, "limit" to limit))
        val nodes = mutableListOf<kotlinx.serialization.json.JsonObject>()
        val edges = mutableListOf<kotlinx.serialization.json.JsonObject>()
        for (row in results) {
            val a = row["a"] as? Map<*, *>
            val t = row["t"] as? Map<*, *>
            val n = row["n"] as? Map<*, *>
            if (a != null) {
                nodes.add(buildJsonObject {
                    put("id", a["id"] as? String ?: "")
                    put("type", "Account")
                    put("trustScore", (a["trustScore"] as? Number)?.toDouble() ?: 0.5)
                    put("isBlacklisted", a["isBlacklisted"] as? Boolean ?: false)
                })
            }
            if (n != null) {
                val labels = n["__labels"] as? List<*> ?: emptyList<Any>()
                val type = if (labels.contains("Account")) "Account" else "Counterparty"
                nodes.add(buildJsonObject {
                    put("id", n["id"] as? String ?: "")
                    put("type", type)
                    put("name", n["name"] as? String ?: "")
                    put("isBlacklisted", n["isBlacklisted"] as? Boolean ?: false)
                })
            }
            if (t != null && a != null && n != null) {
                edges.add(buildJsonObject {
                    put("source", a["id"] as? String ?: "")
                    put("target", n["id"] as? String ?: "")
                    put("amount", (t["amount"] as? Number)?.toDouble() ?: 0.0)
                    put("currency", t["currency"] as? String ?: "NGN")
                })
            }
        }
        call.respondText(json.encodeToString(mapOf("nodes" to nodes, "edges" to edges)), ContentType.Application.Json)
    }

    sse("/events") {
        val sseService = AppContext.sseService
        sseService.events.collect { event ->
            send(event = event.event, data = event.data)
        }
    }
}
