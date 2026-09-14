import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, MessageSquare, Users, GitCommit, Zap, 
  Tag, UserCheck, Download, Settings, LogOut, Sun, Moon, 
  Menu, X, Bell, ExternalLink, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { incomingAlert, clearAlert } = useSocket();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
    { name: 'Chats', path: '/admin/chats', icon: MessageSquare },
    { name: 'Contacts / Leads', path: '/admin/contacts', icon: Users },
    { name: 'Pipeline', path: '/admin/pipeline', icon: GitCommit },
    { name: 'Quick Replies', path: '/admin/quick-replies', icon: Zap },
    { name: 'Automations', path: '/admin/automations', icon: Shield },
    { name: 'Tags', path: '/admin/tags', icon: Tag },
    { name: 'Agents', path: '/admin/agents', icon: UserCheck },
    { name: 'Exports', path: '/admin/exports', icon: Download },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
      {/* Real-time Incoming Message Toast */}
      {incomingAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--bg-card)',
          border: '2px solid var(--wa-green)',
          borderRadius: '12px',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          maxWidth: '360px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--wa-green-bg)',
            color: 'var(--wa-green)',
            borderRadius: '50%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Bell size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
              {incomingAlert.title}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {incomingAlert.message}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  clearAlert();
                  navigate(`/admin/chats?id=${incomingAlert.conversationId}`);
                }}
                style={{
                  backgroundColor: 'var(--wa-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Open Chat
              </button>
              <button
                onClick={clearAlert}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 40,
        transition: 'transform 0.3s ease'
      }}>
        {/* Brand Logo Header */}
        <div style={{
          padding: '20px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--wa-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 168, 132, 0.3)'
          }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: 'var(--text-main)' }}>
              WhatsApp CRM
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Lead & Support Hub
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--wa-green)' : 'transparent',
                  transition: 'background-color 0.15s, color 0.15s'
                })}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          <div style={{ margin: '14px 0 6px', borderTop: '1px solid var(--border-color)' }} />

          {/* External link to public chat */}
          <Link
            to="/chat"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--wa-green)',
              backgroundColor: 'rgba(0, 168, 132, 0.08)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ExternalLink size={16} />
              <span>Open Public Chat</span>
            </span>
            <span style={{ fontSize: '10px', backgroundColor: 'var(--wa-green)', color: '#fff', padding: '2px 6px', borderRadius: '8px' }}>
              Live
            </span>
          </Link>
        </nav>

        {/* Current User & Logout Section */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name}
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--wa-green)', fontWeight: 600 }}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          height: '60px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '16px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Live System Active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Dynamic Nested Page Content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
