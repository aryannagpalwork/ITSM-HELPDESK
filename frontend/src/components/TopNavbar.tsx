import React from 'react';
import { ThemeSelector } from '../shared/ThemeSelector';

/**
 * Global top navbar rendered on every authenticated page (inside each role
 * Layout). Hosts the global theme dropdown as a single, always-visible entry
 * point. Fully theme-token driven — no hardcoded colors.
 */
export const TopNavbar: React.FC<{ title?: string }> = ({ title }) => {
  return (
    <header
      className="shrink-0 h-14 flex items-center justify-between px-4 sm:px-6 z-30"
      style={{
        backgroundColor: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-[11px] font-mono uppercase tracking-widest truncate"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {title ?? 'ITSM Copilot'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeSelector />
      </div>
    </header>
  );
};
