import React from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  valueClass?: string;
  sublabel?: React.ReactNode;
  loading?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onOpen?: () => void;
  openLabel?: string;
}

/**
 * Reusable, fully clickable KPI card. Body click drives the dashboard filter
 * (or a direct navigation when no `onOpen` is supplied); the hover-revealed
 * arrow deep-links to the filtered ticket view. Keyboard accessible.
 */
const KpiCardBase: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  valueClass = 'text-primary',
  sublabel,
  loading = false,
  isActive = false,
  onClick,
  onOpen,
  openLabel = 'Open filtered tickets',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group relative p-4 bg-card border rounded-xl transition-all cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${
        isActive ? 'border-token-strong ring-1 ring-accent/40' : 'border-token hover-border'
      }`}
    >
      <div className="flex justify-between items-start text-tertiary">
        <span className="text-[9px] font-mono uppercase">{label}</span>
        {icon}
      </div>
      <h2 className={`text-xl font-bold mt-1 ${valueClass}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-tertiary" /> : value}
      </h2>
      {sublabel && (
        <span className="text-[8px] font-mono text-tertiary block mt-1">{sublabel}</span>
      )}
      {onOpen && (
        <button
          type="button"
          aria-label={openLabel}
          title={openLabel}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="absolute bottom-2 right-2 p-1 rounded-md hover-elev text-tertiary hover-text opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export const KpiCard = React.memo(KpiCardBase);
