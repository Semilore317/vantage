import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { incomingTransaction, incomingAlert } from "../store/dashboardSlice";
import { sseService } from "../lib/sseService";
import VerdictModal from "./VerdictModal";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { LayoutDashboard, Network, ShieldAlert, Clock, BarChart3 } from "lucide-react";
import type { AuthUser } from "../store/authSlice";


interface AppShellProps {
    children: ReactNode;
}

function getInitial(user: AuthUser | null): string {
    if (!user) return "?";
    if (user.name) return user.name.charAt(0).toUpperCase();
    return user.email.charAt(0).toUpperCase();
}

function getDisplayName(user: AuthUser | null): string {
    if (!user) return "";
    return user.name ?? user.email;
}

const AppShell = ({ children }: AppShellProps) => {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.auth?.user ?? null);

    useEffect(() => {
        sseService.start(
            (t) => dispatch(incomingTransaction(t)),
            (a) => dispatch(incomingAlert(a))
        );
        return () => sseService.stop();
    }, [dispatch]);

    return (
        <div className="flex h-screen w-full bg-bg-canvas text-text-primary font-sans">
            {/* Sidebar */}
            <aside className="w-(--width-sidebar) shrink-0 h-full bg-bg-surface border-r border-border-subtle flex flex-col">
                <div className="pt-8 pb-4 px-6 flex flex-col">
                    <span className="font-bold tracking-wide text-text-primary">VANTAGE</span>
                    <span className="text-(length:--font-size-caption) text-text-muted mt-0.5">Fraud Intelligence</span>
                </div>
                
                <nav className="flex-1 py-6 flex flex-col gap-1 px-3">
                    <NavLink to="/dashboard" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-bg-canvas'}`}>
                        <LayoutDashboard size={18} />
                        <span className="text-(length:--font-size-body)">Dashboard</span>
                    </NavLink>
                    <NavLink to="/network-forensic" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-bg-canvas'}`}>
                        <Network size={18} />
                        <span className="text-(length:--font-size-body)">Network Forensic</span>
                    </NavLink>

                    <NavLink to="/flagged-accounts" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-bg-canvas'}`}>
                        <ShieldAlert size={18} />
                        <span className="text-(length:--font-size-body)">Flagged Accounts</span>
                    </NavLink>

                    <div className="h-px bg-border-subtle my-2 mx-3" />

                    <NavLink to="/history" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-bg-canvas'}`}>
                        <Clock size={18} />
                        <span className="text-(length:--font-size-body)">History</span>
                    </NavLink>
                    <NavLink to="/analytics" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-bg-canvas'}`}>
                        <BarChart3 size={18} />
                        <span className="text-(length:--font-size-body)">Analytics</span>
                    </NavLink>
                </nav>

                <div className="p-3 mt-auto border-t border-border-subtle flex items-center gap-2.5 cursor-pointer hover:bg-bg-raised transition-colors rounded-b-sm">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-semibold select-none"
                        style={{ background: 'linear-gradient(135deg, var(--color-accent), #7c3aed)', fontSize: '0.8125rem' }}
                    >
                        {getInitial(user)}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-(length:--font-size-label) font-medium text-text-primary truncate leading-tight">{getDisplayName(user)}</span>
                        <span className="text-[0.625rem] text-text-muted truncate leading-tight">{user?.email ?? ''}</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Topbar */}
                <header className="h-(--height-topbar) shrink-0 bg-bg-surface border-b border-border-subtle flex items-center justify-end px-6">
                    {/* Real-time status removed per request */}
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-hidden p-(--spacing-lg)">
                    {children}
                </main>
            </div>

            {/* Global Verdict Modal — rendered above everything, available on every route */}
            <VerdictModal />
        </div>
    );
};

export default AppShell;
