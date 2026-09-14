import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Send, Paperclip, Mic, Check, CheckCheck, 
  ChevronRight, Phone, Mail, Tag as TagIcon, Clock, 
  User, ShieldAlert, Zap, FileText, Image as ImageIcon, 
  Download, Loader2, ArrowLeft, MoreVertical, Plus, X, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AudioRecorder from '../../components/chat/AudioRecorder';
import AudioPlayer from '../../components/chat/AudioPlayer';

export default function ChatsInboxPage() {
  const { token, user } = useAuth();
  const { socket, playNotificationChime } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(() => searchParams.get('id') || null);
  const [activeConvData, setActiveConvData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, open, unread, closed, archived
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);

  // Composer states
  const [inputText, setInputText] = useState('');
  const [composerMode, setComposerMode] = useState('message'); // 'message' | 'note'
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickRepliesList, setQuickRepliesList] = useState([]);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [showCrmDrawer, setShowCrmDrawer] = useState(true);

  // CRM Metadata options
  const [pipelineStages, setPipelineStages] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch Quick Replies and CRM Metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [qrRes, pipeRes, tagRes, agRes] = await Promise.all([
          fetch('/api/quick-replies', { headers }),
          fetch('/api/pipeline', { headers }),
          fetch('/api/tags', { headers }),
          fetch('/api/agents', { headers })
        ]);

        if (qrRes.ok) {
          const qrData = await qrRes.json();
          setQuickRepliesList(qrData.quickReplies || []);
        }
        if (pipeRes.ok) {
          const pipeData = await pipeRes.json();
          setPipelineStages(pipeData.stages || []);
        }
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          setAvailableTags(tagData.tags || []);
        }
        if (agRes.ok) {
          const agData = await agRes.json();
          setAgentsList(agData.agents || []);
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMetadata();
  }, [token]);

  // 2. Fetch Conversations List
  const fetchConversations = async () => {
    try {
      let url = `/api/conversations?status=${statusFilter === 'unread' ? 'all' : statusFilter}`;
      if (statusFilter === 'unread') url += '&unread=true';
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data.conversations || []);

      // If no selection yet, select first conversation
      if (!selectedConvId && data.conversations?.length > 0) {
        setSelectedConvId(data.conversations[0].id);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [statusFilter, searchQuery, token]);

  // 3. Fetch Active Conversation Details & Messages
  useEffect(() => {
    if (!selectedConvId) return;

    setLoadingConv(true);
    async function fetchConvDetail() {
      try {
        const res = await fetch(`/api/conversations/${selectedConvId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        setActiveConvData(data.conversation);
        setMessages(data.messages || []);
        setNotes(data.notes || []);

        // Mark read
        fetch(`/api/conversations/${selectedConvId}/mark-read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });

        // Update unread count locally in list
        setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, unread_admin_count: 0 } : c));
      } catch (err) {
        console.error('Fetch conversation detail error:', err);
      } finally {
        setLoadingConv(false);
      }
    }

    fetchConvDetail();
  }, [selectedConvId, token]);

  // Periodic polling fallback to guarantee real-time sync across serverless instances
  useEffect(() => {
    if (!token) return;

    const pollTimer = setInterval(async () => {
      try {
        let url = `/api/conversations?status=${statusFilter === 'unread' ? 'all' : statusFilter}`;
        if (statusFilter === 'unread') url += '&unread=true';
        if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data?.conversations) {
          setConversations(data.conversations);
        }

        // Also refresh messages of currently selected conversation silently
        if (selectedConvId) {
          const detailRes = await fetch(`/api/conversations/${selectedConvId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const detailData = await detailRes.json();
          if (detailData?.messages) {
            setMessages(prev => {
              // Check if any new message from visitor arrived
              if (detailData.messages.length > prev.length) {
                const latest = detailData.messages[detailData.messages.length - 1];
                if (latest && latest.sender_type === 'visitor') {
                  playNotificationChime();
                }
              }
              return detailData.messages;
            });
          }
        }
      } catch (e) {
        // Silent poll fail
      }
    }, 3500);

    return () => clearInterval(pollTimer);
  }, [token, selectedConvId, statusFilter, searchQuery]);

  // 4. Socket.io Event Listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_conversation', selectedConvId);

    const handleNewMessage = (data) => {
      if (data.conversationId === selectedConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      // Re-fetch conversation list to update snippets and unread badge
      fetchConversations();
    };

    const handleStatusChanged = ({ conversationId, status }) => {
      if (conversationId === selectedConvId) {
        setActiveConvData(prev => prev ? { ...prev, status } : prev);
      }
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, status } : c));
    };

    const handleContactUpdated = ({ contactId, ...updated }) => {
      if (activeConvData?.contact_id === contactId) {
        setActiveConvData(prev => ({ ...prev, ...updated }));
      }
      fetchConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('status_changed', handleStatusChanged);
    socket.on('contact_updated', handleContactUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('status_changed', handleStatusChanged);
      socket.off('contact_updated', handleContactUpdated);
      socket.emit('leave_conversation', selectedConvId);
    };
  }, [socket, selectedConvId, activeConvData?.contact_id]);

  // Handle Input Changes with Quick Reply detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    // If typing starts with "/" or contains "/shortcut"
    if (val.startsWith('/')) {
      setShowQuickReplies(true);
      setQuickReplyFilter(val.slice(1).toLowerCase());
    } else {
      setShowQuickReplies(false);
    }
  };

  // Insert Quick Reply template
  const handleSelectQuickReply = (qr) => {
    setInputText(qr.message);
    setShowQuickReplies(false);
  };

  // Send Message or Internal Note
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedConvId) return;

    const content = inputText.trim();
    setInputText('');
    setShowQuickReplies(false);

    if (composerMode === 'note') {
      // Add Private Internal Note
      try {
        const res = await fetch(`/api/contacts/${activeConvData.contact_id}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.note) {
          setNotes(prev => [data.note, ...prev]);
        }
      } catch (err) {
        alert('Failed to save internal note');
      }
      return;
    }

    // Send Live Customer Message
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConvId,
          text: content
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setMessages(prev => [...prev, data.message]);
      fetchConversations();
    } catch (err) {
      alert(err.message || 'Failed to send message');
    }
  };

  // Handle File Upload from Admin
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      // Send message with attachment
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConvId,
          text: '',
          attachment: uploadData
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      fetchConversations();
    } catch (err) {
      alert(err.message || 'File upload failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Voice Recording Completion
  const handleVoiceRecordingComplete = async (uploadData) => {
    setIsRecordingAudio(false);
    if (!uploadData || !selectedConvId) return;

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConvId,
          text: '',
          attachment: uploadData
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      fetchConversations();
    } catch (err) {
      alert('Failed to send voice recording');
    }
  };

  // Update Conversation Status
  const handleUpdateStatus = async (newStatus) => {
    try {
      await fetch(`/api/conversations/${selectedConvId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      setActiveConvData(prev => ({ ...prev, status: newStatus }));
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  // Update Pipeline Stage
  const handleUpdateStage = async (newStageId) => {
    try {
      await fetch('/api/pipeline/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contactId: activeConvData.contact_id,
          newStageId
        })
      });
      setActiveConvData(prev => ({ ...prev, pipeline_stage_id: newStageId }));
      fetchConversations();
    } catch (err) {
      alert('Failed to update pipeline stage');
    }
  };

  // Update Lead Status
  const handleUpdateLeadStatus = async (newLeadStatus) => {
    try {
      await fetch(`/api/contacts/${activeConvData.contact_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lead_status: newLeadStatus })
      });
      setActiveConvData(prev => ({ ...prev, lead_status: newLeadStatus }));
      fetchConversations();
    } catch (err) {
      alert('Failed to update lead status');
    }
  };

  // Add Tag to Contact
  const handleAddTag = async (tagId) => {
    try {
      await fetch(`/api/contacts/${activeConvData.contact_id}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tagId })
      });
      const tagObj = availableTags.find(t => t.id === tagId);
      if (tagObj) {
        setActiveConvData(prev => ({
          ...prev,
          tags: [...(prev.tags || []), tagObj]
        }));
      }
      setShowTagPicker(false);
      fetchConversations();
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  // Remove Tag from Contact
  const handleRemoveTag = async (tagId) => {
    try {
      await fetch(`/api/contacts/${activeConvData.contact_id}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveConvData(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(t => t.id !== tagId)
      }));
      fetchConversations();
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // Filtered Quick Replies
  const filteredQuickReplies = quickRepliesList.filter(qr => 
    qr.shortcut.toLowerCase().includes(quickReplyFilter) || 
    qr.title.toLowerCase().includes(quickReplyFilter) ||
    qr.message.toLowerCase().includes(quickReplyFilter)
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', position: 'relative' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,audio/*"
      />

      {/* ========================================================================= */}
      {/* COLUMN 1: CONVERSATIONS INBOX LIST (340px) */}
      {/* ========================================================================= */}
      <div style={{
        width: '340px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        {/* Search Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '0 12px'
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or phone..."
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: 'var(--text-main)'
              }}
            />
          </div>

          {/* Filter Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
            {['all', 'open', 'unread', 'closed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  background: statusFilter === st ? 'var(--wa-green)' : 'var(--bg-main)',
                  color: statusFilter === st ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap'
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations Scrollable List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>No conversations found</p>
              <span style={{ fontSize: '12px' }}>Visitors will appear here when they start a chat.</span>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(0, 168, 132, 0.12)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.15s'
                  }}
                >
                  {/* Contact Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--wa-green-bg)',
                      color: 'var(--wa-teal)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '16px'
                    }}>
                      {conv.contact_name?.[0]?.toUpperCase() || 'C'}
                    </div>
                  </div>

                  {/* Conv Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {conv.contact_name}
                      </h4>
                      <span style={{ fontSize: '11px', color: conv.unread_admin_count > 0 ? 'var(--wa-green)' : 'var(--text-muted)' }}>
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      margin: '0 0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.last_message?.text || (conv.last_message?.has_attachment ? '📎 File Attachment' : conv.contact_phone)}
                    </p>

                    {/* Tag Chips & Unread Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                      <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
                        {conv.tags?.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '8px',
                              backgroundColor: `${t.color}20`,
                              color: t.color,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>

                      {conv.unread_admin_count > 0 && (
                        <span style={{
                          backgroundColor: 'var(--wa-green)',
                          color: '#ffffff',
                          borderRadius: '10px',
                          padding: '1px 7px',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {conv.unread_admin_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 2: ACTIVE CHAT THREAD (FLEX 1) */}
      {/* ========================================================================= */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-chat)',
        position: 'relative',
        minWidth: 0
      }}>
        {activeConvData ? (
          <>
            {/* Active Chat Header */}
            <div style={{
              height: '60px',
              backgroundColor: 'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 18px',
              zIndex: 10
            }}>
              {/* Customer Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-green-bg)',
                  color: 'var(--wa-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {activeConvData.contact_name?.[0]?.toUpperCase() || 'C'}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {activeConvData.contact_name}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      padding: '2px 6px',
                      borderRadius: '8px'
                    }}>
                      {activeConvData.contact_phone}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Stage: {activeConvData.pipeline_stage_name || 'New Lead'}
                  </span>
                </div>
              </div>

              {/* Status & Actions Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Conversation Status Changer */}
                <select
                  value={activeConvData.status || 'open'}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>

                {/* Toggle CRM details sidebar */}
                <button
                  onClick={() => setShowCrmDrawer(prev => !prev)}
                  style={{
                    backgroundColor: showCrmDrawer ? 'var(--wa-green)' : 'var(--bg-main)',
                    color: showCrmDrawer ? '#fff' : 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>CRM Profile</span>
                </button>
              </div>
            </div>

            {/* Messages Thread */}
            <div 
              className="wa-chat-pattern"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {loadingConv ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                  <Loader2 size={28} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isAgent = msg.sender_type === 'agent';
                  const isSystem = msg.sender_type === 'system';

                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: isSystem ? 'center' : (isAgent ? 'flex-end' : 'flex-start'),
                        margin: '2px 0'
                      }}
                    >
                      {isSystem ? (
                        <div style={{
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          padding: '6px 14px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--wa-green)', marginRight: '6px' }}>
                            [System Bot]
                          </span>
                          {msg.text}
                        </div>
                      ) : (
                        <div
                          className={isAgent ? 'chat-bubble-out' : 'chat-bubble-in'}
                          style={{
                            maxWidth: '70%',
                            padding: '8px 12px 6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            wordBreak: 'break-word',
                            animation: 'fadeIn 0.15s ease-out'
                          }}
                        >
                          {/* Sender name */}
                          <span style={{ fontSize: '11px', fontWeight: 700, color: isAgent ? 'var(--wa-dark-teal)' : 'var(--wa-teal)' }}>
                            {isAgent ? (msg.agent_name || user?.name || 'Agent') : activeConvData.contact_name}
                          </span>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && msg.attachments.map(att => (
                            <div key={att.id} style={{ margin: '4px 0' }}>
                              {att.file_type === 'image' && (
                                <img
                                  src={att.file_url}
                                  alt={att.file_name}
                                  style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '6px', cursor: 'pointer' }}
                                  onClick={() => window.open(att.file_url, '_blank')}
                                />
                              )}
                              {att.file_type === 'audio' && (
                                <AudioPlayer src={att.file_url} isOutgoing={isAgent} />
                              )}
                              {att.file_type === 'document' && (
                                <a
                                  href={att.file_url}
                                  download={att.file_name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: 'rgba(0,0,0,0.06)',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    color: 'inherit'
                                  }}
                                >
                                  <FileText size={22} style={{ color: 'var(--wa-green)' }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {att.file_name}
                                    </p>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      {(att.file_size / 1024).toFixed(1)} KB
                                    </span>
                                  </div>
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          ))}

                          {/* Text Message */}
                          {msg.text && (
                            <span style={{ fontSize: '14px', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                              {msg.text}
                            </span>
                          )}

                          {/* Message Footer: Time + Ticks */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isAgent && (
                              <span>
                                {msg.status === 'read' ? (
                                  <CheckCheck size={14} className="check-read" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck size={14} className="check-delivered" />
                                ) : (
                                  <Check size={14} className="check-delivered" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Box */}
            <div style={{
              backgroundColor: 'var(--bg-sidebar)',
              borderTop: '1px solid var(--border-color)',
              padding: '10px 18px',
              position: 'relative'
            }}>
              {/* Quick Replies Dropdown Popover */}
              {showQuickReplies && (
                <div className="popover-card" style={{
                  position: 'absolute',
                  bottom: '64px',
                  left: '18px',
                  right: '18px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  padding: '8px',
                  zIndex: 50
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--wa-green)' }}>
                      ⚡ QUICK REPLIES TEMPLATES (click to insert)
                    </span>
                    <button onClick={() => setShowQuickReplies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                  {filteredQuickReplies.length > 0 ? (
                    filteredQuickReplies.map(qr => (
                      <div
                        key={qr.id}
                        onClick={() => handleSelectQuickReply(qr)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '13px',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>
                          <strong style={{ color: 'var(--wa-teal)' }}>/{qr.shortcut}</strong> - <span>{qr.title}</span>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {qr.message}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No matching quick reply templates.
                    </div>
                  )}
                </div>
              )}

              {/* Mode Toggle Bar (Message vs Internal Note) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setComposerMode('message')}
                    style={{
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: composerMode === 'message' ? 'var(--wa-green)' : 'transparent',
                      color: composerMode === 'message' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Reply to Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerMode('note')}
                    style={{
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: composerMode === 'note' ? '#f59e0b' : 'transparent',
                      color: composerMode === 'note' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    <Lock size={12} />
                    <span>Private Internal Note</span>
                  </button>
                </div>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Type <strong style={{ color: 'var(--wa-green)' }}>/</strong> to search Quick Replies
                </span>
              </div>

              {/* Composer Input Form or Audio Recorder */}
              {isRecordingAudio ? (
                <AudioRecorder
                  onRecordingComplete={handleVoiceRecordingComplete}
                  onCancel={() => setIsRecordingAudio(false)}
                />
              ) : (
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* File upload button */}
                  {composerMode === 'message' && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Attach Image or Document"
                    >
                      <Paperclip size={20} />
                    </button>
                  )}

                  {/* Quick Replies Shortcut Icon */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--wa-green)',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Browse Quick Replies"
                  >
                    <Zap size={20} />
                  </button>

                  {/* Input field */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={composerMode === 'note' ? "Type a private internal note (invisible to customer)..." : "Type a message or '/' for templates..."}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '20px',
                      backgroundColor: composerMode === 'note' ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-input)',
                      border: composerMode === 'note' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />

                  {/* Voice recording button */}
                  {composerMode === 'message' && !inputText.trim() && (
                    <button
                      type="button"
                      onClick={() => setIsRecordingAudio(true)}
                      style={{
                        backgroundColor: 'var(--wa-green)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      title="Record Voice Note"
                    >
                      <Mic size={18} />
                    </button>
                  )}

                  {/* Send button */}
                  {inputText.trim() && (
                    <button
                      type="submit"
                      style={{
                        backgroundColor: composerMode === 'note' ? '#f59e0b' : 'var(--wa-green)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      title="Send"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: '12px'
          }}>
            <User size={48} style={{ opacity: 0.3 }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Select a Conversation</h3>
            <p style={{ margin: 0, fontSize: '13px' }}>Choose a contact from the left list to view chat and CRM profile.</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 3: CRM CONTACT DETAILS DRAWER (320px) */}
      {/* ========================================================================= */}
      {showCrmDrawer && activeConvData && (
        <div style={{
          width: '320px',
          backgroundColor: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          flexShrink: 0,
          padding: '20px 16px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>CRM Profile</h4>
            <button
              onClick={() => setShowCrmDrawer(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Profile Card */}
          <div style={{
            backgroundColor: 'var(--bg-main)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--wa-green-bg)',
              color: 'var(--wa-teal)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '20px',
              marginBottom: '8px'
            }}>
              {activeConvData.contact_name?.[0]?.toUpperCase() || 'C'}
            </div>
            <h3 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700 }}>
              {activeConvData.contact_name}
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {activeConvData.contact_phone}
            </p>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(0, 168, 132, 0.1)',
              color: 'var(--wa-green)',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              Source: {activeConvData.lead_source || 'Website'}
            </span>
          </div>

          {/* Lead Status Dropdown */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Lead Status
            </label>
            <select
              value={activeConvData.lead_status || 'New Lead'}
              onChange={(e) => handleUpdateLeadStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600
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

          {/* Pipeline Stage Dropdown */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Pipeline Stage
            </label>
            <select
              value={activeConvData.pipeline_stage_id || ''}
              onChange={(e) => handleUpdateStage(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {pipelineStages.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </div>

          {/* Tags Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Tags
              </label>
              <button
                type="button"
                onClick={() => setShowTagPicker(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--wa-green)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Plus size={12} />
                <span>Add Tag</span>
              </button>
            </div>

            {/* Tag Picker Popover */}
            {showTagPicker && (
              <div className="popover-card" style={{ padding: '8px', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    style={{
                      border: 'none',
                      borderRadius: '12px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: `${tag.color}25`,
                      color: tag.color,
                      cursor: 'pointer'
                    }}
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Existing Assigned Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {activeConvData.tags && activeConvData.tags.length > 0 ? (
                activeConvData.tags.map(t => (
                  <span
                    key={t.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: `${t.color}25`,
                      color: t.color
                    }}
                  >
                    {t.name}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRemoveTag(t.id)}
                    />
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No tags assigned</span>
              )}
            </div>
          </div>

          {/* Internal Private Notes Timeline */}
          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Internal Notes ({notes.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.map(note => (
                <div key={note.id} style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  borderLeft: '3px solid #f59e0b',
                  borderRadius: '6px',
                  padding: '8px 10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>{note.author_name || 'Agent'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
