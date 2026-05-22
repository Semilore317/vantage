package com.vantage.bootstrap

import com.vantage.AppContext
import com.vantage.config.AppConfig
import com.vantage.db.MemgraphClient
import com.vantage.db.SchemaSetup
import com.vantage.service.SseService
import io.ktor.server.application.*
import kotlinx.coroutines.runBlocking

fun Application.configureStartup() {
    val appConfig = AppConfig(environment.config)
    val memgraph = MemgraphClient(
        appConfig.memgraphBoltUri,
        appConfig.memgraphUsername,
        appConfig.memgraphPassword
    )
    val sanitizedUri = appConfig.memgraphBoltUri.replace(Regex("//.*@"), "//******@")
    println("[Vantage] Initializing database connection to: $sanitizedUri")

    AppContext.config = appConfig
    AppContext.memgraph = memgraph
    
    // Initialize Postgres
    com.vantage.db.PostgresDatabase.init(appConfig)
    
    AppContext.sseService = SseService()
    AppContext.application = this

    monitor.subscribe(ApplicationStarted) {
        println("[Vantage] Server started. Running schema setup...")
        runBlocking {
            SchemaSetup(memgraph).run()
            
            // Seed admin user in Postgres if provided via environment
            val adminEmail = appConfig.adminEmail
            val adminPassword = appConfig.adminPassword
            if (adminEmail != null && adminPassword != null && com.vantage.db.UserRepository.findByEmail(adminEmail) == null) {
                println("[Vantage] Seeding initial admin user from environment: $adminEmail")
                com.vantage.db.UserRepository.create(
                    adminEmail,
                    com.vantage.auth.SecurityUtils.hashPassword(adminPassword),
                    "ADMIN"
                )
            }
        }
        AppContext.sseService.start(this, memgraph)
        AppContext.aiService = com.vantage.service.AiService()
        
        // Start Network Centrality Worker
        val networkWorker = com.vantage.service.NetworkAlertWorker(AppContext.sseService)
        networkWorker.start()

        // Start Dashboard Metrics Worker
        val metricsWorker = com.vantage.service.MetricsWorker(AppContext.sseService)
        metricsWorker.start()
        
        println("[Vantage] Ready on port ${environment.config.property("ktor.deployment.port").getString()}")
    }

    monitor.subscribe(ApplicationStopped) {
        println("[Vantage] Shutting down. Closing Memgraph connection...")
        memgraph.close()
        com.vantage.db.PostgresDatabase.close()
    }
}
