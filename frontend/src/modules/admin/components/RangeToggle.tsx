import React from 'react';
import { TimelineRange } from '../../../shared/types';

interface RangeToggleProps {
  value: TimelineRange;
  onChange: (range: TimelineRange) => void;
}

const OPTIONS: { key: TimelineRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

/** Segmented control that selects the dashboard chart date range. */
const RangeToggleBase: React.FC<RangeToggleProps> = ({ value, onChange }) => {
  return (
    <div
      role="group"
      aria-label="Chart date range"
      className="flex items-center gap-1 bg-input border border-token rounded-lg p-0.5"
    >
      {OPTIONS.map(opt => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded-md transition-all ${
              active
                ? 'bg-accent-soft text-accent font-semibold'
                : 'text-tertiary hover-text'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export const RangeToggle = React.memo(RangeToggleBase);
