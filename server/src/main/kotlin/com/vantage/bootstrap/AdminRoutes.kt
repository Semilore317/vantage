package com.vantage.bootstrap

import com.vantage.AppContext
import com.vantage.auth.verifyJwt
import com.vantage.db.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.update
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import java.util.UUID

fun Route.configureAdminRoutes() {
    route("/admin") {
        // Middleware to verify ADMIN role
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

            val config = AppContext.config
            val authHeader = call.request.header(HttpHeaders.Authorization) ?: ""
            val token = authHeader.removePrefix("Bearer ").trim()
            val payload = verifyJwt(token, config.jwtSecret)
            
            if (payload == null || payload.role != "ADMIN") {
                call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Admin privileges required"))
                finish()
                return@intercept
            }
            proceed()
        }

        post("/freeze/{accountId}") {
            val accountId = call.parameters["accountId"] ?: return@post call.respond(HttpStatusCode.BadRequest)
            
            val authHeader = call.request.header(HttpHeaders.Authorization) ?: ""
            val token = authHeader.removePrefix("Bearer ").trim()
            val payload = verifyJwt(token, AppContext.config.jwtSecret)!! // verified in interceptor

            PostgresDatabase.dbQuery {
                val updated = AccountStatesTable.update({ AccountStatesTable.accountId eq accountId }) {
                    it[this.isFrozen] = true
                    it[this.frozenById] = UUID.fromString(payload.sub)
                }
                if (updated == 0) {
                    AccountStatesTable.insert {
                        it[this.accountId] = accountId
                        it[this.isFrozen] = true
                        it[this.frozenById] = UUID.fromString(payload.sub)
                    }
                }
            }
            
            // Also update Memgraph for network visibility
            AppContext.memgraph.execute("MATCH (a:Account {id: $accountId}) SET a.isFrozen = true", mapOf("accountId" to accountId))

            call.respond(mapOf("status" to "success", "message" to "Account $accountId has been frozen"))
        }

        post("/history/{id}/false-positive") {
            val historyId = call.parameters["id"] ?: return@post call.respond(HttpStatusCode.BadRequest)
            
            PostgresDatabase.dbQuery {
                TransactionHistoryTable.update({ TransactionHistoryTable.id eq UUID.fromString(historyId) }) {
                    it[this.isFalsePositive] = true
                }
            }

            call.respond(mapOf("status" to "success", "message" to "Transaction marked as false positive"))
        }
    }
}
