import type { ReactNode } from 'react';

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`glass-panel ${className}`}>{children}</div>;
}

export function SectionTitle({
    children,
    right,
}: {
    children: ReactNode;
    right?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-[#95c11f]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    {children}
                </span>
            </div>
            {right}
        </div>
    );
}
