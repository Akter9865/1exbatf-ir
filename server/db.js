import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'chat_crm.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency and enforce foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDB() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
  seedInitialData();
  return db;
}

function seedInitialData() {
  // 1. Seed Super Admin User if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminId = 'usr_admin_' + Date.now();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, avatar_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'admin@1xbetfair.com',
      passwordHash,
      'Akter (Super Admin)',
      'super_admin',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      'active'
    );
    console.log('✅ Seeded default Super Admin user: admin@1xbetfair.com / admin123');
  }

  // 2. Seed Pipeline Stages
  const stageCount = db.prepare('SELECT COUNT(*) as count FROM pipeline_stages').get().count;
  if (stageCount === 0) {
    const defaultStages = [
      { id: 'stage_1', name: 'New', order: 1, color: '#3b82f6' },
      { id: 'stage_2', name: 'Contacted', order: 2, color: '#06b6d4' },
      { id: 'stage_3', name: 'Qualified', order: 3, color: '#8b5cf6' },
      { id: 'stage_4', name: 'Follow Up', order: 4, color: '#f59e0b' },
      { id: 'stage_5', name: 'Negotiation', order: 5, color: '#ec4899' },
      { id: 'stage_6', name: 'Won', order: 6, color: '#10b981' },
      { id: 'stage_7', name: 'Lost', order: 7, color: '#ef4444' },
    ];

    const insertStage = db.prepare(`
      INSERT INTO pipeline_stages (id, name, order_index, color)
      VALUES (@id, @name, @order, @color)
    `);

    for (const stage of defaultStages) {
      insertStage.run(stage);
    }
    console.log('✅ Seeded default pipeline stages');
  }

  // 3. Seed Lead Sources
  const sourceCount = db.prepare('SELECT COUNT(*) as count FROM lead_sources').get().count;
  if (sourceCount === 0) {
    const sources = ['Website', 'Facebook', 'Instagram', 'Google Ads', 'Referral', 'WhatsApp', 'Direct'];
    const insertSource = db.prepare('INSERT OR IGNORE INTO lead_sources (id, name) VALUES (?, ?)');
    sources.forEach((src, idx) => {
      insertSource.run(`src_${idx + 1}`, src);
    });
  }

  // 4. Seed Tags
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get().count;
  if (tagCount === 0) {
    const tags = [
      { id: 'tag_hot', name: 'Hot Lead', color: '#ef4444' },
      { id: 'tag_vip', name: 'VIP', color: '#8b5cf6' },
      { id: 'tag_interested', name: 'Interested', color: '#10b981' },
      { id: 'tag_followup', name: 'Follow Up', color: '#f59e0b' },
      { id: 'tag_budget', name: 'High Budget', color: '#06b6d4' },
      { id: 'tag_web', name: 'Website Lead', color: '#64748b' },
    ];
    const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)');
    tags.forEach(t => insertTag.run(t));
    console.log('✅ Seeded default tags');
  }

  // 5. Seed Quick Replies
  const qrCount = db.prepare('SELECT COUNT(*) as count FROM quick_replies').get().count;
  if (qrCount === 0) {
    const quickReplies = [
      {
        id: 'qr_1',
        shortcut: 'hello',
        title: 'Welcome Greeting',
        message: 'Hello! Thanks for contacting us. How can we help you today?'
      },
      {
        id: 'qr_2',
        shortcut: 'price',
        title: 'Pricing Packages',
        message: 'Our pricing plans are flexible to suit your needs. Would you like a detailed breakdown of our packages?'
      },
      {
        id: 'qr_3',
        shortcut: 'support',
        title: 'Support Review',
        message: 'Our support team is reviewing your request right now. Please hold on for just a moment.'
      },
      {
        id: 'qr_4',
        shortcut: 'hours',
        title: 'Working Hours',
        message: 'Our live support is available 24/7. Feel free to ask any question at any time!'
      },
      {
        id: 'qr_5',
        shortcut: 'thanks',
        title: 'Thank You Message',
        message: 'Thank you for reaching out! Please let us know if you need any further assistance.'
      }
    ];

    const insertQr = db.prepare('INSERT INTO quick_replies (id, shortcut, title, message) VALUES (@id, @shortcut, @title, @message)');
    quickReplies.forEach(qr => insertQr.run(qr));
    console.log('✅ Seeded default quick replies');
  }

  // 6. Seed Automations
  const autoCount = db.prepare('SELECT COUNT(*) as count FROM automations').get().count;
  if (autoCount === 0) {
    const automations = [
      {
        id: 'auto_welcome',
        title: 'Automatic Welcome Message',
        trigger_type: 'new_conversation',
        condition_value: '',
        action_type: 'send_message',
        action_payload: 'Hello! Welcome to Guru Anna. How can we help you today?',
        is_active: 1
      },
      {
        id: 'auto_kw_price',
        title: 'Price Inquiry Auto-Reply',
        trigger_type: 'keyword_match',
        condition_value: 'price',
        action_type: 'send_message',
        action_payload: 'Sure! Please tell us which product or tier you are interested in, and we will provide the best offer.',
        is_active: 1
      },
      {
        id: 'auto_kw_help',
        title: 'Help / Support Keyword',
        trigger_type: 'keyword_match',
        condition_value: 'help',
        action_type: 'send_message',
        action_payload: 'Our agent is right here with you! Could you describe your requirement in detail?',
        is_active: 1
      },
      {
        id: 'auto_offline',
        title: 'Offline Hours Auto-Reply',
        trigger_type: 'agent_offline',
        condition_value: '',
        action_type: 'send_message',
        action_payload: 'Our team is currently away from the desk. Please leave your query and phone number; we will get back to you shortly!',
        is_active: 1
      },
      {
        id: 'auto_closed',
        title: 'Conversation Closed Message',
        trigger_type: 'conversation_closed',
        condition_value: '',
        action_type: 'send_message',
        action_payload: 'This conversation has been closed. Have a wonderful day, and feel free to start a new chat anytime!',
        is_active: 1
      }
    ];

    const insertAuto = db.prepare(`
      INSERT INTO automations (id, title, trigger_type, condition_value, action_type, action_payload, is_active)
      VALUES (@id, @title, @trigger_type, @condition_value, @action_type, @action_payload, @is_active)
    `);
    automations.forEach(a => insertAuto.run(a));
    console.log('✅ Seeded default automations');
  }

  // 7. Seed Settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    const defaultSettings = [
      { key: 'brand_name', value: 'Guru Anna' },
      { key: 'agent_name', value: 'Customer Support' },
      { key: 'agent_avatar', value: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
      { key: 'agent_status', value: 'Online' },
      { key: 'welcome_message', value: 'Hello! Welcome to Guru Anna. How can we help you today?' },
      { key: 'chat_availability', value: 'Online' },
      { key: 'sound_enabled', value: 'true' },
      { key: 'lead_capture_required', value: 'true' },
    ];

    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
    defaultSettings.forEach(s => insertSetting.run(s));
    console.log('✅ Seeded default settings');
  }
}

export default db;
