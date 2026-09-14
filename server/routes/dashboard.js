import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getContactsFromSupabase, getConversationsFromSupabase } from '../services/supabaseDataService.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/metrics', async (req, res) => {
  try {
    // Sync fresh contacts and conversations from Supabase Cloud DB
    try {
      await getContactsFromSupabase({ limit: 100 });
      await getConversationsFromSupabase('all');
    } catch (e) {}

    const totalContacts = db.prepare('SELECT COUNT(*) as count FROM contacts').get()?.count || 0;

    const newLeadsToday = db.prepare(`
      SELECT COUNT(*) as count FROM contacts 
      WHERE DATE(created_at) = DATE('now')
    `).get().count;

    const newLeadsThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM contacts 
      WHERE created_at >= DATETIME('now', '-7 days')
    `).get().count;

    const openConversations = db.prepare(`
      SELECT COUNT(*) as count FROM conversations WHERE status = 'open'
    `).get().count;

    const unreadConversations = db.prepare(`
      SELECT COUNT(*) as count FROM conversations WHERE unread_admin_count > 0
    `).get().count;

    const qualifiedLeads = db.prepare(`
      SELECT COUNT(*) as count FROM contacts WHERE LOWER(lead_status) = 'qualified'
    `).get().count;

    const wonLeads = db.prepare(`
      SELECT COUNT(*) as count FROM contacts WHERE LOWER(lead_status) = 'won'
    `).get().count;

    const lostLeads = db.prepare(`
      SELECT COUNT(*) as count FROM contacts WHERE LOWER(lead_status) = 'lost'
    `).get().count;

    // 2. Leads Over Time (Past 7 Days)
    const leadsOverTime = [];
    for (let i = 6; i >= 0; i--) {
      const row = db.prepare(`
        SELECT COUNT(*) as count, DATE('now', '-' || ? || ' days') as date 
        FROM contacts 
        WHERE DATE(created_at) = DATE('now', '-' || ? || ' days')
      `).get(i, i);
      leadsOverTime.push({
        date: row.date,
        count: row.count
      });
    }

    // 3. Pipeline Distribution
    const pipelineDistribution = db.prepare(`
      SELECT ps.id, ps.name, ps.color, COUNT(ct.id) as count
      FROM pipeline_stages ps
      LEFT JOIN contacts ct ON ps.id = ct.pipeline_stage_id
      GROUP BY ps.id
      ORDER BY ps.order_index ASC
    `).all();

    // 4. Lead Source Breakdown
    const leadSources = db.prepare(`
      SELECT COALESCE(lead_source, 'Direct') as source, COUNT(*) as count
      FROM contacts
      GROUP BY lead_source
      ORDER BY count DESC
    `).all();

    // 5. Recent Activity
    const recentActivity = db.prepare(`
      SELECT 
        'message' as type,
        m.id, m.text, m.sender_type, m.created_at,
        ct.name as contact_name, ct.phone as contact_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      ORDER BY m.created_at DESC
      LIMIT 6
    `).all();

    res.json({
      metrics: {
        totalContacts,
        newLeadsToday,
        newLeadsThisWeek,
        openConversations,
        unreadConversations,
        qualifiedLeads,
        wonLeads,
        lostLeads
      },
      leadsOverTime,
      pipelineDistribution,
      leadSources,
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics' });
  }
});

export default router;
