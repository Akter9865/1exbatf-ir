import db from '../db.js';
import { emitNewMessage } from './socketService.js';

export function triggerNewConversationAutomations(conversationId, contactId) {
  try {
    // 1. Check if agent is set to offline in settings
    const agentStatusSetting = db.prepare("SELECT value FROM settings WHERE key = 'agent_status'").get();
    const isOffline = agentStatusSetting && agentStatusSetting.value.toLowerCase() === 'offline';

    if (isOffline) {
      const offlineRules = db.prepare(`
        SELECT * FROM automations 
        WHERE trigger_type = 'agent_offline' AND is_active = 1
      `).all();

      for (const rule of offlineRules) {
        dispatchAutomatedMessage(conversationId, rule.action_payload, 'offline_bot');
      }
      return;
    }

    // 2. Standard new conversation welcome message
    const welcomeRules = db.prepare(`
      SELECT * FROM automations 
      WHERE trigger_type = 'new_conversation' AND is_active = 1
    `).all();

    for (const rule of welcomeRules) {
      dispatchAutomatedMessage(conversationId, rule.action_payload, 'welcome_bot');
    }
  } catch (error) {
    console.error('Error executing new conversation automations:', error);
  }
}

export function triggerKeywordAutomations(conversationId, text) {
  if (!text || typeof text !== 'string') return;

  try {
    const lowerText = text.toLowerCase().trim();
    const keywordRules = db.prepare(`
      SELECT * FROM automations 
      WHERE trigger_type = 'keyword_match' AND is_active = 1
    `).all();

    for (const rule of keywordRules) {
      const kw = (rule.condition_value || '').toLowerCase().trim();
      if (kw && lowerText.includes(kw)) {
        // Debounce slightly or send automatic response
        setTimeout(() => {
          dispatchAutomatedMessage(conversationId, rule.action_payload, 'keyword_bot');
        }, 600);
        break; // Match first priority keyword
      }
    }
  } catch (error) {
    console.error('Error executing keyword automations:', error);
  }
}

export function triggerConversationClosedAutomations(conversationId) {
  try {
    const closedRules = db.prepare(`
      SELECT * FROM automations 
      WHERE trigger_type = 'conversation_closed' AND is_active = 1
    `).all();

    for (const rule of closedRules) {
      dispatchAutomatedMessage(conversationId, rule.action_payload, 'close_bot');
    }
  } catch (error) {
    console.error('Error executing conversation closed automations:', error);
  }
}

function dispatchAutomatedMessage(conversationId, text, botType = 'bot') {
  const messageId = 'msg_auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, text, status, created_at)
    VALUES (?, ?, 'system', ?, ?, 'delivered', CURRENT_TIMESTAMP)
  `);

  insertMsg.run(messageId, conversationId, botType, text);

  // Update conversation
  db.prepare(`
    UPDATE conversations 
    SET last_message_at = CURRENT_TIMESTAMP,
        unread_user_count = unread_user_count + 1
    WHERE id = ?
  `).run(conversationId);

  const fullMessage = db.prepare(`
    SELECT m.*, NULL as attachments
    FROM messages m
    WHERE m.id = ?
  `).get(messageId);

  const convData = db.prepare(`
    SELECT c.*, ct.name as contact_name, ct.phone as contact_phone
    FROM conversations c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.id = ?
  `).get(conversationId);

  emitNewMessage(conversationId, fullMessage, convData);
}
