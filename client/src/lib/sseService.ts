import type { Transaction, Alert } from "../types";

import { getToken } from "../services/auth";
import { store } from "../store/store";
import { addFlaggedAccount, removeFlaggedAccount } from "../store/flaggedSlice";
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

function secureRandom(): number {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] / 0x100000000;
}

function generateMockTransaction(): Transaction {
    const rand = secureRandom();
    let status: Transaction["status"] = "SAFE";
    if (rand > 0.85) status = "CRITICAL";
    else if (rand > 0.60) status = "HIGH_RISK";

    const cpName = ["Mainland", "Global Crypto", "Unknown Wallet", "Lagos Casino"][Math.floor(secureRandom() * 4)];
    const id1 = Math.floor(1000 + secureRandom() * 9000);
    const id2 = Math.floor(1000 + secureRandom() * 9000);
    const cId1 = Math.floor(1000 + secureRandom() * 9000);
    const cId2 = Math.floor(1000 + secureRandom() * 9000);

    return {
        id: crypto.randomUUID(),
        accountId: `ACC-${id1}-${id2}`,
        counterpartyId: `CP-${cId1}-${cId2}`,
        counterpartyName: cpName,
        name: cpName,
        amount: 50 + secureRandom() * 24950,
        currency: "NGN",
        timestamp: new Date().toISOString(),
        status,
        trustScore: Math.random()
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
                        let status: Transaction["status"] = data.tier as Transaction["status"];
                        if (!status) status = "SAFE";

                        onTransaction({
                            id: data.transactionRef || crypto.randomUUID(),
                            accountId: data.accountId,
                            counterpartyId: data.counterpartyId || `unknown-${crypto.randomUUID().slice(0, 4)}`,
                            counterpartyName: data.counterpartyName || data.counterpartyId || data.accountId,
                            name: data.accountId,
                            amount: data.amount,
                            currency: data.currency || "NGN",
                            timestamp: data.timestamp || new Date().toISOString(),
                            status,
                            trustScore: data.trustScore
                        });
                    } catch (err) {
                        console.error("Failed to parse transaction event", err);
                    }
                });

                eventSource.addEventListener("alert", (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        onAlert({
                            id: data.id || crypto.randomUUID(),
                            severity: data.severity || "critical",
                            title: data.title || `High Risk Activity: ${data.accountId}`,
                            description: data.description || "Suspicious behavior detected",
                            timestamp: data.timestamp || "Just now",
                            actions: [
                                { label: "Freeze", variant: "primary" },
                                { label: "Dismiss", variant: "ghost" }
                            ]
                        });
                    } catch (err) {
                        console.error("Failed to parse alert event", err);
                    }
                });

                eventSource.addEventListener("flag_update", (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.isBlacklisted) {
                            store.dispatch(addFlaggedAccount({
                                id: data.accountId,
                                isBlacklisted: true,
                                trustScore: data.trustScore || 0.1,
                                isFrozen: false,
                            }));
                        } else {
                            store.dispatch(removeFlaggedAccount(data.accountId));
                        }
                    } catch (err) {
                        console.error("Failed to parse flag_update event", err);
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
