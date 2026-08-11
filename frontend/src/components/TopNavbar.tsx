import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCircle2 } from 'lucide-react';
import { useApp } from '../shared/AppContext';
import { ThemeSelector } from '../shared/ThemeSelector';
import { NotificationCenter } from './NotificationCenter';

/**
 * Global top navbar rendered on every authenticated page (inside each role
 * Layout). Hosts the global theme dropdown as a single, always-visible entry
 * point. Fully theme-token driven — no hardcoded colors.
 */
export const TopNavbar: React.FC<{ title?: string }> = ({ title }) => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const getOverviewPath = () => {
    switch (currentUser.role) {
      case 'Administrator': return '/admin/dashboard';
      case 'Agent': return '/agent/dashboard';
      case 'Employee': return '/employee/dashboard';
      default: return '/agent/dashboard';
    }
  };

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
        {currentUser.role !== 'Administrator' && <NotificationCenter />}
        <ThemeSelector />
        <button
          type="button"
          onClick={() => navigate(getOverviewPath())}
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all hover:shadow-md group cursor-pointer"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.boxShadow = '0 4px 12px -2px var(--accent-primary), 0 0 0 1px var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary-bg)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-strong)',
            }}
          >
            <UserCircle2 className="w-4.5 h-4.5" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold truncate max-w-32 leading-tight">{currentUser.name || 'Profile'}</div>
            <div className="text-[9px] font-mono uppercase tracking-wider leading-tight" style={{ color: 'var(--text-tertiary)' }}>
              {currentUser.role}
            </div>
          </div>
          <LayoutDashboard
            className="w-3.5 h-3.5 ml-1 opacity-50 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
          />
        </button>
      </div>
    </header>
  );
};
