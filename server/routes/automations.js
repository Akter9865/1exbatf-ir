import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authenticateToken);

// List automations
router.get('/', (req, res) => {
  try {
    const automations = db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all();
    res.json({ automations });
  } catch (error) {
    console.error('List automations error:', error);
    res.status(500).json({ error: 'Failed to retrieve automations' });
  }
});

// Create automation
router.post('/', (req, res) => {
  try {
    const { title, trigger_type, condition_value = '', action_type = 'send_message', action_payload, is_active = 1 } = req.body;

    if (!title || !trigger_type || !action_payload) {
      return res.status(400).json({ error: 'Title, Trigger Type, and Action Message are required' });
    }

    const id = 'auto_' + Date.now();
    db.prepare(`
      INSERT INTO automations (id, title, trigger_type, condition_value, action_type, action_payload, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title.trim(), trigger_type, condition_value ? condition_value.trim().toLowerCase() : '', action_type, action_payload.trim(), is_active ? 1 : 0);

    const created = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
    res.status(201).json({ automation: created });
  } catch (error) {
    console.error('Create automation error:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

// Update automation
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, trigger_type, condition_value, action_type, action_payload, is_active } = req.body;

    db.prepare(`
      UPDATE automations 
      SET title = COALESCE(?, title),
          trigger_type = COALESCE(?, trigger_type),
          condition_value = COALESCE(?, condition_value),
          action_type = COALESCE(?, action_type),
          action_payload = COALESCE(?, action_payload),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      trigger_type || null,
      condition_value !== undefined ? condition_value.trim().toLowerCase() : null,
      action_type || null,
      action_payload ? action_payload.trim() : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
    res.json({ automation: updated });
  } catch (error) {
    console.error('Update automation error:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// Toggle active status
router.patch('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const rule = db.prepare('SELECT is_active FROM automations WHERE id = ?').get(id);
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    const nextState = rule.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE automations SET is_active = ? WHERE id = ?').run(nextState, id);

    res.json({ success: true, is_active: nextState });
  } catch (error) {
    console.error('Toggle automation error:', error);
    res.status(500).json({ error: 'Failed to toggle automation' });
  }
});

// Delete automation
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM automations WHERE id = ?').run(id);
    res.json({ success: true, message: 'Automation deleted' });
  } catch (error) {
    console.error('Delete automation error:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

export default router;
