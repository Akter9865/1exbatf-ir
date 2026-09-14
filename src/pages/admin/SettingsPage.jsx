import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Save, Upload, Plus, Trash2, CheckCircle2, 
  Shield, Bell, User, Loader2, Database, Copy, Check, 
  ExternalLink, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SettingsPage() {
  const { token } = useAuth();

  const [brandName, setBrandName] = useState('Guru Anna');
  const [agentName, setAgentName] = useState('Akter');
  const [agentAvatar, setAgentAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
  const [agentStatus, setAgentStatus] = useState('Online');
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! Welcome to Guru Anna. How can we help you today?');
  const [chatAvailability, setChatAvailability] = useState('Online');
  const [leadCaptureRequired, setLeadCaptureRequired] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Lead Sources
  const [leadSources, setLeadSources] = useState([]);
  const [newSourceName, setNewSourceName] = useState('');

  // Supabase Cloud Configuration
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseSaving, setSupabaseSaving] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const s = data.settings || {};

        if (s.brand_name) setBrandName(s.brand_name);
        if (s.agent_name) setAgentName(s.agent_name);
        if (s.agent_avatar) setAgentAvatar(s.agent_avatar);
        if (s.agent_status) setAgentStatus(s.agent_status);
        if (s.welcome_message) setWelcomeMessage(s.welcome_message);
        if (s.chat_availability) setChatAvailability(s.chat_availability);
        if (s.lead_capture_required !== undefined) setLeadCaptureRequired(s.lead_capture_required === 'true');
        if (s.sound_enabled !== undefined) setSoundEnabled(s.sound_enabled === 'true');

        if (data.supabase) {
          setSupabaseUrl(data.supabase.url || '');
        }

        setLeadSources(data.leadSources || []);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [token]);

  // Handle Avatar Image Upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.file_url) {
        setAgentAvatar(data.file_url);
      }
    } catch (err) {
      alert('Avatar upload failed');
    }
  };

  // Save General Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          brand_name: brandName,
          agent_name: agentName,
          agent_avatar: agentAvatar,
          agent_status: agentStatus,
          welcome_message: welcomeMessage,
          chat_availability: chatAvailability,
          lead_capture_required: String(leadCaptureRequired),
          sound_enabled: String(soundEnabled)
        })
      });

      if (!res.ok) throw new Error('Failed to save settings');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Add Lead Source
  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    try {
      const res = await fetch('/api/settings/lead-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newSourceName.trim() })
      });
      const data = await res.json();
      setLeadSources(data.leadSources || []);
      setNewSourceName('');
    } catch (err) {
      alert('Failed to add lead source');
    }
  };

  // Delete Lead Source
  const handleDeleteSource = async (id) => {
    try {
      const res = await fetch(`/api/settings/lead-sources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLeadSources(data.leadSources || []);
    } catch (err) {
      alert('Failed to delete lead source');
    }
  };

  // Test Supabase Connection
  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseStatus({
        connected: false,
        message: 'Please enter both your Supabase Project URL and API Key before testing.'
      });
      return;
    }

    setSupabaseTesting(true);
    setSupabaseStatus(null);

    try {
      const res = await fetch('/api/settings/supabase/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: supabaseUrl.trim(), key: supabaseKey.trim() })
      });

      const data = await res.json();
      setSupabaseStatus(data);
    } catch (err) {
      setSupabaseStatus({
        connected: false,
        message: err.message || 'Network error while contacting backend'
      });
    } finally {
      setSupabaseTesting(false);
    }
  };

  // Save Supabase Configuration to .env & Database
  const handleSaveSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('Please provide your Supabase Project URL and Key');
      return;
    }

    setSupabaseSaving(true);
    try {
      const res = await fetch('/api/settings/supabase/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: supabaseUrl.trim(), key: supabaseKey.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSupabaseStatus(data.testResult);
      alert('Supabase credentials successfully saved to environment!');
    } catch (err) {
      alert(err.message || 'Failed to save Supabase settings');
    } finally {
      setSupabaseSaving(false);
    }
  };

  // Copy Supabase Migration SQL to Clipboard
  const handleCopySql = async () => {
    try {
      const res = await fetch('/api/settings/supabase/sql', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      }
    } catch (err) {
      alert('Failed to copy SQL script. You can also view supabase_schema.sql directly in the workspace.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader2 size={32} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.2s ease-out' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarUpload}
        style={{ display: 'none' }}
        accept="image/*"
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            System & Cloud Settings
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Configure live chat identity, welcome messages, lead channels, and Supabase cloud database backend.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          style={{
            backgroundColor: 'var(--wa-green)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 22px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
          <span>{saving ? 'Saving...' : 'Save General Settings'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>Settings saved successfully! Changes are reflected immediately in the visitor live chat.</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: SUPABASE CLOUD BACKEND INTEGRATION */}
      {/* ========================================================================= */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '26px',
        border: '2px solid rgba(62, 207, 142, 0.4)',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(62, 207, 142, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={24} style={{ color: '#3ecf8e' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Supabase Cloud Integration
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(62, 207, 142, 0.2)',
                  color: '#3ecf8e',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  PostgreSQL & Storage
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Connect your live Supabase project to power cloud database persistence, Realtime events, and file buckets.
              </p>
            </div>
          </div>

          <button
            onClick={handleCopySql}
            style={{
              backgroundColor: copiedSql ? '#10b981' : 'var(--bg-main)',
              color: copiedSql ? '#fff' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
            title="Copy SQL migration script to clipboard"
          >
            {copiedSql ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedSql ? 'SQL Copied!' : 'Copy Migration SQL'}</span>
          </button>
        </div>

        {/* Status Notification Box */}
        {supabaseStatus && (
          <div style={{
            backgroundColor: supabaseStatus.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: supabaseStatus.connected ? '#10b981' : 'var(--danger)',
            border: `1px solid ${supabaseStatus.connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {supabaseStatus.connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{supabaseStatus.message}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Supabase Project URL
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Supabase Anon / Service Role Key
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleTestSupabase}
              disabled={supabaseTesting}
              style={{
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: supabaseTesting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {supabaseTesting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={15} />}
              <span>Test Live Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSupabase}
              disabled={supabaseSaving}
              style={{
                backgroundColor: '#3ecf8e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: supabaseSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {supabaseSaving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
              <span>Save & Connect Supabase</span>
            </button>
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Open Supabase Dashboard</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Quick Instructions */}
        <div style={{
          marginTop: '18px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-main)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
            Quick Supabase Setup:
          </strong>
          1. Click <strong>"Copy Migration SQL"</strong> above.
          <br />
          2. In your Supabase Dashboard, open <strong>SQL Editor</strong>, paste the script, and click <strong>Run</strong>.
          <br />
          3. Copy your <strong>Project URL</strong> and <strong>anon/service_role key</strong> from Project Settings &gt; API, paste them here, and click <strong>"Save & Connect"</strong>.
        </div>
      </div>

      {/* Section 1: Business / Agent Chat Profile */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '26px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
          Visitor-Facing Chat Identity
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
          This identity and status is presented in the public chat widget and header.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <img
              src={agentAvatar}
              alt="Agent Avatar"
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--wa-green)'
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: 'var(--wa-green)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Upload new photo"
            >
              <Upload size={13} />
            </button>
          </div>

          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>
              Agent Profile Picture
            </h4>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Upload JPG, PNG or WEBP avatar image.
            </p>
            <input
              type="text"
              value={agentAvatar}
              onChange={(e) => setAgentAvatar(e.target.value)}
              placeholder="Or paste image URL directly..."
              style={{
                width: '320px',
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Business / Brand Name
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Guru Anna"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Agent Display Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Akter"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Current Agent Status
            </label>
            <select
              value={agentStatus}
              onChange={(e) => setAgentStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            >
              <option value="Online">Online (Active)</option>
              <option value="Offline">Offline (Away)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Chat Availability
            </label>
            <input
              type="text"
              value={chatAvailability}
              onChange={(e) => setChatAvailability(e.target.value)}
              placeholder="24/7 or 9am - 8pm"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Default Welcome Greeting
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* Section 2: Lead Sources Manager */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '26px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
          Lead Sources Configuration
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px' }}>
          Manage the tracking channels and lead sources recorded in contacts.
        </p>

        {/* Add Source Form */}
        <form onSubmit={handleAddSource} style={{ display: 'flex', gap: '10px', marginBottom: '16px', maxWidth: '400px' }}>
          <input
            type="text"
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="e.g. TikTok Ads"
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '13px'
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--wa-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </form>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {leadSources.map(src => (
            <span
              key={src.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {src.name}
              <button
                type="button"
                onClick={() => handleDeleteSource(src.id)}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 size={13} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
