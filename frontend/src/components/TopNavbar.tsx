import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, KeyRound, UserCircle2 } from 'lucide-react';
import { useApp } from '../shared/AppContext';
import { ThemeSelector } from '../shared/ThemeSelector';

/**
 * Global top navbar rendered on every authenticated page (inside each role
 * Layout). Hosts the global theme dropdown as a single, always-visible entry
 * point. Fully theme-token driven — no hardcoded colors.
 */
export const TopNavbar: React.FC<{ title?: string }> = ({ title }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangePassword = () => {
    setMenuOpen(false);
    navigate('/change-password');
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
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
        <ThemeSelector />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
              style={{
                backgroundColor: 'var(--accent-primary-bg)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              <UserCircle2 className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold truncate max-w-32">{currentUser.name || 'Profile'}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 bottom-full mb-2 w-52 rounded-xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {currentUser.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {currentUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleChangePassword}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <KeyRound className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span>Change password</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
