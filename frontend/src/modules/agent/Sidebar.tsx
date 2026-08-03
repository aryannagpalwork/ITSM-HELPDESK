import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../shared/AppContext';
import { 
  LayoutDashboard, 
  MessageSquareCode, 
  TicketCheck, 
  BookOpen, 
  LogOut, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const AgentSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useApp();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const navItems = [
    { 
      name: 'Overview Dashboard', 
      path: '/agent/dashboard', 
      icon: LayoutDashboard,
    },
    { 
      name: 'AI Helpdesk Chat', 
      path: '/agent/chat', 
      icon: MessageSquareCode,
      badge: 'AI RAG'
    },
    { 
      name: 'Ticket Queue', 
      path: '/agent/tickets', 
      icon: TicketCheck,
    },
    { 
      name: 'Knowledge Base', 
      path: '/agent/kb', 
      icon: BookOpen,
    },
  ];

  return (
    <div
      className="w-64 flex flex-col justify-between h-screen sticky top-0 shrink-0 font-sans"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/agent/dashboard')}>
          <div
            className="p-2.5 rounded-xl shadow-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)`,
              boxShadow: `0 10px 20px -10px var(--accent-primary)`,
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1
              className="font-semibold text-sm tracking-tight flex items-center gap-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              ITSM Copilot
            </h1>
            <p
              className="text-[10px] font-mono tracking-wider uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Agent Console
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
        <p
          className="px-3 mb-2 text-[10px] font-mono tracking-wider uppercase"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Navigation
        </p>
        <div className="space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/agent/dashboard' && location.pathname.startsWith(item.path));
            const IconComponent = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group"
                style={{
                  backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderLeft: isActive ? `2px solid var(--accent-primary)` : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div className="flex items-center space-x-3">
                  <IconComponent
                    className="w-4 h-4 transition-transform duration-200 group-hover:scale-105"
                    style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span
                    className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border"
                    style={{
                      backgroundColor: 'var(--accent-primary-bg)',
                      color: 'var(--accent-primary)',
                      borderColor: 'var(--border-strong)',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ color: isActive ? 'var(--text-tertiary)' : 'var(--text-tertiary)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer / User Session */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--sidebar-bg)' }}
      >
        <div className="flex items-center justify-between mb-3 gap-2 p-1.5">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm"
                style={{
                  backgroundColor: 'var(--accent-primary-bg)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--accent-primary)',
                }}
              >
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 shadow-sm"
                style={{ borderColor: 'var(--app-bg)' }}
              />
            </div>
            <div className="min-w-0">
              <h4
                className="text-xs font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {currentUser.name}
              </h4>
              <p
                className="text-[10px] truncate"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {currentUser.email}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 border rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--card-bg)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Workstation</span>
        </button>
      </div>
    </div>
  );
};
