import type { ReactNode } from 'react';

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`glass-panel ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">{children}</span>
        </div>
    );
}

