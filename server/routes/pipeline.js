import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { emitContactUpdated } from '../services/socketService.js';

const router = express.Router();
router.use(authenticateToken);

// 1. Get Pipeline Stages and Cards for Kanban Board
router.get('/', (req, res) => {
  try {
    const stages = db.prepare('SELECT * FROM pipeline_stages ORDER BY order_index ASC').all();

    const contactsQuery = `
      SELECT 
        ct.id, ct.name, ct.phone, ct.email, ct.lead_status, ct.pipeline_stage_id, ct.last_contact_at,
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
          SELECT c.id FROM conversations c WHERE c.contact_id = ct.id ORDER BY c.last_message_at DESC LIMIT 1
        ) as conversation_id,
        (
          SELECT m.text FROM messages m 
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.contact_id = ct.id
          ORDER BY m.created_at DESC LIMIT 1
        ) as last_message_text
      FROM contacts ct
      LEFT JOIN users u ON ct.assigned_agent_id = u.id
      ORDER BY ct.last_contact_at DESC
    `;

    const rawContacts = db.prepare(contactsQuery).all();

    const contactsByStage = {};
    stages.forEach(s => {
      contactsByStage[s.id] = [];
    });

    rawContacts.forEach(c => {
      const formatted = {
        ...c,
        tags: c.tags_json ? JSON.parse(c.tags_json) : []
      };
      if (c.pipeline_stage_id && contactsByStage[c.pipeline_stage_id]) {
        contactsByStage[c.pipeline_stage_id].push(formatted);
      } else if (stages.length > 0) {
        // Put in first stage if unassigned
        contactsByStage[stages[0].id].push(formatted);
      }
    });

    res.json({
      stages,
      pipeline: contactsByStage
    });
  } catch (error) {
    console.error('Get pipeline error:', error);
    res.status(500).json({ error: 'Failed to retrieve pipeline data' });
  }
});

// 2. Move Contact to a Different Pipeline Stage
router.post('/move', (req, res) => {
  try {
    const { contactId, newStageId } = req.body;

    if (!contactId || !newStageId) {
      return res.status(400).json({ error: 'contactId and newStageId are required' });
    }

    const stage = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(newStageId);
    if (!stage) {
      return res.status(404).json({ error: 'Pipeline stage not found' });
    }

    // Automatically synchronize lead_status if stage matches status naming
    let leadStatus = null;
    const stageName = stage.name.toLowerCase();
    if (stageName.includes('won')) leadStatus = 'Won';
    else if (stageName.includes('lost')) leadStatus = 'Lost';
    else if (stageName.includes('qualif')) leadStatus = 'Qualified';
    else if (stageName.includes('contact')) leadStatus = 'Contacted';
    else if (stageName.includes('follow')) leadStatus = 'Follow-up';
    else if (stageName.includes('negotiat')) leadStatus = 'Negotiation';

    if (leadStatus) {
      db.prepare(`
        UPDATE contacts 
        SET pipeline_stage_id = ?, lead_status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newStageId, leadStatus, contactId);
    } else {
      db.prepare(`
        UPDATE contacts 
        SET pipeline_stage_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newStageId, contactId);
    }

    emitContactUpdated(contactId, { pipeline_stage_id: newStageId, lead_status: leadStatus });

    res.json({ success: true, contactId, newStageId, leadStatus });
  } catch (error) {
    console.error('Move pipeline stage error:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// 3. Create Custom Pipeline Stage
router.post('/stages', (req, res) => {
  try {
    const { name, color = '#3b82f6' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    const maxOrder = db.prepare('SELECT MAX(order_index) as max_order FROM pipeline_stages').get().max_order || 0;
    const stageId = 'stage_' + Date.now();

    db.prepare(`
      INSERT INTO pipeline_stages (id, name, order_index, color)
      VALUES (?, ?, ?, ?)
    `).run(stageId, name.trim(), maxOrder + 1, color);

    const created = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(stageId);
    res.status(201).json({ stage: created });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

export default router;
