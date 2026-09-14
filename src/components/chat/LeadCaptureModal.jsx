import React, { useState } from 'react';
import { User, Phone, MessageSquare, ShieldCheck, ArrowRight, Loader2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export default function LeadCaptureModal({ agentName, brandName, agentAvatar, onUnlockChat, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
    if (cleanPhone.length < 7) {
      setError('Please enter a valid mobile number (e.g. +1234567890)');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/api/chat/lead-capture', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          leadSource: 'Website Live Chat'
        })
      });

      // Store visitor session in localStorage
      localStorage.setItem('crm_visitor_session', data.sessionToken);
      localStorage.setItem('crm_visitor_name', data.contact?.name || name.trim());
      localStorage.setItem('crm_visitor_phone', data.contact?.phone || cleanPhone);

      onUnlockChat(data);
    } catch (err) {
      console.error('Lead submission failed:', err);
      setError(err.message || 'Something went wrong. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 20, 26, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        animation: 'fadeIn 0.25s ease-out',
        position: 'relative'
      }}>
        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'background 0.2s'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Top Header with Agent Branding */}
        <div style={{
          background: 'linear-gradient(135deg, var(--wa-green) 0%, var(--wa-teal) 100%)',
          padding: '24px 20px',
          color: '#ffffff',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
            <img
              src={agentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={brandName || 'Support'}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #ffffff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#25d366',
              border: '2px solid #ffffff'
            }} />
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>
            Start Chat with {brandName || 'Support'}
          </h3>
          <p style={{ fontSize: '12px', opacity: 0.9, margin: 0 }}>
            {agentName || 'Customer Support'} • Live Support
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 22px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', textAlign: 'center' }}>
            Please introduce yourself to start your direct conversation with our team.
          </p>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '16px',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {error}
            </div>
          )}

          {/* Full Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Full Name *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <User size={18} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                style={{
                  width: '100%',
                  padding: '12px 0',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Mobile Number *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <Phone size={18} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199 or 9876543210"
                required
                style={{
                  width: '100%',
                  padding: '12px 0',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'var(--wa-green)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)',
              transition: 'background-color 0.2s, transform 0.1s'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Connecting to chat...</span>
              </>
            ) : (
              <>
                <span>Continue to Chat</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', color: 'var(--text-muted)', fontSize: '11px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--wa-green)' }} />
            <span>Encrypted and stored securely in CRM</span>
          </div>
        </form>
      </div>
    </div>
  );
}
