import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { 
  LayoutDashboard, 
  MessageSquareCode, 
  TicketCheck, 
  BookOpen, 
  ShieldAlert, 
  Settings as SettingsIcon, 
  LogOut, 
  Terminal, 
  UserCircle,
  Sparkles,
  ChevronRight,
  Database,
  UserPlus,
  KeyRound,
  Megaphone
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const navItems = [
    { 
      name: 'Overview Dashboard', 
      path: '/dashboard', 
      icon: LayoutDashboard,
      roles: ['Employee', 'Agent', 'Administrator']
    },
    { 
      name: 'AI Helpdesk Chat', 
      path: '/chat', 
      icon: MessageSquareCode,
      roles: ['Employee', 'Agent', 'Administrator'],
      badge: 'AI RAG'
    },
    { 
      name: 'My Tickets', 
      path: '/tickets', 
      icon: TicketCheck,
      roles: ['Employee']
    },
    { 
      name: 'Ticket Queue', 
      path: '/tickets', 
      icon: TicketCheck,
      roles: ['Agent', 'Administrator']
    },
    { 
      name: 'Knowledge Base', 
      path: '/kb', 
      icon: BookOpen,
      roles: ['Employee', 'Agent', 'Administrator']
    },
    { 
      name: 'Admin Command', 
      path: '/admin', 
      icon: ShieldAlert,
      roles: ['Administrator']
    },
    { 
      name: 'Alert Management', 
      path: '/admin/alerts', 
      icon: Megaphone,
      roles: ['Administrator']
    },
    { 
      name: 'User Management', 
      path: '/admin/pending-users', 
      icon: UserPlus,
      roles: ['Administrator']
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: SettingsIcon,
      roles: ['Administrator']
    }
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <div id="app-sidebar" className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 text-zinc-100 font-sans">
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              ITSM Copilot
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">Enterprise v1.2</p>
          </div>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
        <p className="px-3 mb-2 text-[10px] font-mono tracking-wider text-zinc-500 uppercase">Navigation</p>
        <div className="space-y-1">
          {filteredNavItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            const IconComponent = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium leading-tight transition-all group ${
                  isActive
                    ? 'bg-zinc-900 text-white border-l-2 border-indigo-500 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <IconComponent className={`w-4 h-4 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`} />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge ? (
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none tracking-wide bg-indigo-500/10 border-indigo-500/20"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isActive ? 'opacity-100 text-zinc-500' : 'opacity-0 group-hover:opacity-100 text-zinc-600'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer / Active User Session Panel */}
      <div className="p-4 border-t border-zinc-900 bg-zinc-950">
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className="w-full flex items-center space-x-3 mb-3 p-1.5 rounded-lg transition-colors hover:bg-zinc-900"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold text-sm">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-zinc-950 shadow-sm" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <h4 className="text-xs font-semibold text-white truncate">{currentUser.name}</h4>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser.email}</p>
            </div>
          </button>

          {profileMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  navigate('/change-password');
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Change password</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onLogout) onLogout();
                  navigate('/');
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                <span>Exit Workstation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
