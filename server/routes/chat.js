import express from 'express';
import db from '../db.js';
import { emitNewMessage } from '../services/socketService.js';
import { triggerNewConversationAutomations, triggerKeywordAutomations } from '../services/automationEngine.js';

const router = express.Router();

// Helper to get all settings as an object
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, r) => {
    acc[r.key] = r.value;
    return acc;
  }, {});
}

// 1. Initialize Public Chat
router.get('/init', (req, res) => {
  try {
    const settings = getSettings();
    const sessionToken = req.headers['x-visitor-session'];

    let activeSession = null;
    let contact = null;
    let conversation = null;
    let messages = [];

    if (sessionToken) {
      activeSession = db.prepare('SELECT * FROM visitor_sessions WHERE session_token = ?').get(sessionToken);
      if (activeSession) {
        contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(activeSession.contact_id);
        if (contact) {
          conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(activeSession.conversation_id);
          if (conversation) {
            // Load messages
            const rawMessages = db.prepare(`
              SELECT m.*, 
                     json_group_array(
                       json_object(
                         'id', a.id,
                         'file_name', a.file_name,
                         'file_url', a.file_url,
                         'file_type', a.file_type,
                         'file_size', a.file_size,
                         'mime_type', a.mime_type
                       )
                     ) FILTER (WHERE a.id IS NOT NULL) as attachments
              FROM messages m
              LEFT JOIN message_attachments a ON m.id = a.message_id
              WHERE m.conversation_id = ?
              GROUP BY m.id
              ORDER BY m.created_at ASC
            `).all(conversation.id);

            messages = rawMessages.map(m => ({
              ...m,
              attachments: m.attachments ? JSON.parse(m.attachments) : []
            }));
          }
        }
      }
    }

    res.json({
      settings: {
        brand_name: settings.brand_name || 'Guru Anna',
        agent_name: settings.agent_name || 'Customer Support',
        agent_avatar: settings.agent_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        agent_status: settings.agent_status || 'Online',
        welcome_message: settings.welcome_message || 'Hello! Welcome to Guru Anna. How can we help you today?',
        chat_availability: settings.chat_availability || 'Online',
        lead_capture_required: settings.lead_capture_required !== 'false',
      },
      hasActiveSession: !!(activeSession && contact && conversation),
      contact,
      conversation,
      messages
    });
  } catch (error) {
    console.error('Chat init error:', error);
    res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

// 2. Submit Lead Capture Form (Name + Phone)
router.post('/lead-capture', (req, res) => {
  try {
    const { name, phone, leadSource = 'Website' } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and Phone Number are required to start chat' });
    }

    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
    const cleanName = name.trim();

    if (cleanPhone.length < 6) {
      return res.status(400).json({ error: 'Please enter a valid mobile phone number' });
    }

    // Check if contact already exists with this phone
    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(cleanPhone);
    let isNewContact = false;

    if (contact) {
      // Update contact name & last activity
      db.prepare(`
        UPDATE contacts 
        SET name = ?, last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(cleanName, contact.id);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact.id);
    } else {
      isNewContact = true;
      const contactId = 'cnt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      
      // Default pipeline stage
      const firstStage = db.prepare('SELECT id FROM pipeline_stages ORDER BY order_index ASC LIMIT 1').get();
      const stageId = firstStage ? firstStage.id : null;

      db.prepare(`
        INSERT INTO contacts (id, name, phone, lead_source, lead_status, pipeline_stage_id)
        VALUES (?, ?, ?, ?, 'New Lead', ?)
      `).run(contactId, cleanName, cleanPhone, leadSource, stageId);

      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);

      // Auto-tag with website lead
      const webTag = db.prepare("SELECT id FROM tags WHERE name = 'Website Lead'").get();
      if (webTag) {
        db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)').run(contactId, webTag.id);
      }
    }

    // Find or create conversation for this contact
    let conversation = db.prepare("SELECT * FROM conversations WHERE contact_id = ? AND status != 'archived' ORDER BY created_at DESC LIMIT 1").get(contact.id);

    let isNewConv = false;
    if (!conversation) {
      isNewConv = true;
      const convId = 'cnv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      db.prepare(`
        INSERT INTO conversations (id, contact_id, status)
        VALUES (?, ?, 'open')
      `).run(convId, contact.id);
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    }

    // Create or update visitor session
    const sessionToken = 'vs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
    const sessionId = 'ses_' + Date.now();
    db.prepare(`
      INSERT INTO visitor_sessions (id, session_token, contact_id, conversation_id, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, sessionToken, contact.id, conversation.id, req.headers['user-agent'] || '');

    // If new conversation or new contact, trigger automations (Welcome message)
    if (isNewConv || isNewContact) {
      triggerNewConversationAutomations(conversation.id, contact.id);
    }

    // Notify admins in real time
    const convData = db.prepare(`
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.id = ?
    `).get(conversation.id);

    const io = db; // socket helper handles this
    res.json({
      sessionToken,
      contact,
      conversation: convData
    });
  } catch (error) {
    console.error('Lead capture error:', error);
    res.status(500).json({ error: 'Failed to process lead capture' });
  }
});

// 3. Visitor Sends Message
router.post('/messages', (req, res) => {
  try {
    const { conversationId, text, attachment } = req.body;
    const sessionToken = req.headers['x-visitor-session'];

    if (!sessionToken) {
      return res.status(401).json({ error: 'Session required' });
    }

    const session = db.prepare('SELECT * FROM visitor_sessions WHERE session_token = ?').get(sessionToken);
    if (!session || session.conversation_id !== conversationId) {
      return res.status(403).json({ error: 'Invalid session for this conversation' });
    }

    if (!text && !attachment) {
      return res.status(400).json({ error: 'Message text or attachment is required' });
    }

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Insert message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_type, sender_id, text, status, created_at)
      VALUES (?, ?, 'visitor', ?, ?, 'sent', CURRENT_TIMESTAMP)
    `).run(messageId, conversationId, session.contact_id, text || '');

    // Insert attachment if present
    if (attachment) {
      const attId = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      db.prepare(`
        INSERT INTO message_attachments (id, message_id, file_name, file_url, file_type, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        attId,
        messageId,
        attachment.file_name,
        attachment.file_url,
        attachment.file_type || 'document',
        attachment.file_size || 0,
        attachment.mime_type || ''
      );
    }

    // Update conversation metadata
    db.prepare(`
      UPDATE conversations 
      SET last_message_at = CURRENT_TIMESTAMP,
          unread_admin_count = unread_admin_count + 1,
          status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);

    // Update contact last contact at
    db.prepare(`
      UPDATE contacts 
      SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(session.contact_id);

    // Fetch full message with attachments
    const rawMessage = db.prepare(`
      SELECT m.*, 
             json_group_array(
               json_object(
                 'id', a.id,
                 'file_name', a.file_name,
                 'file_url', a.file_url,
                 'file_type', a.file_type,
                 'file_size', a.file_size,
                 'mime_type', a.mime_type
               )
             ) FILTER (WHERE a.id IS NOT NULL) as attachments
      FROM messages m
      LEFT JOIN message_attachments a ON m.id = a.message_id
      WHERE m.id = ?
      GROUP BY m.id
    `).get(messageId);

    const message = {
      ...rawMessage,
      attachments: rawMessage.attachments ? JSON.parse(rawMessage.attachments) : []
    };

    const convData = db.prepare(`
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.id = ?
    `).get(conversationId);

    // Emit live event to both visitor and admin dashboard
    emitNewMessage(conversationId, message, convData);

    // Trigger keyword automation if text exists
    if (text) {
      triggerKeywordAutomations(conversationId, text);
    }

    res.json({ message });
  } catch (error) {
    console.error('Send visitor message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 4. Mark Messages Read by Visitor
router.post('/mark-read/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    db.prepare(`
      UPDATE messages 
      SET status = 'read' 
      WHERE conversation_id = ? AND sender_type != 'visitor'
    `).run(conversationId);

    db.prepare('UPDATE conversations SET unread_user_count = 0 WHERE id = ?').run(conversationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
