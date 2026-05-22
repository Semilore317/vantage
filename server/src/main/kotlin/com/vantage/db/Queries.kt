package com.vantage.db

object Queries {

    fun createAccount() = """
        MERGE (a:Account {id: ${"$"}id})
        SET a.email = ${"$"}email, a.bvn = ${"$"}bvn, a.nin = ${"$"}nin,
            a.deviceFingerprint = ${"$"}deviceFingerprint, a.ipAddress = ${"$"}ipAddress,
            a.geoCity = ${"$"}geoCity, a.geoCountry = ${"$"}geoCountry,
            a.trustScore = COALESCE(a.trustScore, 0.5),
            a.isBlacklisted = COALESCE(a.isBlacklisted, false),
            a.createdAt = COALESCE(a.createdAt, datetime())
        RETURN a
    """.trimIndent()

    fun findAccountById() = "MATCH (a:Account {id: ${"$"}id}) RETURN a"

    fun findAccountByEmail() = "MATCH (a:Account {email: ${"$"}email}) RETURN a"

    fun updateTrustScore() = """
        MATCH (a:Account {id: ${"$"}id})
        SET a.trustScore = ${"$"}ts
        RETURN a
    """.trimIndent()

    fun flagAccount() = """
        MATCH (a:Account {id: ${"$"}id})
        SET a.isBlacklisted = true
        RETURN a
    """.trimIndent()

    fun unflagAccount() = """
        MATCH (a:Account {id: ${"$"}id})
        SET a.isBlacklisted = false
        RETURN a
    """.trimIndent()

    fun getFlaggedAccounts() = "MATCH (a:Account) WHERE a.isBlacklisted = true RETURN a"

    fun createCounterparty() = """
        MERGE (c:Counterparty {id: ${"$"}id})
        SET c.name = ${"$"}name, c.type = ${"$"}type, c.category = ${"$"}category,
            c.isBlacklisted = COALESCE(c.isBlacklisted, false),
            c.createdAt = COALESCE(c.createdAt, datetime())
        RETURN c
    """.trimIndent()

    fun findCounterpartyById() = "MATCH (c:Counterparty {id: ${"$"}id}) RETURN c"

    fun createTransaction() = """
        MATCH (a:Account {id: ${"$"}accountId})
        MATCH (c:Counterparty {id: ${"$"}counterpartyId})
        CREATE (a)-[:TRANSACTED_WITH {
            amount: ${"$"}amount, currency: ${"$"}currency,
            timestamp: datetime(${"$"}timestamp), transactionRef: ${"$"}transactionRef,
            sessionId: ${"$"}sessionId
        }]->(c)
    """.trimIndent()

    fun updateAccountTrust() = """
        MATCH (a:Account {id: ${"$"}id})
        SET a.trustScore = ${"$"}trustScore,
            a.tier = ${"$"}tier
    """.trimIndent()

    fun recentTransactions() = """
        MATCH (a:Account {id: ${"$"}id})-[t:TRANSACTED_WITH]->()
        RETURN t ORDER BY t.timestamp DESC LIMIT 20
    """.trimIndent()

    fun transactionCountInWindow() = """
        MATCH (a:Account {id: ${"$"}id})-[t:TRANSACTED_WITH]->()
        WHERE t.timestamp > datetime() - duration(${"$"}window)
        RETURN count(t) AS count
    """.trimIndent()

    fun pageRank() = """
        MATCH (a:Account)
        OPTIONAL MATCH (a)-[r:TRANSACTED_WITH]-()
        WITH a, count(r) AS totalDegree
        WITH collect({id: a.id, degree: totalDegree}) AS nodes, max(totalDegree) AS maxDegree
        UNWIND nodes AS n
        RETURN n.id AS id, CASE WHEN maxDegree > 0 THEN toFloat(n.degree) / maxDegree ELSE 0.0 END AS rank
    """.trimIndent()

    fun proximityToBlacklisted() = """
        MATCH path = shortestPath(
            (a:Account {id: ${"$"}id})-[:TRANSACTED_WITH*]-(c:Counterparty)
        )
        WHERE c.isBlacklisted
        RETURN length(path) AS distance
        LIMIT 1
    """.trimIndent()

    fun createAdminUser() = """
        CREATE (u:AdminUser {id: ${"$"}id, email: ${"$"}email, passwordHash: ${"$"}passwordHash, createdAt: datetime()})
        RETURN u
    """.trimIndent()

    fun findAdminByEmail() = "MATCH (u:AdminUser {email: ${"$"}email}) RETURN u"

    fun countAdminUsers() = "MATCH (u:AdminUser) RETURN count(u) AS count"

    fun updateAdminLogin() = """
        MATCH (u:AdminUser {id: ${"$"}id})
        SET u.lastLoginAt = datetime()
        RETURN u
    """.trimIndent()

    fun graphNetwork() = """
        MATCH (a:Account)
        WHERE ${"$"}search IS NULL 
           OR a.id = ${"$"}search 
           OR a.email = ${"$"}search 
           OR a.bvn = ${"$"}search
        WITH a
        LIMIT ${"$"}limit
        OPTIONAL MATCH (a)-[t:TRANSACTED_WITH]-(n)
        RETURN a, t, n
    """.trimIndent()

    fun findSuspiciousClusters() = """
        MATCH (a:Account)-[t:TRANSACTED_WITH]->(c:Counterparty)
        WITH c, count(DISTINCT a) as connectedAccounts, sum(t.amount) as totalVolume
        WHERE connectedAccounts > 5 AND totalVolume > 500000
        RETURN c.id as counterpartyId, c.name as name, connectedAccounts, totalVolume
    """.trimIndent()

    fun communityDetection() = """
        MATCH (a1:Account)-[:TRANSACTED_WITH]->(c:Counterparty)<-[:TRANSACTED_WITH]-(a2:Account)
        WHERE a1.id < a2.id
        RETURN a1.id as source, a1.isBlacklisted as sBlack, a2.id as target, a2.isBlacklisted as tBlack, c.id as community_id
    """.trimIndent()
    fun globalRecentTransactions() = """
        MATCH (a:Account)-[t:TRANSACTED_WITH]->(c:Counterparty)
        RETURN a.id AS accountId, t.amount AS amount, t.currency AS currency, 
               t.timestamp AS timestamp, t.transactionRef AS transactionRef, 
               c.id AS counterpartyId, a.trustScore AS trustScore
        ORDER BY t.timestamp DESC LIMIT 20
    """.trimIndent()
}
