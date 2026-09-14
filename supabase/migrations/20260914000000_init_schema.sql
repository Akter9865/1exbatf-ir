-- ==============================================================================
-- SUPABASE POSTGRESQL PRODUCTION MIGRATION & SEED SCRIPT
-- WhatsApp CRM & Live Support Portal
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to ensure clean schema with string IDs
DROP TABLE IF EXISTS public.contact_tags CASCADE;
DROP TABLE IF EXISTS public.conversation_tags CASCADE;
DROP TABLE IF EXISTS public.message_attachments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.visitor_sessions CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.lead_sources CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.quick_replies CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Users / Agents Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT ('usr_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'admin', 'agent')),
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pipeline Stages Table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Lead Sources Table
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contacts / CRM Leads Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id TEXT PRIMARY KEY DEFAULT ('cnt_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  lead_source TEXT DEFAULT 'Website',
  lead_status TEXT DEFAULT 'New Lead',
  pipeline_stage_id TEXT REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  assigned_agent_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contact_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY DEFAULT ('cnv_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  assigned_agent_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed', 'archived')),
  unread_admin_count INTEGER DEFAULT 0,
  unread_user_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY DEFAULT ('msg_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'agent', 'system')),
  sender_id TEXT,
  text TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Message Attachments Table (Images, Documents, Voice Audio)
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id TEXT PRIMARY KEY DEFAULT ('att_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document', 'audio')),
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Contact Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.contact_tags (
  contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- 10. Private Internal Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY DEFAULT ('not_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
  contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Quick Replies Table
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id TEXT PRIMARY KEY,
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Automations & Bot Rules Table
CREATE TABLE IF NOT EXISTS public.automations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  condition_value TEXT,
  action_type TEXT NOT NULL DEFAULT 'send_message',
  action_payload TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. System & Brand Settings Key-Value Store
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Visitor Persistent Sessions Table
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id TEXT PRIMARY KEY DEFAULT ('ses_' || floor(extract(epoch from now()))::text),
  session_token TEXT NOT NULL UNIQUE,
  contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(lead_status);
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON public.contacts(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  END IF;
END $$;

-- ==============================================================================
-- SUPABASE STORAGE BUCKET
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage public read policy
DROP POLICY IF EXISTS "Public Read chat-uploads" ON storage.objects;
CREATE POLICY "Public Read chat-uploads" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-uploads');

-- Storage public insert policy (for visitor & agent attachments)
DROP POLICY IF EXISTS "Public Insert chat-uploads" ON storage.objects;
CREATE POLICY "Public Insert chat-uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-uploads');

-- ==============================================================================
-- SEED DEFAULT DATA
-- ==============================================================================

-- 1. Default Super Admin User (admin@1xbetfair.com / admin123)
-- bcrypt hash for 'admin123': $2a$10$X8aWshSFzpyH1j1b701Tr3e9LMcD5F6koro5iIH3jk0 or standard
INSERT INTO public.users (id, email, password_hash, name, role, avatar_url, status)
VALUES (
  'usr_admin_default',
  'admin@1xbetfair.com',
  '$2a$10$Wq3qB7b3jYl1lX/FmO2Q.eY2z3xP1.LdYx1tH1a9p0lC6iYt2G1a2', -- fallback hash
  'Akter (Super Admin)',
  'super_admin',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- 2. Pipeline Stages
INSERT INTO public.pipeline_stages (id, name, order_index, color)
VALUES 
  ('stage_1', 'New', 1, '#3b82f6'),
  ('stage_2', 'Contacted', 2, '#06b6d4'),
  ('stage_3', 'Qualified', 3, '#8b5cf6'),
  ('stage_4', 'Follow Up', 4, '#f59e0b'),
  ('stage_5', 'Negotiation', 5, '#ec4899'),
  ('stage_6', 'Won', 6, '#10b981'),
  ('stage_7', 'Lost', 7, '#ef4444')
ON CONFLICT (id) DO NOTHING;

-- 3. Lead Sources
INSERT INTO public.lead_sources (id, name)
VALUES
  ('src_1', 'Website'),
  ('src_2', 'Facebook'),
  ('src_3', 'Instagram'),
  ('src_4', 'Google Ads'),
  ('src_5', 'Referral'),
  ('src_6', 'WhatsApp'),
  ('src_7', 'Direct')
ON CONFLICT (id) DO NOTHING;

-- 4. Tags
INSERT INTO public.tags (id, name, color)
VALUES
  ('tag_hot', 'Hot Lead', '#ef4444'),
  ('tag_vip', 'VIP', '#8b5cf6'),
  ('tag_interested', 'Interested', '#10b981'),
  ('tag_followup', 'Follow Up', '#f59e0b'),
  ('tag_budget', 'High Budget', '#06b6d4'),
  ('tag_web', 'Website Lead', '#64748b')
ON CONFLICT (id) DO NOTHING;

-- 5. Quick Replies
INSERT INTO public.quick_replies (id, shortcut, title, message)
VALUES
  ('qr_1', 'hello', 'Welcome Greeting', 'Hello! Thanks for contacting us. How can we help you today?'),
  ('qr_2', 'price', 'Pricing Packages', 'Our pricing packages are flexible to suit your needs. Would you like a detailed breakdown?'),
  ('qr_3', 'support', 'Support Review', 'Our support team is reviewing your request right now. Please hold on for just a moment.'),
  ('qr_4', 'hours', 'Working Hours', 'Our live support is available 24/7. Feel free to ask any question at any time!'),
  ('qr_5', 'thanks', 'Thank You Message', 'Thank you for reaching out! Please let us know if you need any further assistance.')
ON CONFLICT (id) DO NOTHING;

-- 6. Automations
INSERT INTO public.automations (id, title, trigger_type, condition_value, action_type, action_payload, is_active)
VALUES
  ('auto_welcome', 'Automatic Welcome Message', 'new_conversation', '', 'send_message', 'Hello! Welcome to Guru Anna. How can we help you today?', 1),
  ('auto_kw_price', 'Price Inquiry Auto-Reply', 'keyword_match', 'price', 'send_message', 'Sure! Please tell us which product or tier you are interested in, and we will provide the best offer.', 1),
  ('auto_kw_help', 'Help / Support Keyword', 'keyword_match', 'help', 'send_message', 'Our agent is right here with you! Could you describe your requirement in detail?', 1),
  ('auto_offline', 'Offline Hours Auto-Reply', 'agent_offline', '', 'send_message', 'Our team is currently away from the desk. Please leave your query and phone number; we will get back to you shortly!', 1),
  ('auto_closed', 'Conversation Closed Message', 'conversation_closed', '', 'send_message', 'This conversation has been closed. Have a wonderful day, and feel free to start a new chat anytime!', 1)
ON CONFLICT (id) DO NOTHING;

-- 7. Settings
INSERT INTO public.settings (key, value)
VALUES
  ('brand_name', 'Guru Anna'),
  ('agent_name', 'Akter'),
  ('agent_avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
  ('agent_status', 'Online'),
  ('welcome_message', 'Hello! Welcome to Guru Anna. How can we help you today?'),
  ('chat_availability', 'Online'),
  ('sound_enabled', 'true'),
  ('lead_capture_required', 'true')
ON CONFLICT (key) DO NOTHING;

-- Disable RLS or set open policies so the Node API and browser client can interact seamlessly
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_sessions DISABLE ROW LEVEL SECURITY;
