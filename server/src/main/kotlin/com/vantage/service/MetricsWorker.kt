package com.vantage.service

import com.vantage.AppContext
import com.vantage.db.Queries
import kotlinx.coroutines.*
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class MetricsWorker(private val sseService: SseService) {
    private val memgraph = AppContext.memgraph
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun start() {
        scope.launch {
            while (isActive) {
                try {
                    emitMetrics()
                } catch (e: Exception) {
                    println("[MetricsWorker] Error: ${e.message}")
                }
                delay(15000) // Every 15 seconds
            }
        }
    }

    private suspend fun emitMetrics() {
        val flaggedCount = memgraph.query(Queries.getFlaggedAccounts()).size
        // Simple counts for now
        val metrics = buildJsonObject {
            put("flaggedToday", flaggedCount)
            put("underWatch", (flaggedCount * 1.5).toInt()) // Mock ratio for "Under Watch"
            put("cleared", 0) 
            put("flaggedTrend", if (flaggedCount > 0) "+12%" else "0%")
        }.toString()
        
        sseService.emit("metrics", metrics)
    }

    fun stop() {
        scope.cancel()
    }
}
