import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Image as ImageIcon, FileText, Mic, Check, CheckCheck, 
  Smile, Moon, Sun, Shield, AlertCircle, Download, Phone, Info, Loader2, ArrowLeft
} from 'lucide-react';
import { io } from 'socket.io-client';
import AudioRecorder from '../../components/chat/AudioRecorder';
import AudioPlayer from '../../components/chat/AudioPlayer';
import LeadCaptureModal from '../../components/chat/LeadCaptureModal';
import { useTheme } from '../../context/ThemeContext';

export default function PublicChatPage() {
  const { theme, toggleTheme } = useTheme();

  // Settings & identity
  const [settings, setSettings] = useState({
    brand_name: 'Guru Anna',
    agent_name: 'Customer Support',
    agent_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    agent_status: 'Online',
    welcome_message: 'Hello! Welcome to Guru Anna. How can we help you today?',
    chat_availability: 'Online',
    lead_capture_required: true
  });

  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('crm_visitor_session'));
  const [contact, setContact] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showLeadModal, setShowLeadModal] = useState(false);

  // Composer state
  const [inputText, setInputText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages]);

  // 1. Initialize chat session
  useEffect(() => {
    async function initChat() {
      setLoadingInit(true);
      try {
        const headers = {};
        const savedToken = localStorage.getItem('crm_visitor_session');
        if (savedToken) {
          headers['x-visitor-session'] = savedToken;
        }

        const res = await fetch('/api/chat/init', { headers });
        const data = await res.json();

        if (data.settings) {
          setSettings(data.settings);
        }

        if (data.hasActiveSession && data.conversation) {
          setContact(data.contact);
          setConversation(data.conversation);
          setMessages(data.messages || []);
          setShowLeadModal(false);
        } else {
          // No active session yet: do NOT show lead modal on load!
          // Show the automated greeting message so visitor sees the active chat box first
          setMessages([
            {
              id: 'welcome_init',
              sender_type: 'bot',
              text: data.settings?.welcome_message || 'Hello! Welcome to Guru Anna. How can we help you today?',
              created_at: new Date().toISOString()
            }
          ]);
          setShowLeadModal(false);
        }
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setLoadingInit(false);
      }
    }

    initChat();
  }, []);

  // 2. Setup Socket.io real-time connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    if (conversation?.id) {
      socket.emit('join_conversation', conversation.id);
    }

    socket.on('new_message', (data) => {
      if (data.conversationId === conversation?.id) {
        setMessages((prev) => {
          // Avoid duplicate by id
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });

        // Mark read
        fetch(`/api/chat/mark-read/${conversation.id}`, { method: 'POST' }).catch(() => {});
      }
    });

    socket.on('typing_start', (data) => {
      if (data.senderType === 'agent' && data.conversationId === conversation?.id) {
        setAgentTyping(true);
      }
    });

    socket.on('typing_stop', (data) => {
      if (data.senderType === 'agent' && data.conversationId === conversation?.id) {
        setAgentTyping(false);
      }
    });

    socket.on('messages_marked_read', (data) => {
      if (data.readBy === 'admin' && data.conversationId === conversation?.id) {
        setMessages(prev => prev.map(m => m.sender_type === 'visitor' ? { ...m, status: 'read' } : m));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [conversation?.id]);

  // Handle lead capture unlock
  const handleUnlockChat = async (data) => {
    setSessionToken(data.sessionToken);
    setContact(data.contact);
    setConversation(data.conversation);
    setShowLeadModal(false);

    // If visitor already typed a message in the input box, automatically send it now
    const pendingText = inputText.trim();
    if (pendingText) {
      setInputText('');
      const tempId = 'temp_' + Date.now();
      const optimisticMsg = {
        id: tempId,
        conversation_id: data.conversation.id,
        sender_type: 'visitor',
        text: pendingText,
        status: 'sending',
        created_at: new Date().toISOString(),
        attachments: []
      };
      setMessages(prev => [...prev, optimisticMsg]);

      try {
        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-visitor-session': data.sessionToken
          },
          body: JSON.stringify({
            conversationId: data.conversation.id,
            text: pendingText
          })
        });
        const resData = await res.json();
        if (res.ok && resData.message) {
          setMessages(prev => prev.map(m => m.id === tempId ? resData.message : m));
        }
      } catch (err) {
        console.error('Failed to send pending message:', err);
      }
    }

    // Refresh conversation messages (including welcome message and any auto-replies)
    setTimeout(() => {
      fetch(`/api/chat/init`, {
        headers: { 'x-visitor-session': data.sessionToken }
      })
      .then(res => res.json())
      .then(resData => {
        if (resData.messages && resData.messages.length > 0) {
          setMessages(resData.messages);
        }
      })
      .catch(() => {});
    }, 600);
  };

  // Handle Send Text Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();

    if (!sessionToken || !conversation) {
      setShowLeadModal(true);
      return;
    }

    if (!text) return;

    setInputText('');
    stopTyping();

    // Optimistic temporary message
    const tempId = 'temp_' + Date.now();
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversation.id,
      sender_type: 'visitor',
      text,
      status: 'sending',
      created_at: new Date().toISOString(),
      attachments: []
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-session': sessionToken
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          text
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      // Replace optimistic message with actual message
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  // Handle File Attachment Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    setIsUploading(true);

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
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-session': sessionToken
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          text: '',
          attachment: uploadData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send attachment message');

      setMessages(prev => [...prev, data.message]);
    } catch (err) {
      alert(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Voice Recording completion
  const handleVoiceRecordingComplete = async (uploadData) => {
    setIsRecordingAudio(false);
    if (!uploadData || !conversation) return;

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-session': sessionToken
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          text: '',
          attachment: uploadData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send voice note');

      setMessages(prev => [...prev, data.message]);
    } catch (err) {
      alert('Failed to send voice note');
    }
  };

  // Typing indicator broadcast
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socketRef.current || !conversation) return;

    socketRef.current.emit('typing_start', {
      conversationId: conversation.id,
      senderName: contact?.name || 'Visitor',
      senderType: 'visitor'
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  };

  const stopTyping = () => {
    if (socketRef.current && conversation) {
      socketRef.current.emit('typing_stop', {
        conversationId: conversation.id,
        senderType: 'visitor'
      });
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loadingInit) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-chat)',
        gap: '12px'
      }}>
        <Loader2 size={36} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Connecting to secure live support...</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      padding: '0',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,audio/*"
      />

      {/* Main Chat Container (Responsive WhatsApp Web Style) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1000px',
        height: '100vh',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* Top Header Bar */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10
        }}>
          {/* Brand & Support Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={settings.agent_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={settings.brand_name || 'Support'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--wa-green)'
                }}
              />
              <span style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: settings.agent_status === 'Online' ? '#25d366' : '#94a3b8',
                border: '2px solid var(--bg-card)'
              }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  {settings.brand_name || 'Guru Anna'}
                </h2>
                {/* Official Verified Badge */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.3-5.3 1.4 1.4-6.7 6.7z" fill="#00a884"/>
                </svg>
              </div>
              <p style={{ fontSize: '12px', color: agentTyping ? 'var(--wa-green)' : 'var(--text-muted)', margin: '2px 0 0' }}>
                {settings.agent_name || 'Customer Support'} • {agentTyping ? 'typing...' : settings.agent_status}
              </p>
            </div>
          </div>

          {/* Action Buttons - Pure Customer Facing (Admin Portal link removed) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center'
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Chat Messages Body */}
        <div 
          className="wa-chat-pattern"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Security Notice Pill */}
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 500,
              padding: '6px 14px',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-color)'
            }}>
              <Shield size={13} style={{ color: 'var(--wa-green)' }} />
              <span>Messages are encrypted and transmitted directly to our live support team.</span>
            </div>
          </div>

          {/* Messages Stream */}
          {messages.map((msg, idx) => {
            const isOutgoing = msg.sender_type === 'visitor';
            const isSystem = msg.sender_type === 'system';

            return (
              <div
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: isSystem ? 'center' : (isOutgoing ? 'flex-end' : 'flex-start'),
                  margin: '2px 0'
                }}
              >
                {/* System / Automated Bot Notice Pill */}
                {isSystem ? (
                  <div style={{
                    maxWidth: '85%',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    textAlign: 'center',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border-color)',
                    animation: 'fadeIn 0.2s'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--wa-green)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
                      Automated Assistant
                    </span>
                    {msg.text}
                  </div>
                ) : (
                  /* Standard Chat Bubble */
                  <div
                    className={isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'}
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px 6px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      wordBreak: 'break-word',
                      animation: 'fadeIn 0.15s ease-out'
                    }}
                  >
                    {/* Sender Name if incoming agent */}
                    {!isOutgoing && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--wa-teal)' }}>
                        {settings.agent_name || settings.brand_name || 'Customer Support'}
                      </span>
                    )}

                    {/* Attachments rendering */}
                    {msg.attachments && msg.attachments.length > 0 && msg.attachments.map(att => (
                      <div key={att.id} style={{ margin: '4px 0' }}>
                        {/* Image Preview */}
                        {att.file_type === 'image' && (
                          <div style={{ borderRadius: '6px', overflow: 'hidden', maxHeight: '260px' }}>
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', cursor: 'pointer' }}
                              onClick={() => window.open(att.file_url, '_blank')}
                            />
                          </div>
                        )}

                        {/* Audio Voice Note Player */}
                        {att.file_type === 'audio' && (
                          <AudioPlayer src={att.file_url} isOutgoing={isOutgoing} />
                        )}

                        {/* Document Download Card */}
                        {att.file_type === 'document' && (
                          <a
                            href={att.file_url}
                            download={att.file_name}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              backgroundColor: 'rgba(0,0,0,0.06)',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              textDecoration: 'none',
                              color: 'inherit'
                            }}
                          >
                            <FileText size={28} style={{ color: 'var(--wa-green)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {att.file_name}
                              </p>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {(att.file_size / 1024).toFixed(1)} KB • Click to download
                              </span>
                            </div>
                            <Download size={16} style={{ color: 'var(--text-muted)' }} />
                          </a>
                        )}
                      </div>
                    ))}

                    {/* Text content */}
                    {msg.text && (
                      <span style={{ fontSize: '14px', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                        {msg.text}
                      </span>
                    )}

                    {/* Timestamp & Status Checkmarks */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '2px'
                    }}>
                      <span>{formatMessageTime(msg.created_at)}</span>
                      {isOutgoing && (
                        <span>
                          {msg.status === 'read' ? (
                            <CheckCheck size={15} className="check-read" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck size={15} className="check-delivered" />
                          ) : msg.status === 'sending' ? (
                            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Check size={15} className="check-delivered" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {agentTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
              <div className="chat-bubble-in" style={{ padding: '8px 14px', borderRadius: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--wa-green)', animation: 'pulseDot 1s infinite' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--wa-green)', animation: 'pulseDot 1s infinite 0.2s' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--wa-green)', animation: 'pulseDot 1s infinite 0.4s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer Footer */}
        <footer style={{
          padding: '10px 14px',
          backgroundColor: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {/* Attachment Menu Popup */}
          {showAttachMenu && (
            <div className="popover-card" style={{
              position: 'absolute',
              bottom: '68px',
              left: '16px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 30,
              minWidth: '180px'
            }}>
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.setAttribute('accept', 'image/*');
                  fileInputRef.current?.click();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'none',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  fontSize: '13px'
                }}
              >
                <ImageIcon size={18} style={{ color: '#00a884' }} />
                <span>Photos & Videos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.zip');
                  fileInputRef.current?.click();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'none',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  fontSize: '13px'
                }}
              >
                <FileText size={18} style={{ color: '#7c3aed' }} />
                <span>Documents & PDF</span>
              </button>
            </div>
          )}

          {/* Conditional: Voice Recorder vs Standard Input */}
          {isRecordingAudio ? (
            <AudioRecorder
              onRecordingComplete={handleVoiceRecordingComplete}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => {
                  if (!sessionToken || !conversation) {
                    setShowLeadModal(true);
                    return;
                  }
                  setShowAttachMenu(prev => !prev);
                }}
                disabled={isUploading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Attach file"
              >
                {isUploading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={20} />}
              </button>

              {/* Text Input Box */}
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onClick={() => {
                  if (!sessionToken || !conversation) setShowLeadModal(true);
                }}
                onFocus={() => {
                  if (!sessionToken || !conversation) setShowLeadModal(true);
                }}
                placeholder={conversation ? "Type a message..." : "Type a message to start chat..."}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '24px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />

              {/* Toggle: Send button if text exists, else Voice Record button */}
              {inputText.trim() ? (
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--wa-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  title="Send Message"
                >
                  <Send size={18} style={{ marginLeft: '2px' }} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!sessionToken || !conversation) {
                      setShowLeadModal(true);
                    } else {
                      setIsRecordingAudio(true);
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--wa-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  title="Hold or click to record voice note"
                >
                  <Mic size={18} />
                </button>
              )}
            </form>
          )}
        </footer>
      </div>

      {/* Lead Capture Gate Modal */}
      {showLeadModal && (
        <LeadCaptureModal
          agentName={settings.agent_name}
          brandName={settings.brand_name}
          agentAvatar={settings.agent_avatar}
          onUnlockChat={handleUnlockChat}
          onClose={() => setShowLeadModal(false)}
        />
      )}
    </div>
  );
}
