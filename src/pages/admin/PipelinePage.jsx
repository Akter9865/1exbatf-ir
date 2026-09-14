import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitCommit, Plus, MessageSquare, Phone, User, 
  Tag as TagIcon, Clock, Loader2, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function PipelinePage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [stages, setStages] = useState([]);
  const [pipelineData, setPipelineData] = useState({});
  const [loading, setLoading] = useState(true);
  const [draggedContactId, setDraggedContactId] = useState(null);

  // Fetch Pipeline & Cards
  const fetchPipeline = async () => {
    try {
      const res = await fetch('/api/pipeline', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStages(data.stages || []);
      setPipelineData(data.pipeline || {});
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [token]);

  // Drag handlers
  const handleDragStart = (e, contactId) => {
    setDraggedContactId(contactId);
    e.dataTransfer.setData('text/plain', contactId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    const contactId = draggedContactId || e.dataTransfer.getData('text/plain');
    if (!contactId || !targetStageId) return;

    // Optimistic UI update
    setPipelineData((prev) => {
      const next = { ...prev };
      let movedContact = null;

      // Remove from existing stage
      Object.keys(next).forEach((stageId) => {
        const idx = next[stageId].findIndex(c => c.id === contactId);
        if (idx !== -1) {
          movedContact = next[stageId][idx];
          next[stageId] = next[stageId].filter(c => c.id !== contactId);
        }
      });

      // Add to target stage
      if (movedContact) {
        movedContact.pipeline_stage_id = targetStageId;
        next[targetStageId] = [movedContact, ...(next[targetStageId] || [])];
      }
      return next;
    });

    try {
      await fetch('/api/pipeline/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contactId, newStageId: targetStageId })
      });
    } catch (err) {
      console.error('Move stage failed:', err);
      fetchPipeline(); // rollback
    } finally {
      setDraggedContactId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <Loader2 size={32} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const totalLeads = Object.values(pipelineData).reduce((acc, arr) => acc + (arr?.length || 0), 0);

  return (
    <div style={{ padding: '24px 32px', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Sales Pipeline Kanban ({totalLeads} Leads)
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Drag and drop customer cards between stages to advance their lead journey.
          </p>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '16px',
        alignItems: 'stretch'
      }}>
        {stages.map((stage) => {
          const cards = pipelineData[stage.id] || [];
          return (
            <div
              key={stage.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{
                width: '300px',
                minWidth: '300px',
                backgroundColor: 'var(--bg-sidebar)',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: `4px solid ${stage.color || '#3b82f6'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {stage.name}
                  </span>
                </div>
                <span style={{
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-muted)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {cards.length}
                </span>
              </div>

              {/* Cards Container */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {cards.map((contact) => (
                  <div
                    key={contact.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, contact.id)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'grab',
                      userSelect: 'none',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                  >
                    {/* Contact Name & Lead Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {contact.name}
                      </h4>
                      {contact.conversation_id && (
                        <button
                          onClick={() => navigate(`/admin/chats?id=${contact.conversation_id}`)}
                          style={{ background: 'none', border: 'none', color: 'var(--wa-green)', cursor: 'pointer', padding: '2px' }}
                          title="Open Live Chat"
                        >
                          <MessageSquare size={14} />
                        </button>
                      )}
                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={11} />
                      {contact.phone}
                    </p>

                    {/* Tags */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {contact.tags.map(t => (
                          <span
                            key={t.id}
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '8px',
                              backgroundColor: `${t.color}20`,
                              color: t.color
                            }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer with agent & last contact time */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '6px',
                      marginTop: '4px'
                    }}>
                      <span>{contact.assigned_agent_name || 'Unassigned'}</span>
                      <span>{contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '10px',
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '12px'
                  }}>
                    Drag contacts here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
