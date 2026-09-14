import React, { useState, useEffect } from 'react';
import { Shield, Plus, ToggleLeft, ToggleRight, Edit, Trash2, X, Loader2, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AutomationsPage() {
  const { token } = useAuth();
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [title, setTitle] = useState('');
  const [triggerType, setTriggerType] = useState('new_conversation');
  const [conditionValue, setConditionValue] = useState('');
  const [actionPayload, setActionPayload] = useState('');
  const [isActive, setIsActive] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchAutomations = async () => {
    try {
      const res = await fetch('/api/automations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, [token]);

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/automations/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: data.is_active } : a));
    } catch (err) {
      alert('Failed to toggle automation');
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setTitle('');
    setTriggerType('new_conversation');
    setConditionValue('');
    setActionPayload('');
    setIsActive(1);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setTitle(item.title);
    setTriggerType(item.trigger_type);
    setConditionValue(item.condition_value || '');
    setActionPayload(item.action_payload);
    setIsActive(item.is_active);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingItem) {
        await fetch(`/api/automations/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            trigger_type: triggerType,
            condition_value: conditionValue,
            action_payload: actionPayload,
            is_active: isActive
          })
        });
      } else {
        await fetch('/api/automations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            trigger_type: triggerType,
            condition_value: conditionValue,
            action_payload: actionPayload,
            is_active: isActive
          })
        });
      }
      setShowModal(false);
      fetchAutomations();
    } catch (err) {
      alert('Failed to save automation rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation rule?')) return;
    try {
      await fetch(`/api/automations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAutomations();
    } catch (err) {
      alert('Failed to delete automation');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Automations & Bot Rules
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Configure automatic welcome greetings, keyword-based auto-replies, and offline responses.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          style={{
            backgroundColor: 'var(--wa-green)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={16} />
          <span>New Automation Rule</span>
        </button>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader2 size={28} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {automations.map(rule => (
            <div key={rule.id} style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: rule.is_active ? 1 : 0.65
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    {rule.trigger_type.replace('_', ' ')}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => handleToggle(rule.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title={rule.is_active ? 'Disable' : 'Enable'}
                    >
                      {rule.is_active ? (
                        <ToggleRight size={28} color="var(--wa-green)" />
                      ) : (
                        <ToggleLeft size={28} color="var(--text-muted)" />
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-main)' }}>
                  {rule.title}
                </h3>

                {rule.trigger_type === 'keyword_match' && (
                  <p style={{ fontSize: '12px', color: 'var(--wa-teal)', fontWeight: 600, margin: '0 0 8px' }}>
                    Matches keyword: "{rule.condition_value}"
                  </p>
                )}

                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  lineHeight: '1.45',
                  border: '1px solid var(--border-color)'
                }}>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Auto-Reply Payload:
                  </strong>
                  "{rule.action_payload}"
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {editingItem ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Rule Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Welcome New Chat"
                  required
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
                  Trigger Type *
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
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
                  <option value="new_conversation">When New Conversation Starts</option>
                  <option value="keyword_match">When Visitor Message Contains Keyword</option>
                  <option value="agent_offline">When Agent is Set to Offline</option>
                  <option value="conversation_closed">When Conversation is Closed</option>
                </select>
              </div>

              {triggerType === 'keyword_match' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Keyword to Match (case-insensitive) *
                  </label>
                  <input
                    type="text"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="e.g. price or support"
                    required
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
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Action Auto-Reply Message *
                </label>
                <textarea
                  value={actionPayload}
                  onChange={(e) => setActionPayload(e.target.value)}
                  rows={4}
                  required
                  placeholder="Enter the automated response message..."
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--wa-green)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
