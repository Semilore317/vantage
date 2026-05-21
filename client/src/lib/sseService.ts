import type { Transaction, Alert } from "../types";

import { getToken } from "../services/auth";
import { store } from "../store/store";
// We will create this slice next
import { setStreamStatus } from "../store/dashboardSlice";

const USE_MOCK_STREAM = import.meta.env.VITE_USE_MOCK_STREAM === 'true';

interface SSEService {
    start: (onTransaction: (t: Transaction) => void, onAlert: (a: Alert) => void) => void;
    stop: () => void;
}

let mockInterval: ReturnType<typeof setInterval> | null = null;
let eventSource: EventSource | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// No hard limit — use exponential backoff, capped at 30s
const MAX_BACKOFF_MS = 30_000;

function getBackoffMs(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
}


const NAMES = ["Adeyemi", "Okonkwo", "Ibrahim", "Mensah", "Diallo", "Eze", "Osei"];

function generateMockTransaction(): Transaction {
    const rand = Math.random();
    let status: Transaction["status"] = "SAFE";
    if (rand > 0.85) status = "CRITICAL";
    else if (rand > 0.60) status = "HIGH_RISK";

    const name = ["J.", "B.", "T.", "A.", "M.", "O.", "C."][Math.floor(Math.random() * 7)] + " " + NAMES[Math.floor(Math.random() * NAMES.length)];
    const id1 = Math.floor(1000 + Math.random() * 9000);
    const id2 = Math.floor(1000 + Math.random() * 9000);
    const cId1 = Math.floor(1000 + Math.random() * 9000);
    const cId2 = Math.floor(1000 + Math.random() * 9000);

    return {
        id: crypto.randomUUID(),
        name,
        accountId: `${id1}-****-${id2}`,
        counterpartyId: `C-${cId1}-****-${cId2}`,
        amount: 50 + Math.random() * 24950,
        timestamp: new Date().toISOString(),
        status
    };
}

export const sseService: SSEService = {
    start: (onTransaction, onAlert) => {
        store.dispatch(setStreamStatus("connecting"));

        if (USE_MOCK_STREAM) {
            // Mock Mode
            let isFirst = true;
            mockInterval = setInterval(() => {
                if (isFirst) {
                    store.dispatch(setStreamStatus("live"));
                    isFirst = false;
                }
                onTransaction(generateMockTransaction());
            }, 1500);
        } else {
            // Real Mode
            const connect = () => {
                const token = getToken();
                if (!token) {
                    store.dispatch(setStreamStatus("offline"));
                    return;
                }

                const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
                eventSource = new EventSource(`${baseUrl}/api/v1/events?token=${token}`);

                eventSource.onopen = () => {
                    store.dispatch(setStreamStatus("live"));
                    reconnectAttempts = 0;
                };

                eventSource.addEventListener("transaction", (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        // Ktor sends: accountId, amount, tier
                        let status: Transaction["status"] = data.tier as Transaction["status"];
                        if (!status) status = "SAFE";

                        onTransaction({
                            id: crypto.randomUUID(),
                            name: data.accountId,       // use full accountId as name
                            accountId: data.accountId,  // full id for graph linking
                            counterpartyId: data.counterpartyId || `unknown-${crypto.randomUUID().slice(0,4)}`,
                            amount: data.amount,
                            timestamp: new Date().toISOString(),
                            status
                        });
                    } catch (err) {
                        console.error("Failed to parse transaction event", err);
                    }
                });

                eventSource.addEventListener("alert", (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        // Ktor sends: accountId, tier, ts, riskFactors
                        onAlert({
                            id: crypto.randomUUID(),
                            severity: "critical",
                            title: `High Risk Activity: ${data.accountId}`,
                            description: data.riskFactors?.[0] || "Suspicious behavior detected",
                            timestamp: "Just now",
                            actions: [
                                { label: "Freeze", variant: "primary" },
                                { label: "Dismiss", variant: "ghost" }
                            ]
                        });
                    } catch (err) {
                        console.error("Failed to parse alert event", err);
                    }
                });

                eventSource.onerror = () => {
                    eventSource?.close();
                    eventSource = null;
                    store.dispatch(setStreamStatus("reconnecting"));
                    const delay = getBackoffMs(reconnectAttempts);
                    reconnectAttempts++;
                    reconnectTimer = setTimeout(connect, delay);
                };
            };

            connect();
        }
    },
    stop: () => {
        if (mockInterval) {
            clearInterval(mockInterval);
            mockInterval = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        reconnectAttempts = 0;
        store.dispatch(setStreamStatus("offline"));
    }
};

// Also export stopSSE as a standalone function for auth.ts logout
export const stopSSE = () => sseService.stop();
