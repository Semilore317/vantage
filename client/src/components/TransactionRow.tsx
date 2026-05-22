import type { Transaction } from "../types";
import AccountChip from "./AccountChip";
import StatusBadge from "./StatusBadge";
import { useEffect, useState } from "react";

interface TransactionRowProps {
    transaction: Transaction;
    isNew?: boolean;
}

const TransactionRow = ({ transaction, isNew }: TransactionRowProps) => {
    const [animateClass, setAnimateClass] = useState(isNew ? "opacity-0 -translate-y-4" : "");

    useEffect(() => {
        if (isNew) {
            // Trigger animation after mount
            const timer = requestAnimationFrame(() => {
                setAnimateClass("opacity-100 translate-y-0 transition-all duration-300 ease-out");
            });
            return () => cancelAnimationFrame(timer);
        }
    }, [isNew]);

    const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: transaction.currency || "NGN",
        minimumFractionDigits: 2,
    }).format(transaction.amount);

    // Extract HH:MM:SS UTC
    const dateObj = new Date(transaction.timestamp);
    const timeString = `${dateObj.getUTCHours().toString().padStart(2, '0')}:${dateObj.getUTCMinutes().toString().padStart(2, '0')}:${dateObj.getUTCSeconds().toString().padStart(2, '0')} UTC`;

    return (
        <div
            className={`flex items-center justify-between p-[var(--spacing-md)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-raised)] border-b border-[var(--color-border-subtle)] transition-colors ${animateClass}`}
        >
            <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                    <AccountChip 
                        name={transaction.counterpartyName || transaction.name || transaction.counterpartyId || transaction.accountId} 
                        accountId={transaction.accountId} 
                    />
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-2">
                        Ref: {transaction.id.substring(0, 12)}...
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-6 shrink-0 ml-4">
                <div className="flex flex-col items-end text-right">
                    <span className="text-[var(--font-size-subheading)] font-medium text-[var(--color-text-primary)]">
                        {formattedAmount}
                    </span>
                    <span className="text-[var(--font-size-caption)] text-[var(--color-text-muted)] font-mono">
                        {timeString}
                    </span>
                </div>
                
                <div className="w-24 flex justify-end">
                    <StatusBadge status={transaction.status} />
                </div>
            </div>
        </div>
    );
};

export default TransactionRow;
