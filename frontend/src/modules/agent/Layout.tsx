import React from 'react';
import { AgentSidebar } from './Sidebar';
import { TopNavbar } from '../../components/TopNavbar';
import { SidebarProvider, useSidebar } from '../../shared/SidebarContext';

const AgentLayoutInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className="flex min-h-screen overflow-hidden font-sans"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <AgentSidebar />
      </div>
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <TopNavbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export const AgentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <AgentLayoutInner>{children}</AgentLayoutInner>
  </SidebarProvider>
);
