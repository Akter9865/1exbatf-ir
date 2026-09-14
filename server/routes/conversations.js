import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { emitConversationStatusChanged } from '../services/socketService.js';
import { triggerConversationClosedAutomations } from '../services/automationEngine.js';

const router = express.Router();
router.use(authenticateToken);

// 1. List Conversations for Admin Inbox
router.get('/', (req, res) => {
  try {
    const { status = 'all', unread = 'false', search = '', limit = 100, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        c.id, c.contact_id, c.status, c.unread_admin_count, c.unread_user_count, 
        c.last_message_at, c.created_at, c.assigned_agent_id,
        ct.name as contact_name, ct.phone as contact_phone, ct.email as contact_email,
        ct.avatar_url as contact_avatar, ct.lead_status, ct.lead_source,
        ps.id as pipeline_stage_id, ps.name as pipeline_stage_name, ps.color as pipeline_stage_color,
        u.name as assigned_agent_name, u.avatar_url as assigned_agent_avatar,
        (
          SELECT json_group_array(
            json_object('id', t.id, 'name', t.name, 'color', t.color)
          )
          FROM contact_tags ctag
          JOIN tags t ON ctag.tag_id = t.id
          WHERE ctag.contact_id = c.contact_id
        ) as tags_json,
        (
          SELECT json_object(
            'id', m.id,
            'text', m.text,
            'sender_type', m.sender_type,
            'status', m.status,
            'created_at', m.created_at,
            'has_attachment', EXISTS(SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id)
          )
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message_json
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN pipeline_stages ps ON ct.pipeline_stage_id = ps.id
      LEFT JOIN users u ON c.assigned_agent_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Role-based filtering: standard agents only see conversations assigned to them or unassigned
    if (req.user.role === 'agent') {
      query += ` AND (c.assigned_agent_id = ? OR c.assigned_agent_id IS NULL)`;
      params.push(req.user.id);
    }

    if (status !== 'all') {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    if (unread === 'true') {
      query += ` AND c.unread_admin_count > 0`;
    }

    if (search && search.trim()) {
      query += ` AND (ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = db.prepare(query).all(...params);

    const conversations = rows.map(r => ({
      ...r,
      tags: r.tags_json ? JSON.parse(r.tags_json) : [],
      last_message: r.last_message_json ? JSON.parse(r.last_message_json) : null
    }));

    res.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// 2. Get Single Conversation with Complete History, Contact Details, and Notes
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const conv = db.prepare(`
      SELECT 
        c.*, 
        ct.name as contact_name, ct.phone as contact_phone, ct.email as contact_email,
        ct.avatar_url as contact_avatar, ct.lead_status, ct.lead_source, ct.created_at as contact_created_at,
        ps.id as pipeline_stage_id, ps.name as pipeline_stage_name, ps.color as pipeline_stage_color,
        u.name as assigned_agent_name, u.avatar_url as assigned_agent_avatar
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN pipeline_stages ps ON ct.pipeline_stage_id = ps.id
      LEFT JOIN users u ON c.assigned_agent_id = u.id
      WHERE c.id = ?
    `).get(id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Fetch messages
    const rawMessages = db.prepare(`
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
      WHERE m.conversation_id = ?
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `).all(id);

    const messages = rawMessages.map(m => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : []
    }));

    // Fetch tags
    const tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN contact_tags ct ON t.id = ct.tag_id
      WHERE ct.contact_id = ?
    `).all(conv.contact_id);

    // Fetch internal notes
    const notes = db.prepare(`
      SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.contact_id = ?
      ORDER BY n.created_at DESC
    `).all(conv.contact_id);

    res.json({
      conversation: {
        ...conv,
        tags
      },
      messages,
      notes
    });
  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation details' });
  }
});

// 3. Update Conversation Status (open, pending, closed, archived)
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['open', 'pending', 'closed', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    db.prepare('UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

    emitConversationStatusChanged(id, status);

    if (status === 'closed') {
      triggerConversationClosedAutomations(id);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update conversation status' });
  }
});

// 4. Assign Agent to Conversation
router.patch('/:id/assign', (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    db.prepare('UPDATE conversations SET assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(agentId || null, id);

    const conv = db.prepare('SELECT contact_id FROM conversations WHERE id = ?').get(id);
    if (conv) {
      db.prepare('UPDATE contacts SET assigned_agent_id = ? WHERE id = ?').run(agentId || null, conv.contact_id);
    }

    res.json({ success: true, assigned_agent_id: agentId });
  } catch (error) {
    console.error('Assign agent error:', error);
    res.status(500).json({ error: 'Failed to assign agent' });
  }
});

// 5. Mark Conversation as Read by Admin
router.post('/:id/mark-read', (req, res) => {
  try {
    const { id } = req.params;

    db.prepare(`
      UPDATE messages 
      SET status = 'read' 
      WHERE conversation_id = ? AND sender_type = 'visitor'
    `).run(id);

    db.prepare('UPDATE conversations SET unread_admin_count = 0 WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

export default router;
