import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { emitContactUpdated } from '../services/socketService.js';
import { getContactsFromSupabase, saveContactToSupabase } from '../services/supabaseDataService.js';
import { getSupabase } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

// 1. List / Search Contacts with Multi-Filters & Pagination
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      stage = '',
      tag = '',
      agent = '',
      source = '',
      from_date = '',
      to_date = '',
      sort_by = 'last_contact_at',
      sort_order = 'DESC',
      page = 1,
      limit = 50
    } = req.query;

    // Check live Supabase Cloud Database first (for cross-container persistence on Vercel)
    const supabaseData = await getContactsFromSupabase({ search, status, stage, page, limit });
    if (supabaseData && supabaseData.contacts) {
      const localCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get()?.count || 0;
      if (supabaseData.contacts.length > 0 || localCount === 0) {
        return res.json({
          contacts: supabaseData.contacts,
          pagination: {
            total: supabaseData.total,
            page: supabaseData.page,
            limit: supabaseData.limit,
            totalPages: supabaseData.totalPages
          }
        });
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        ct.*,
        ps.name as pipeline_stage_name, ps.color as pipeline_stage_color,
        u.name as assigned_agent_name, u.avatar_url as assigned_agent_avatar,
        (
          SELECT json_group_array(
            json_object('id', t.id, 'name', t.name, 'color', t.color)
          )
          FROM contact_tags ctag
          JOIN tags t ON ctag.tag_id = t.id
          WHERE ctag.contact_id = ct.id
        ) as tags_json,
        (
          SELECT c.id FROM conversations c 
          WHERE c.contact_id = ct.id 
          ORDER BY c.last_message_at DESC LIMIT 1
        ) as conversation_id
      FROM contacts ct
      LEFT JOIN pipeline_stages ps ON ct.pipeline_stage_id = ps.id
      LEFT JOIN users u ON ct.assigned_agent_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (search && search.trim()) {
      query += ` AND (ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (status) {
      query += ` AND ct.lead_status = ?`;
      params.push(status);
    }

    if (stage) {
      query += ` AND ct.pipeline_stage_id = ?`;
      params.push(stage);
    }

    if (agent) {
      query += ` AND ct.assigned_agent_id = ?`;
      params.push(agent);
    }

    if (source) {
      query += ` AND ct.lead_source = ?`;
      params.push(source);
    }

    if (tag) {
      query += ` AND EXISTS (
        SELECT 1 FROM contact_tags ctag WHERE ctag.contact_id = ct.id AND ctag.tag_id = ?
      )`;
      params.push(tag);
    }

    if (from_date) {
      query += ` AND ct.created_at >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND ct.created_at <= ?`;
      params.push(to_date + ' 23:59:59');
    }

    // Total count query
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    // Sorting & Pagination
    const validSortFields = ['name', 'created_at', 'last_contact_at', 'lead_status'];
    const finalSortBy = validSortFields.includes(sort_by) ? sort_by : 'last_contact_at';
    const finalSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ct.${finalSortBy} ${finalSortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = db.prepare(query).all(...params);

    const contacts = rows.map(r => ({
      ...r,
      tags: r.tags_json ? JSON.parse(r.tags_json) : []
    }));

    res.json({
      contacts,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

// 2. Get Single Contact with Notes and Conversations
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const contact = db.prepare(`
      SELECT 
        ct.*,
        ps.name as pipeline_stage_name, ps.color as pipeline_stage_color,
        u.name as assigned_agent_name, u.avatar_url as assigned_agent_avatar
      FROM contacts ct
      LEFT JOIN pipeline_stages ps ON ct.pipeline_stage_id = ps.id
      LEFT JOIN users u ON ct.assigned_agent_id = u.id
      WHERE ct.id = ?
    `).get(id);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN contact_tags ct ON t.id = ct.tag_id
      WHERE ct.contact_id = ?
    `).all(id);

    const notes = db.prepare(`
      SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.contact_id = ?
      ORDER BY n.created_at DESC
    `).all(id);

    const conversation = db.prepare(`
      SELECT * FROM conversations 
      WHERE contact_id = ? 
      ORDER BY last_message_at DESC LIMIT 1
    `).get(id);

    res.json({
      contact: {
        ...contact,
        tags
      },
      notes,
      conversation
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to retrieve contact' });
  }
});

// 3. Create Contact Manually
router.post('/', (req, res) => {
  try {
    const { name, phone, email, lead_source = 'Direct', lead_status = 'New Lead', pipeline_stage_id, assigned_agent_id, tags = [] } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and Phone are required' });
    }

    const contactId = 'cnt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');

    db.prepare(`
      INSERT INTO contacts (id, name, phone, email, lead_source, lead_status, pipeline_stage_id, assigned_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contactId, name.trim(), cleanPhone, email ? email.trim() : null, lead_source, lead_status, pipeline_stage_id || null, assigned_agent_id || null);

    // Create conversation for this contact
    const convId = 'cnv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    db.prepare("INSERT INTO conversations (id, contact_id, status) VALUES (?, ?, 'open')").run(convId, contactId);

    // Insert tags
    if (Array.isArray(tags) && tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)');
      tags.forEach(tId => insertTag.run(contactId, tId));
    }

    const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
    saveContactToSupabase(created).catch(() => {});
    res.status(201).json({ contact: created });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// 4. Update Contact
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, lead_source, lead_status, pipeline_stage_id, assigned_agent_id, avatar_url } = req.body;

    db.prepare(`
      UPDATE contacts 
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          email = ?,
          lead_source = COALESCE(?, lead_source),
          lead_status = COALESCE(?, lead_status),
          pipeline_stage_id = ?,
          assigned_agent_id = ?,
          avatar_url = COALESCE(?, avatar_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      phone ? phone.trim().replace(/[^\d+]/g, '') : null,
      email ? email.trim() : null,
      lead_source || null,
      lead_status || null,
      pipeline_stage_id || null,
      assigned_agent_id || null,
      avatar_url || null,
      id
    );

    // Also update conversation assigned agent if updated here
    if (assigned_agent_id !== undefined) {
      db.prepare('UPDATE conversations SET assigned_agent_id = ? WHERE contact_id = ?').run(assigned_agent_id || null, id);
    }

    emitContactUpdated(id, { lead_status, pipeline_stage_id, assigned_agent_id });

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (updated) {
      saveContactToSupabase(updated).catch(() => {});
    }
    res.json({ contact: updated });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// 5. Delete Contact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('contacts').delete().eq('id', id).catch(() => {});
    }

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// 6. Add Tag to Contact
router.post('/:id/tags', (req, res) => {
  try {
    const { id } = req.params;
    const { tagId } = req.body;

    if (!tagId) return res.status(400).json({ error: 'tagId is required' });

    db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)').run(id, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Add tag error:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// 7. Remove Tag from Contact
router.delete('/:id/tags/:tagId', (req, res) => {
  try {
    const { id, tagId } = req.params;
    db.prepare('DELETE FROM contact_tags WHERE contact_id = ? AND tag_id = ?').run(id, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// 8. Add Internal Note
router.post('/:id/notes', (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Note content cannot be empty' });
    }

    const noteId = 'not_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    db.prepare(`
      INSERT INTO notes (id, contact_id, author_id, author_name, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(noteId, id, req.user.id, req.user.name, content.trim());

    const createdNote = db.prepare(`
      SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?
    `).get(noteId);

    res.status(201).json({ note: createdNote });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// 9. Get Notes
router.get('/:id/notes', (req, res) => {
  try {
    const { id } = req.params;
    const notes = db.prepare(`
      SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.contact_id = ?
      ORDER BY n.created_at DESC
    `).all(id);

    res.json({ notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

export default router;
