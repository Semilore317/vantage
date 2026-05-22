package com.vantage.auth

import com.vantage.AppContext
import com.vantage.db.Queries
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import java.time.Instant
import java.util.*
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
private val b64: (ByteArray) -> String = Base64.getUrlEncoder().withoutPadding()::encodeToString

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(val token: String, val expiresIn: Long)

@Serializable
data class JwtPayload(val sub: String, val email: String, val role: String, val iat: Long, val exp: Long)

suspend fun handleLogin(call: ApplicationCall) {
    val config = AppContext.config
    val body = call.receive<LoginRequest>()
    val user = com.vantage.db.UserRepository.findByEmail(body.email)

    if (user == null || !SecurityUtils.verifyPassword(body.password, user.passwordHash)) {
        call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid credentials"))
        return
    }

    val userId = user.id
    // Update last login in Postgres if needed, or keep in Memgraph for network analysis
    // For now, let's stick to Postgres for user state

    val now = Instant.now().epochSecond
    val exp = now + 86400
    val payload = JwtPayload(sub = userId, email = body.email, role = user.role, iat = now, exp = exp)
    val token = createJwt(payload, config.jwtSecret)

    call.respond(LoginResponse(token = token, expiresIn = 86400))
}

suspend fun authenticateRequest(call: ApplicationCall): Boolean {
    val config = AppContext.config
    val header = call.request.header(HttpHeaders.Authorization)
    
    val token = if (header != null) {
        header.removePrefix("Bearer ").trim()
    } else {
        call.request.queryParameters["token"]
    } ?: return false

    if (token == config.apiKey) return true

    return verifyJwt(token, config.jwtSecret) != null
}

fun createJwt(payload: JwtPayload, secret: String): String {
    val header = """{"alg":"HS256","typ":"JWT"}"""
    val encodedHeader = b64(header.toByteArray())
    val encodedPayload = b64(json.encodeToString(JwtPayload.serializer(), payload).toByteArray())
    val signature = hmac256("$encodedHeader.$encodedPayload", secret)
    return "$encodedHeader.$encodedPayload.$signature"
}

fun verifyJwt(token: String, secret: String): JwtPayload? {
    val parts = token.split(".")
    if (parts.size != 3) return null
    val (encodedHeader, encodedPayload, signature) = parts

    val expectedSig = hmac256("$encodedHeader.$encodedPayload", secret)
    if (!MessageDigest.isEqual(signature.toByteArray(), expectedSig.toByteArray())) return null

    return try {
        val decoded = Base64.getUrlDecoder().decode(encodedPayload)
        val payload = json.decodeFromString(JwtPayload.serializer(), decoded.decodeToString())
        if (payload.exp < Instant.now().epochSecond) null else payload
    } catch (_: Exception) { null }
}

private fun hmac256(data: String, secret: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
    return b64(mac.doFinal(data.toByteArray()))
}

fun sha256(input: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
}
