import React from 'react';
import { AlertTriangle, Loader2, Inbox } from 'lucide-react';

interface ChartPanelProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wrapper around a chart that renders consistent loading / error / empty
 * states while preserving the dashboard's card styling.
 */
const ChartPanelBase: React.FC<ChartPanelProps> = ({
  title,
  description,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'No data available for the selected range.',
  actions,
  className = '',
  children,
}) => {
  return (
    <div className={`bg-card border border-token p-5 rounded-2xl ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-xs font-semibold text-primary">{title}</h3>
          {description && <p className="text-[10px] text-tertiary mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      <div className="h-64 mt-4">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[10px] text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-center max-w-xs">{error}</span>
          </div>
        ) : loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[10px] text-tertiary">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span>Loading metrics…</span>
          </div>
        ) : empty ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[10px] text-tertiary">
            <Inbox className="w-5 h-5" />
            <span className="text-center max-w-xs">{emptyMessage}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export const ChartPanel = React.memo(ChartPanelBase);
