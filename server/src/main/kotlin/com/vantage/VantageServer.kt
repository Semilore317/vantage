package com.vantage

import com.vantage.config.AppConfig
import com.vantage.db.MemgraphClient
import com.vantage.service.SseService

import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

object AppContext {
    lateinit var application: Application
    lateinit var config: AppConfig
    lateinit var memgraph: MemgraphClient
    lateinit var sseService: SseService
    lateinit var aiService: com.vantage.service.AiService
}
