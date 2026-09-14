import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { emitNewMessage } from '../services/socketService.js';
import { saveMessageToSupabase } from '../services/supabaseDataService.js';

const router = express.Router();
router.use(authenticateToken);

// 1. Admin / Agent Sends Message
router.post('/', async (req, res) => {
  try {
    const { conversationId, text, attachment } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    if (!text && !attachment) {
      return res.status(400).json({ error: 'Message text or attachment is required' });
    }

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_type, sender_id, text, status, created_at)
      VALUES (?, ?, 'agent', ?, ?, 'delivered', CURRENT_TIMESTAMP)
    `).run(messageId, conversationId, req.user.id, text || '');

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
          unread_user_count = unread_user_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);

    // Update contact last contact time
    db.prepare(`
      UPDATE contacts 
      SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conv.contact_id);

    // Save to live Supabase Cloud Database
    saveMessageToSupabase({
      id: messageId,
      conversation_id: conversationId,
      sender_type: 'agent',
      sender_id: req.user.id,
      text: text || '',
      status: 'delivered',
      created_at: new Date().toISOString()
    }, attachment).catch(() => {});

    // Fetch full message
    const rawMessage = db.prepare(`
      SELECT m.*, 
             u.name as agent_name,
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
      LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'agent'
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

    emitNewMessage(conversationId, message, convData);

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 2. Global Message Search
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ messages: [] });
    }

    const messages = db.prepare(`
      SELECT m.*, c.contact_id, ct.name as contact_name, ct.phone as contact_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE m.text LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `).all(`%${q.trim()}%`);

    res.json({ messages });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

export default router;
