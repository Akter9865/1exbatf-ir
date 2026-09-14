import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('crm_admin_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Validate existing token
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (data?.user) {
          setUser(data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Auth verification error:', err.message);
        // Only log out if it was an explicit 401/403 authorization rejection
        if (err.status === 401 || err.status === 403) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (!data?.token) {
      throw new Error('Authentication response missing session token');
    }

    localStorage.setItem('crm_admin_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('crm_admin_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
