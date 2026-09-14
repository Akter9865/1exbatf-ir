import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Filter, Plus, Download, MessageSquare, 
  Trash2, Edit, X, Phone, Mail, Check, Loader2, ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ContactsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [pipelineStages, setPipelineStages] = useState([]);
  const [page, setPage] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Form inputs for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState('New Lead');
  const [formStage, setFormStage] = useState('');
  const [formSource, setFormSource] = useState('Direct');
  const [submitting, setSubmitting] = useState(false);

  // Load pipeline stages once
  useEffect(() => {
    async function loadStages() {
      try {
        const res = await fetch('/api/pipeline', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setPipelineStages(data.stages || []);
      } catch (err) {
        console.error('Failed to load stages:', err);
      }
    }
    loadStages();
  }, [token]);

  // Fetch Contacts with Filters
  const fetchContacts = async () => {
    setLoading(true);
    try {
      let url = `/api/contacts?page=${page}&limit=25`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (stageFilter) url += `&stage=${encodeURIComponent(stageFilter)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotalCount(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [page, search, statusFilter, stageFilter, token]);

  const handleOpenAdd = () => {
    setEditingContact(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormStatus('New Lead');
    setFormStage(pipelineStages[0]?.id || '');
    setFormSource('Direct');
    setShowAddModal(true);
  };

  const handleOpenEdit = (contact) => {
    setEditingContact(contact);
    setFormName(contact.name || '');
    setFormPhone(contact.phone || '');
    setFormEmail(contact.email || '');
    setFormStatus(contact.lead_status || 'New Lead');
    setFormStage(contact.pipeline_stage_id || '');
    setFormSource(contact.lead_source || 'Website');
    setShowAddModal(true);
  };

  const handleSubmitContact = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingContact) {
        // Update contact
        await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formName,
            phone: formPhone,
            email: formEmail,
            lead_status: formStatus,
            pipeline_stage_id: formStage,
            lead_source: formSource
          })
        });
      } else {
        // Create new contact
        await fetch('/api/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formName,
            phone: formPhone,
            email: formEmail,
            lead_status: formStatus,
            pipeline_stage_id: formStage,
            lead_source: formSource
          })
        });
      }
      setShowAddModal(false);
      fetchContacts();
    } catch (err) {
      alert('Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact and their conversations?')) return;

    try {
      await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchContacts();
    } catch (err) {
      alert('Failed to delete contact');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Contacts & CRM Leads ({totalCount})
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Manage customer records, lead statuses, pipeline stages, and contact details.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/admin/exports')}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={16} />
            <span>Export</span>
          </button>

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
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '14px',
        padding: '16px 20px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0 12px',
          flex: 1,
          minWidth: '240px'
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            style={{
              width: '100%',
              padding: '9px 0',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <option value="">All Lead Statuses</option>
          <option value="New Lead">New Lead</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Follow-up">Follow-up</option>
          <option value="Negotiation">Negotiation</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>

        {/* Stage Filter */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <option value="">All Pipeline Stages</option>
          {pipelineStages.map(st => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </select>
      </div>

      {/* Contacts Table */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Contact</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Phone</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Lead Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Pipeline Stage</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Tags</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Last Contact</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No contacts found matching your criteria.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Name & Source */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--wa-green-bg)',
                        color: 'var(--wa-teal)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                      }}>
                        {c.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                          {c.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {c.lead_source || 'Website'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td style={{ padding: '14px 18px', fontWeight: 500 }}>
                    {c.phone}
                  </td>

                  {/* Lead Status */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: c.lead_status === 'Won' ? '#10b98125' : c.lead_status === 'Lost' ? '#ef444425' : 'rgba(59, 130, 246, 0.1)',
                      color: c.lead_status === 'Won' ? '#10b981' : c.lead_status === 'Lost' ? '#ef4444' : '#3b82f6'
                    }}>
                      {c.lead_status || 'New Lead'}
                    </span>
                  </td>

                  {/* Pipeline Stage */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.pipeline_stage_color || '#3b82f6' }} />
                      {c.pipeline_stage_name || 'Unassigned'}
                    </span>
                  </td>

                  {/* Tags */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {c.tags?.map(t => (
                        <span key={t.id} style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: `${t.color}25`,
                          color: t.color
                        }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Last Contact */}
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString() : '-'}
                  </td>

                  {/* Action Buttons */}
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {/* Open Chat */}
                      {c.conversation_id && (
                        <button
                          onClick={() => navigate(`/admin/chats?id=${c.conversation_id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--wa-green)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Open Live Chat"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEdit(c)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Edit Contact"
                      >
                        <Edit size={16} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteContact(c.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete Contact"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Contact Modal */}
      {showAddModal && (
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
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingContact ? 'Edit Contact' : 'Add New CRM Contact'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitContact} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
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
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
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
                    Email Address (optional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Lead Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '13px'
                      }}
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Negotiation">Negotiation</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Pipeline Stage
                    </label>
                    <select
                      value={formStage}
                      onChange={(e) => setFormStage(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '13px'
                      }}
                    >
                      {pipelineStages.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '13px'
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
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
