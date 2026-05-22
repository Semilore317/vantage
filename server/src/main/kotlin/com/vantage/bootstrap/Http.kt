package com.vantage.bootstrap

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.openapi.*
import io.ktor.server.plugins.swagger.*
import io.ktor.server.routing.*
fun Application.configureHttp() {
    install(CORS) {
        anyMethod()
        allowMethod(HttpMethod.Options)
        allowHeaders { true }
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Accept)
        allowHeader(HttpHeaders.CacheControl)
        allowHeader("X-Squad-Encrypted-Body")
        allowNonSimpleContentTypes = true
        anyHost()
    }
    routing {
        openAPI(path = "openapi") {}
        swaggerUI(path = "openapi") {}
    }
}
