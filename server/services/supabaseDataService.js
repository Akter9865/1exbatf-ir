import { getSupabase } from '../supabase.js';
import db from '../db.js';

/**
 * Service to bridge data between SQLite and live Supabase Cloud Database.
 * Ensures persistent storage across Vercel Serverless Function invocations.
 */

// Helper: Safely insert or replace contact in local SQLite cache
export function cacheContactInLocalDb(c) {
  if (!c || !c.id) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO contacts (
        id, name, phone, email, avatar_url, lead_source, lead_status,
        pipeline_stage_id, assigned_agent_id, custom_fields,
        created_at, updated_at, last_contact_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      c.id, c.name, c.phone, c.email || null, c.avatar_url || null,
      c.lead_source || 'Website', c.lead_status || 'New Lead',
      c.pipeline_stage_id || null, c.assigned_agent_id || null,
      typeof c.custom_fields === 'object' ? JSON.stringify(c.custom_fields) : (c.custom_fields || '{}'),
      c.created_at || new Date().toISOString(),
      c.updated_at || new Date().toISOString(),
      c.last_contact_at || new Date().toISOString()
    );
  } catch (e) {
    // Ignore cache error
  }
}

// Helper: Safely insert or replace conversation in local SQLite cache
export function cacheConversationInLocalDb(conv) {
  if (!conv || !conv.id) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO conversations (
        id, contact_id, assigned_agent_id, status,
        unread_admin_count, unread_user_count, last_message_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      conv.id, conv.contact_id, conv.assigned_agent_id || null,
      conv.status || 'open', conv.unread_admin_count || 0,
      conv.unread_user_count || 0, conv.last_message_at || new Date().toISOString(),
      conv.created_at || new Date().toISOString(),
      conv.updated_at || new Date().toISOString()
    );
  } catch (e) {
    // Ignore cache error
  }
}

// Helper: Safely insert message in local SQLite cache
export function cacheMessageInLocalDb(msg) {
  if (!msg || !msg.id) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO messages (
        id, conversation_id, sender_type, sender_id, text, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id, msg.conversation_id, msg.sender_type,
      msg.sender_id || null, msg.text || '',
      msg.status || 'sent', msg.created_at || new Date().toISOString()
    );
  } catch (e) {
    // Ignore cache error
  }
}

// Helper: Safely insert visitor session in local SQLite cache
export function cacheSessionInLocalDb(sess) {
  if (!sess || !sess.session_token) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO visitor_sessions (
        id, session_token, contact_id, conversation_id, user_agent, created_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sess.id || ('ses_' + Date.now()),
      sess.session_token,
      sess.contact_id,
      sess.conversation_id || null,
      sess.user_agent || null,
      sess.created_at || new Date().toISOString(),
      sess.last_seen_at || new Date().toISOString()
    );
  } catch (e) {
    // Ignore cache error
  }
}

/* ==============================================================================
   CONTACTS
   ============================================================================== */

export async function saveContactToSupabase(contact) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('contacts').upsert({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email || null,
      avatar_url: contact.avatar_url || null,
      lead_source: contact.lead_source || 'Website',
      lead_status: contact.lead_status || 'New Lead',
      pipeline_stage_id: contact.pipeline_stage_id || null,
      assigned_agent_id: contact.assigned_agent_id || null,
      created_at: contact.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_contact_at: contact.last_contact_at || new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase contact save error:', err.message);
  }
}

export async function getContactsFromSupabase({ search = '', status = '', stage = '', page = 1, limit = 50 } = {}) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    let query = supabase.from('contacts').select(`
      *,
      pipeline_stages ( name, color ),
      users ( name, avatar_url ),
      contact_tags (
        tags ( id, name, color )
      )
    `, { count: 'exact' });

    if (search && search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }

    if (status) {
      query = query.eq('lead_status', status);
    }

    if (stage) {
      query = query.eq('pipeline_stage_id', stage);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('last_contact_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.warn('Supabase fetch contacts error:', error.message);
      return null;
    }

    // Format contacts & cache locally
    const formatted = (data || []).map(ct => {
      cacheContactInLocalDb(ct);

      const tags = (ct.contact_tags || [])
        .map(ctag => ctag.tags)
        .filter(Boolean);

      return {
        ...ct,
        pipeline_stage_name: ct.pipeline_stages?.name || null,
        pipeline_stage_color: ct.pipeline_stages?.color || null,
        assigned_agent_name: ct.users?.name || null,
        assigned_agent_avatar: ct.users?.avatar_url || null,
        tags
      };
    });

    return {
      contacts: formatted,
      total: count || formatted.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil((count || formatted.length) / limit) || 1
    };
  } catch (err) {
    console.warn('Supabase getContacts error:', err.message);
    return null;
  }
}

/* ==============================================================================
   CONVERSATIONS & SESSIONS
   ============================================================================== */

export async function saveSessionToSupabase(session) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('visitor_sessions').upsert({
      id: session.id,
      session_token: session.session_token,
      contact_id: session.contact_id,
      conversation_id: session.conversation_id,
      user_agent: session.user_agent || null,
      created_at: session.created_at || new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase session save error:', err.message);
  }
}

export async function saveConversationToSupabase(conv) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('conversations').upsert({
      id: conv.id,
      contact_id: conv.contact_id,
      assigned_agent_id: conv.assigned_agent_id || null,
      status: conv.status || 'open',
      unread_admin_count: conv.unread_admin_count || 0,
      unread_user_count: conv.unread_user_count || 0,
      last_message_at: conv.last_message_at || new Date().toISOString(),
      created_at: conv.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase conversation save error:', err.message);
  }
}

export async function getConversationsFromSupabase(statusFilter = 'all') {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    let query = supabase.from('conversations').select(`
      *,
      contacts (*),
      users ( name, avatar_url )
    `);

    if (statusFilter && statusFilter !== 'all' && statusFilter !== 'unread') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('last_message_at', { ascending: false });

    if (error) {
      console.warn('Supabase conversations error:', error.message);
      return null;
    }

    // Get last message for each conversation
    const formatted = await Promise.all((data || []).map(async (conv) => {
      cacheConversationInLocalDb(conv);
      if (conv.contacts) cacheContactInLocalDb(conv.contacts);

      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = lastMsgs?.[0] || null;

      return {
        ...conv,
        contact_name: conv.contacts?.name || 'Visitor',
        contact_phone: conv.contacts?.phone || '',
        contact_email: conv.contacts?.email || '',
        contact_avatar: conv.contacts?.avatar_url || null,
        lead_status: conv.contacts?.lead_status || 'New Lead',
        lead_source: conv.contacts?.lead_source || 'Website',
        assigned_agent_name: conv.users?.name || null,
        assigned_agent_avatar: conv.users?.avatar_url || null,
        last_message: lastMsg ? {
          text: lastMsg.text,
          sender_type: lastMsg.sender_type,
          created_at: lastMsg.created_at,
          status: lastMsg.status
        } : null
      };
    }));

    return formatted;
  } catch (err) {
    console.warn('Supabase getConversations error:', err.message);
    return null;
  }
}

/* ==============================================================================
   MESSAGES
   ============================================================================== */

export async function saveMessageToSupabase(message, attachment = null) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('messages').insert({
      id: message.id,
      conversation_id: message.conversation_id,
      sender_type: message.sender_type,
      sender_id: message.sender_id || null,
      text: message.text || '',
      status: message.status || 'sent',
      created_at: message.created_at || new Date().toISOString()
    });

    if (attachment) {
      await supabase.from('message_attachments').insert({
        id: attachment.id || ('att_' + Date.now()),
        message_id: message.id,
        file_name: attachment.file_name,
        file_url: attachment.file_url,
        file_type: attachment.file_type || 'document',
        file_size: attachment.file_size || 0,
        mime_type: attachment.mime_type || '',
        created_at: new Date().toISOString()
      });
    }

    // Update conversation last_message_at
    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', message.conversation_id);
  } catch (err) {
    console.warn('Supabase message save error:', err.message);
  }
}

export async function getMessagesFromSupabase(conversationId) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, message_attachments(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase getMessages error:', error.message);
      return null;
    }

    // Cache locally
    (data || []).forEach(m => {
      cacheMessageInLocalDb(m);
    });

    return (data || []).map(m => ({
      ...m,
      attachments: m.message_attachments || []
    }));
  } catch (err) {
    console.warn('Supabase getMessages error:', err.message);
    return null;
  }
}

/* ==============================================================================
   VISITOR SESSION RESOLVER
   ============================================================================== */

export async function getVisitorSessionFromSupabase(sessionToken) {
  const supabase = getSupabase();
  if (!supabase || !sessionToken) return null;

  try {
    const { data: session, error } = await supabase
      .from('visitor_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .limit(1)
      .single();

    if (error || !session) return null;

    cacheSessionInLocalDb(session);

    // Get contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', session.contact_id)
      .single();

    if (contact) cacheContactInLocalDb(contact);

    // Get conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', session.conversation_id)
      .single();

    if (conversation) cacheConversationInLocalDb(conversation);

    // Get messages
    const messages = await getMessagesFromSupabase(session.conversation_id);

    return {
      session,
      contact,
      conversation,
      messages: messages || []
    };
  } catch (err) {
    console.warn('Supabase getVisitorSession error:', err.message);
    return null;
  }
}
