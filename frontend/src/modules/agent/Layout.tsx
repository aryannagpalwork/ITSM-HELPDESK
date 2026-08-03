import React from 'react';
import { AgentSidebar } from './Sidebar';
import { TopNavbar } from '../../components/TopNavbar';

export const AgentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="flex min-h-screen overflow-hidden font-sans"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      <AgentSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <TopNavbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
