import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './shared/AppContext';
import { ThemeProvider } from './shared/ThemeContext';
import { UserRole } from './shared/types';

// Import Pages (shared across roles)
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AIChat } from './pages/AIChat';
import { TicketDashboard } from './pages/TicketDashboard';
import { TicketDetails } from './pages/TicketDetails';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Settings } from './pages/Settings';

// Import Module Layouts
import { EmployeeLayout } from './modules/employee/Layout';
import { EmployeeDashboard } from './modules/employee/Dashboard';

import { AgentLayout } from './modules/agent/Layout';
import { AgentDashboard } from './modules/agent/Dashboard';

import { AdminLayout } from './modules/admin/Layout';
import { AdminDashboard } from './modules/admin/Dashboard';
import { AdminPendingUsers } from './modules/admin/PendingUsers';
import { AgentManagement } from './modules/admin/AgentManagement';

const ROLE_DASHBOARD_PATH: Record<UserRole, string> = {
  Employee: '/dashboard',
  Agent: '/agent/dashboard',
  Administrator: '/admin/dashboard',
};

const getRoleDashboardPath = (role: UserRole) => ROLE_DASHBOARD_PATH[role];

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Role-Protected Route Component
const RoleProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: UserRole[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getRoleDashboardPath(currentUser.role)} replace />;
  }

  return <>{children}</>;
};

const RoleDashboardRedirect: React.FC = () => {
  const { isAuthenticated, currentUser } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Navigate to={getRoleDashboardPath(currentUser.role)} replace />;
};

// Fullscreen wrapper for public pages — theme-aware
const FullScreenWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      {children}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Router>
          <Routes>
            {/* Public Access Paths */}
            <Route path="/" element={<FullScreenWrapper><Landing /></FullScreenWrapper>} />
            <Route path="/login" element={<FullScreenWrapper><Login /></FullScreenWrapper>} />
            <Route path="/register" element={<FullScreenWrapper><Register /></FullScreenWrapper>} />

            {/* ========= Employee Module (Role: Employee) ========= */}
            <Route path="/dashboard" element={
              <RoleProtectedRoute allowedRoles={['Employee']}>
                <EmployeeLayout>
                  <EmployeeDashboard />
                </EmployeeLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/chat" element={
              <RoleProtectedRoute allowedRoles={['Employee']}>
                <EmployeeLayout>
                  <AIChat />
                </EmployeeLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/tickets" element={
              <RoleProtectedRoute allowedRoles={['Employee']}>
                <EmployeeLayout>
                  <TicketDashboard />
                </EmployeeLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/tickets/:id" element={
              <RoleProtectedRoute allowedRoles={['Employee']}>
                <EmployeeLayout>
                  <TicketDetails />
                </EmployeeLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/kb" element={
              <RoleProtectedRoute allowedRoles={['Employee']}>
                <EmployeeLayout>
                  <KnowledgeBase />
                </EmployeeLayout>
              </RoleProtectedRoute>
            } />

            {/* ========= Agent Module (Role: Agent) ========= */}
            <Route path="/agent/dashboard" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <AgentDashboard />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/chat" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <AIChat />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/tickets" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <TicketDashboard />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/tickets/:id" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <TicketDetails />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/kb" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <KnowledgeBase />
                </AgentLayout>
              </RoleProtectedRoute>
            } />

            {/* ========= Admin Module (Role: Administrator) ========= */}
            <Route path="/admin/dashboard" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/pending-users" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AdminPendingUsers />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/agents" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AgentManagement />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/chat" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AIChat />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/tickets" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <TicketDashboard />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/tickets/:id" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <TicketDetails />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/kb" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <KnowledgeBase />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <Settings />
                </AdminLayout>
              </RoleProtectedRoute>
            } />

            {/* Legacy admin redirect */}
            <Route path="/admin" element={<RoleDashboardRedirect />} />

            {/* Redirect Fallbacks */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}
