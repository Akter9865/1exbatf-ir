-- ==============================================================================
-- WhatsApp CRM & Lead Management Platform - Database Schema
-- ==============================================================================

-- 1. Users / Agents
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent', -- 'super_admin', 'admin', 'agent'
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pipeline Stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Lead Sources
CREATE TABLE IF NOT EXISTS lead_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Contacts / Leads
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  lead_source TEXT DEFAULT 'Website',
  lead_status TEXT DEFAULT 'New Lead', -- 'New Lead', 'Contacted', 'Qualified', 'Follow-up', 'Negotiation', 'Won', 'Lost'
  pipeline_stage_id TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  assigned_agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  custom_fields TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_contact_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open', -- 'open', 'pending', 'closed', 'archived'
  unread_admin_count INTEGER DEFAULT 0,
  unread_user_count INTEGER DEFAULT 0,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL, -- 'visitor', 'agent', 'system'
  sender_id TEXT, -- user_id if agent, null or contact_id if visitor
  text TEXT,
  status TEXT DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Message Attachments
CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'document', 'audio'
  file_size INTEGER,
  mime_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#10b981',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Contact Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- 10. Internal Notes (Private to Agents & Admins)
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Quick Replies
CREATE TABLE IF NOT EXISTS quick_replies (
  id TEXT PRIMARY KEY,
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Automations
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'new_conversation', 'lead_captured', 'keyword_match', 'agent_offline', 'conversation_closed'
  condition_value TEXT, -- matching keyword (case-insensitive) or criteria
  action_type TEXT NOT NULL DEFAULT 'send_message',
  action_payload TEXT NOT NULL, -- response message
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL means broadcast to all active agents
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'message', -- 'message', 'lead', 'system'
  is_read INTEGER DEFAULT 0,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Visitor Sessions
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Settings Key-Value Store
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(lead_status);
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON contacts(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
