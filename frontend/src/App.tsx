import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './shared/AppContext';
import { ChatProvider } from './shared/ChatContext';
import { ThemeProvider } from './shared/ThemeContext';

// Import Pages (shared across roles)
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { ChangePassword } from './pages/ChangePassword';
import { Register } from './pages/Register';
import { AIChat } from './pages/AIChat';
import { TicketDashboard } from './pages/TicketDashboard';
import { TicketDetails } from './pages/TicketDetails';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Settings } from './pages/Settings';
import { AgentLeave } from './pages/AgentLeave';
import { AdminLeaveManagement } from './pages/AdminLeaveManagement';
import { AdminAlertManagement } from './pages/AdminAlertManagement';
import { AgentAlertManagement } from './pages/AgentAlertManagement';

// Import Module Layouts
import { EmployeeLayout } from './modules/employee/Layout';
import { EmployeeDashboard } from './modules/employee/Dashboard';

import { AgentLayout } from './modules/agent/Layout';
import { AgentDashboard } from './modules/agent/Dashboard';

import { AdminLayout } from './modules/admin/Layout';
import { AdminDashboard } from './modules/admin/Dashboard';
import { AgentManagement } from './modules/admin/AgentManagement';
import { AdminPendingUsers } from './modules/admin/PendingUsers';

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
const RoleProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: ('Employee' | 'Agent' | 'Administrator')[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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

const RoleAwareLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();

  if (currentUser.role === 'Agent') {
    return <AgentLayout>{children}</AgentLayout>;
  }

  if (currentUser.role === 'Administrator') {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return <EmployeeLayout>{children}</EmployeeLayout>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ChatProvider>
          <Router>
            <Routes>
            {/* Public Access Paths */}
            <Route path="/" element={<FullScreenWrapper><Landing /></FullScreenWrapper>} />
            <Route path="/login" element={<FullScreenWrapper><Login /></FullScreenWrapper>} />
            <Route path="/forgot-password" element={<FullScreenWrapper><ForgotPassword /></FullScreenWrapper>} />
            <Route path="/reset-password" element={<FullScreenWrapper><ResetPassword /></FullScreenWrapper>} />
            <Route path="/register" element={<FullScreenWrapper><Register /></FullScreenWrapper>} />

            {/* ========= Employee Module (Role: Employee) ========= */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <EmployeeLayout>
                  <EmployeeDashboard />
                </EmployeeLayout>
              </ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <RoleAwareLayout>
                  <ChangePassword />
                </RoleAwareLayout>
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <EmployeeLayout>
                  <AIChat />
                </EmployeeLayout>
              </ProtectedRoute>
            } />
            <Route path="/tickets" element={
              <ProtectedRoute>
                <EmployeeLayout>
                  <TicketDashboard />
                </EmployeeLayout>
              </ProtectedRoute>
            } />
            <Route path="/tickets/:id" element={
              <ProtectedRoute>
                <EmployeeLayout>
                  <TicketDetails />
                </EmployeeLayout>
              </ProtectedRoute>
            } />
            <Route path="/kb" element={
              <ProtectedRoute>
                <EmployeeLayout>
                  <KnowledgeBase />
                </EmployeeLayout>
              </ProtectedRoute>
            } />

            {/* ========= Agent Module (Role: Agent) ========= */}
            <Route path="/agent/dashboard" element={
              <RoleProtectedRoute allowedRoles={['Agent', 'Administrator']}>
                <AgentLayout>
                  <AgentDashboard />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/chat" element={
              <RoleProtectedRoute allowedRoles={['Agent', 'Administrator']}>
                <AgentLayout>
                  <AIChat />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/tickets" element={
              <RoleProtectedRoute allowedRoles={['Agent', 'Administrator']}>
                <AgentLayout>
                  <TicketDashboard />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/alerts" element={
              <RoleProtectedRoute allowedRoles={['Agent', 'Administrator']}>
                <AgentLayout>
                  <AgentAlertManagement />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/tickets/:id" element={
              <RoleProtectedRoute allowedRoles={['Agent', 'Administrator']}>
                <AgentLayout>
                  <TicketDetails />
                </AgentLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/agent/leaves" element={
              <RoleProtectedRoute allowedRoles={['Agent']}>
                <AgentLayout>
                  <AgentLeave />
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
            <Route path="/admin/leaves" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AdminLeaveManagement />
                </AdminLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/admin/alerts" element={
              <RoleProtectedRoute allowedRoles={['Administrator']}>
                <AdminLayout>
                  <AdminAlertManagement />
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
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Redirect Fallbacks */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ChatProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
