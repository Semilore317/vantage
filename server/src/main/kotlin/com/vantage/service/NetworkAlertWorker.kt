package com.vantage.service

import com.vantage.AppContext
import com.vantage.db.Queries
import kotlinx.coroutines.*
import java.util.concurrent.Executors

class NetworkAlertWorker(private val sseService: SseService) {
    private val memgraph = AppContext.memgraph
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val executor = Executors.newSingleThreadScheduledExecutor()

    fun start() {
        scope.launch {
            while (isActive) {
                try {
                    checkCentrality()
                    checkLargeTransactions()
                    checkSuspiciousClusters()
                    detectFraudRings()
                } catch (e: Exception) {
                    println("[NetworkAlertWorker] Error in alert worker: ${e.message}")
                }
                delay(30000) // Increase frequency to 30s
            }
        }
    }

    private suspend fun checkCentrality() {
        val results = memgraph.query(Queries.pageRank())
        results.forEach { row ->
            val id = row["id"] as? String ?: return@forEach
            val rank = (row["rank"] as? Number)?.toDouble() ?: 0.0
            
            // Refined: Use degree as well if possible, or just rank
            if (rank > 0.85) { 
                triggerAlert(id, "Critical Network Centrality", "Account $id has a network rank of ${"%.2f".format(rank)}. Potential fraud hub or high-risk node identified.", "critical")
            } else if (rank > 0.6) {
                triggerAlert(id, "Large Network Identification", "Account $id is connected to a large volume of counterparties. Recommend closer monitoring.", "warning")
            }
        }
    }

    private suspend fun checkLargeTransactions() {
        val results = memgraph.query(Queries.globalRecentTransactions())
        results.forEach { row ->
            val amount = (row["amount"] as? Number)?.toDouble() ?: 0.0
            val accountId = row["accountId"] as? String ?: return@forEach
            
            if (amount > 1000000.0) { // Large amount involvement
                triggerAlert(accountId, "Large Amount Involvement", "Account $accountId involved in a transaction of ${"%.2f".format(amount)}. High-value transaction alert.", "warning")
            }
        }
    }

    private suspend fun checkSuspiciousClusters() {
        val results = memgraph.query(Queries.findSuspiciousClusters())
        results.forEach { row ->
            val cpId = row["counterpartyId"] as? String ?: return@forEach
            val name = row["name"] as? String ?: "Unknown"
            val count = (row["connectedAccounts"] as? Number)?.toLong() ?: 0L
            val volume = (row["totalVolume"] as? Number)?.toDouble() ?: 0.0
            
            triggerAlert(cpId, "Suspicious Cluster Detected", "Counterparty '$name' ($cpId) is being used by $count accounts with a total volume of ${"%.2f".format(volume)}. Potential Sybil attack or fraud ring hub.", "critical")
        }
    }

    private suspend fun detectFraudRings() {
        val results = memgraph.query(Queries.communityDetection())
        val clusters = results.groupBy { it["community_id"] as? String ?: "" }
        
        clusters.forEach { (cpId, pairs) ->
            if (cpId.isEmpty()) return@forEach
            
            val accountIds = pairs.flatMap { listOf(it["source"] as String, it["target"] as String) }.toSet()
            val anyBlacklisted = pairs.any { (it["sBlack"] as? Boolean) == true || (it["tBlack"] as? Boolean) == true }
            
            if (anyBlacklisted) {
                accountIds.forEach { id ->
                    triggerAlert(id, "Fraud Ring Association", "Account $id is linked via shared counterparty ($cpId) to a known fraudulent entity. High community risk detected.", "critical")
                }
            } else if (accountIds.size > 5) {
                accountIds.forEach { id ->
                    triggerAlert(id, "High Density Cluster", "Account $id is part of a suspicious cluster of ${accountIds.size} accounts sharing counterparty $cpId.", "warning")
                }
            }
        }
    }

    private fun triggerAlert(accountId: String, title: String, description: String, severity: String) {
        sseService.emitAlert(
            severity = severity,
            title = title,
            description = description,
            accountId = accountId
        )
    }

    fun stop() {
        scope.cancel()
        executor.shutdown()
    }
}
