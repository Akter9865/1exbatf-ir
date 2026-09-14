import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import PublicChatPage from './pages/chat/PublicChatPage';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './components/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import ChatsInboxPage from './pages/admin/ChatsInboxPage';
import ContactsPage from './pages/admin/ContactsPage';
import PipelinePage from './pages/admin/PipelinePage';
import QuickRepliesPage from './pages/admin/QuickRepliesPage';
import AutomationsPage from './pages/admin/AutomationsPage';
import TagsPage from './pages/admin/TagsPage';
import AgentsPage from './pages/admin/AgentsPage';
import ExportsPage from './pages/admin/ExportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)'
      }}>
        <Loader2 size={36} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Customer / Visitor Chat */}
      <Route path="/chat" element={<PublicChatPage />} />
      <Route path="/chat/:businessId" element={<PublicChatPage />} />

      {/* Admin Login */}
      <Route path="/admin/login" element={
        isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage />
      } />

      {/* Protected Admin Portal */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="chats" element={<ChatsInboxPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="quick-replies" element={<QuickRepliesPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="exports" element={<ExportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Default Fallback Redirect */}
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
