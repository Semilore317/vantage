import { useAppSelector } from "../../store/hooks";
import LiveFeedPanel from "../../components/LiveFeedPanel";
import AlertPanel from "../../components/AlertPanel";
import MetricCard from "../../components/MetricCard";
import { CheckCircle2 } from "lucide-react";

const Dashboard = () => {
    const metrics = useAppSelector((state) => state.dashboard.metrics);

    return (
        <div className="flex h-full gap-(--spacing-lg)">
            {/* Left Column */}
            <div className="w-[60%] h-full flex flex-col">
                <LiveFeedPanel />
            </div>

            {/* Right Column — fixed height, only alert list scrolls */}
            <div className="w-[40%] h-full flex flex-col gap-(--spacing-lg) overflow-hidden">
                
                {/* Metrics — pinned, never scrolls */}
                <div className="grid grid-cols-2 gap-4 shrink-0">
                    <div className="col-span-2">
                        <MetricCard 
                            label="FLAGGED TODAY" 
                            value={metrics.flagged} 
                            delta={metrics.flaggedDelta} 
                            deltaPositive={false}
                            accentColor="var(--color-status-danger)"
                        >
                            <div className="w-full max-w-30 h-1 bg-bg-raised rounded-full overflow-hidden self-end mb-1">
                                <div className="h-full w-[65%] bg-status-danger" />
                            </div>
                        </MetricCard>
                    </div>
                    <MetricCard 
                        label="UNDER WATCH" 
                        value={new Intl.NumberFormat().format(metrics.watch)} 
                        accentColor="var(--color-status-warning)"
                    />
                    <MetricCard 
                        label="CLEARED" 
                        value={new Intl.NumberFormat().format(metrics.cleared)} 
                        accentColor="var(--color-status-safe)"
                    >
                        <CheckCircle2 size={16} color="var(--color-status-safe)" />
                    </MetricCard>
                </div>

                {/* Alerts — this section alone scrolls */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <AlertPanel />
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
