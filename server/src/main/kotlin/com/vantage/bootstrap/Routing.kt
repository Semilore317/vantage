package com.vantage.bootstrap

import com.vantage.AppContext
import com.vantage.auth.handleLogin
import com.vantage.auth.verifyHmacSignature
import com.vantage.db.Queries
import com.vantage.service.TrustService
import com.vantage.model.Tier
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sse.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.add

fun Application.configureRouting() {
    install(SSE)
    routing {
        route("/api/v1") {
            post("/auth/login") {
                handleLogin(call)
            }
            configureAdminRoutes()
            configureApiRoutes()
        }
        post("/squad/webhook") {
            val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
            val trustService = TrustService()
            val memgraph = AppContext.memgraph
            val bodyText = call.receive<String>()
            val signature = call.request.header("X-Squad-Encrypted-Body")
            
            if (signature != null) {
                val secret = AppContext.config.squadSecretKey
                if (!com.vantage.auth.verifyHmacSignature(bodyText.toByteArray(), signature, secret)) {
                    call.respond(HttpStatusCode.Unauthorized, buildJsonObject { put("error", "Invalid HMAC signature") })
                    return@post
                }
            }

            val body = json.decodeFromString<Map<String, String>>(bodyText)
            val transactionRef = body["TransactionRef"] ?: body["transactionRef"] ?: "TX_${System.currentTimeMillis()}"
            val amount = body["amount"]?.toDoubleOrNull() ?: 0.0
            val accountId = body["email"] ?: "unknown"
            val counterpartyId = body["counterpartyId"] ?: "unknown_cp"
            val counterpartyName = body["counterpartyName"] ?: "Unknown Counterparty"
            val currency = body["currency"] ?: "NGN"
            val timestamp = body["timestamp"] ?: java.time.OffsetDateTime.now().toString()

            // 1. Persist to Graph
            memgraph.execute(Queries.createAccount(), mapOf(
                "id" to accountId,
                "email" to accountId,
                "bvn" to body["bvn"],
                "nin" to null,
                "deviceFingerprint" to null,
                "ipAddress" to body["ipAddress"],
                "geoCity" to null,
                "geoCountry" to null
            ))

            memgraph.execute(Queries.createCounterparty(), mapOf(
                "id" to counterpartyId,
                "name" to counterpartyName,
                "type" to "MERCHANT", // Default from seeder
                "category" to null
            ))

            memgraph.execute(Queries.createTransaction(), mapOf(
                "accountId" to accountId,
                "counterpartyId" to counterpartyId,
                "amount" to amount,
                "currency" to currency,
                "timestamp" to timestamp,
                "transactionRef" to transactionRef,
                "sessionId" to null
            ))

            // 2. Compute Trust Score
            val ts = trustService.compute(accountId)
            
            // 3. Persist Trust Score back to Graph
            memgraph.execute(Queries.updateAccountTrust(), mapOf(
                "id" to accountId,
                "trustScore" to ts.ts,
                "tier" to ts.tier.name
            ))

            // 4. Automated AI Analysis for High Risk
            if (ts.tier == Tier.CRITICAL || ts.tier == Tier.HIGH_RISK) {
                val explanation = AppContext.aiService.explain(ts)
                com.vantage.db.TransactionRepository.saveHistory(ts, explanation.summary, explanation.verdict)
            }
            
            // 3. Emit Enriched SSE Event
            val eventData = buildJsonObject {
                put("transactionRef", transactionRef)
                put("accountId", accountId)
                put("counterpartyId", counterpartyId)
                put("counterpartyName", counterpartyName)
                put("amount", amount)
                put("currency", currency)
                put("tier", ts.tier.name)
                put("trustScore", ts.ts)
                put("timestamp", timestamp)
            }.toString()
            
            AppContext.sseService.emit("transaction", eventData)
            
            if (ts.tier == Tier.CRITICAL) {
                val alertData = buildJsonObject {
                    put("id", java.util.UUID.randomUUID().toString())
                    put("severity", "critical")
                    put("title", "Critical Risk Detected")
                    put("description", "High-risk transaction detected for account $accountId. Automatic flagging triggered.")
                    put("accountId", accountId)
                    put("timestamp", "Just now")
                }.toString()
                AppContext.sseService.emit("alert", alertData)
            }
            
            call.respond(buildJsonObject {
                put("status", "processed")
                put("tier", ts.tier.name)
                put("transactionRef", transactionRef)
            })
        }
        get("/health") {
            call.respondText("""{"status":"ok","service":"vantage"}""", ContentType.Application.Json)
        }
    }
}
