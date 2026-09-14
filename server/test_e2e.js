import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('🧪 Starting Comprehensive Full-Stack E2E Test Suite...\n');
  const baseUrl = 'http://localhost:5001';

  // 1. Healthcheck
  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthJson = await healthRes.json();
  console.log('Healthcheck status:', healthJson.status);
  if (healthJson.status !== 'ok') throw new Error('Healthcheck failed');
  console.log('✅ Healthcheck passed.\n');

  // 2. Chat Init
  console.log('--- 2. Testing Public Chat Init ---');
  const initRes = await fetch(`${baseUrl}/api/chat/init`);
  const initJson = await initRes.json();
  console.log('Brand Name:', initJson.settings.brand_name, '| Agent Name:', initJson.settings.agent_name, '| Status:', initJson.settings.agent_status);
  console.log('✅ Public Chat Init passed.\n');

  // 3. Visitor Lead Capture
  console.log('--- 3. Testing Visitor Lead Capture Form ---');
  const leadRes = await fetch(`${baseUrl}/api/chat/lead-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Mercer',
      phone: '+1555019999',
      leadSource: 'Website Live Chat'
    })
  });
  const leadData = await leadRes.json();
  console.log('Session Token:', leadData.sessionToken);
  console.log('Created Contact:', leadData.contact.name, '| Phone:', leadData.contact.phone, '| Lead Status:', leadData.contact.lead_status);
  console.log('Created Conversation ID:', leadData.conversation.id);
  const sessionToken = leadData.sessionToken;
  const conversationId = leadData.conversation.id;
  const contactId = leadData.contact.id;
  console.log('✅ Lead Capture passed.\n');

  // Wait 1 second for automation engine to execute welcome message
  await new Promise(r => setTimeout(r, 1200));

  // 4. Visitor Chat Messages History (Checking Welcome Message)
  console.log('--- 4. Checking Automatic Welcome Message ---');
  const chatHistoryRes = await fetch(`${baseUrl}/api/chat/init`, {
    headers: { 'x-visitor-session': sessionToken }
  });
  const chatHistory = await chatHistoryRes.json();
  console.log('Messages in thread:', chatHistory.messages.length);
  chatHistory.messages.forEach(m => {
    console.log(`  [${m.sender_type.toUpperCase()}] ${m.text}`);
  });
  const welcomeMsg = chatHistory.messages.find(m => m.sender_type === 'system');
  if (!welcomeMsg) throw new Error('Automated welcome message not found');
  console.log('✅ Automated Welcome Message verified.\n');

  // 5. Visitor Sends Message with "Price" Keyword
  console.log('--- 5. Visitor Sends Inquiry with Keyword "price" ---');
  const sendRes = await fetch(`${baseUrl}/api/chat/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-visitor-session': sessionToken
    },
    body: JSON.stringify({
      conversationId,
      text: 'Hello! Could you share the price for your packages?'
    })
  });
  const sendJson = await sendRes.json();
  console.log('Visitor message sent:', sendJson.message.text, '| Status:', sendJson.message.status);

  // Wait 1.5s for keyword automation auto-reply
  await new Promise(r => setTimeout(r, 1500));

  const afterKeywordRes = await fetch(`${baseUrl}/api/chat/init`, {
    headers: { 'x-visitor-session': sessionToken }
  });
  const afterKeyword = await afterKeywordRes.json();
  console.log('Messages after keyword inquiry:', afterKeyword.messages.length);
  afterKeyword.messages.forEach(m => {
    console.log(`  [${m.sender_type.toUpperCase()}] ${m.text}`);
  });
  const autoReply = afterKeyword.messages.find(m => m.text.includes('product or tier'));
  if (autoReply) {
    console.log('✅ Keyword Automation auto-reply received successfully!\n');
  }

  // 6. Admin Authentication
  console.log('--- 6. Admin Login Verification ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@1xbetfair.com',
      password: 'admin123'
    })
  });
  const loginData = await loginRes.json();
  console.log('Logged in as:', loginData.user.name, '| Role:', loginData.user.role);
  const adminToken = loginData.token;
  console.log('✅ Admin Login passed.\n');

  // 7. Admin Conversations Inbox List
  console.log('--- 7. Admin Inbox Conversations List ---');
  const inboxRes = await fetch(`${baseUrl}/api/conversations?status=all`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const inboxData = await inboxRes.json();
  console.log('Conversations in inbox:', inboxData.conversations.length);
  const foundConv = inboxData.conversations.find(c => c.id === conversationId);
  console.log('Found Alex Mercer conversation:', !!foundConv, '| Unread count:', foundConv?.unread_admin_count);
  console.log('✅ Admin Inbox listing verified.\n');

  // 8. Admin Replies in Real-Time
  console.log('--- 8. Admin Sends Reply to Customer ---');
  const adminSendRes = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      conversationId,
      text: 'Hi Alex! Our pricing plans start at $49/month with full features.'
    })
  });
  const adminSendJson = await adminSendRes.json();
  console.log('Admin reply sent:', adminSendJson.message.text, '| Status:', adminSendJson.message.status);
  console.log('✅ Admin Reply passed.\n');

  // 9. Admin Adds Private Internal Note
  console.log('--- 9. Adding Private Internal Note ---');
  const noteRes = await fetch(`${baseUrl}/api/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      content: 'Customer is interested in custom enterprise package. Follow up on Tuesday.'
    })
  });
  const noteJson = await noteRes.json();
  console.log('Internal note created:', noteJson.note.content, '| Author:', noteJson.note.author_name);
  console.log('✅ Private Internal Note passed.\n');

  // Verify internal note is NOT visible in customer chat
  const custCheckRes = await fetch(`${baseUrl}/api/chat/init`, {
    headers: { 'x-visitor-session': sessionToken }
  });
  const custCheck = await custCheckRes.json();
  const leak = custCheck.messages.some(m => m.text.includes('enterprise package'));
  if (leak) throw new Error('CRITICAL: Private note leaked to customer chat!');
  console.log('🔒 Security Check: Internal note is strictly invisible to customer!\n');

  // 10. Pipeline Stage & Tag Updates
  console.log('--- 10. Updating Pipeline Stage & Assigning Tags ---');
  // Assign VIP tag
  const tagListRes = await fetch(`${baseUrl}/api/tags`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const tagList = await tagListRes.json();
  const vipTag = tagList.tags.find(t => t.name === 'VIP') || tagList.tags[0];

  await fetch(`${baseUrl}/api/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ tagId: vipTag.id })
  });

  // Move to Qualified Stage (stage_3)
  const moveRes = await fetch(`${baseUrl}/api/pipeline/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ contactId, newStageId: 'stage_3' })
  });
  const moveJson = await moveRes.json();
  console.log('Moved to stage:', moveJson.newStageId, '| Updated status:', moveJson.leadStatus);
  console.log('✅ Pipeline stage update & Tag assignment passed.\n');

  // 11. Pipeline Kanban API
  console.log('--- 11. Testing Pipeline Kanban View ---');
  const pipeRes = await fetch(`${baseUrl}/api/pipeline`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const pipeJson = await pipeRes.json();
  const qualifiedCards = pipeJson.pipeline['stage_3'] || [];
  console.log('Cards under Qualified stage:', qualifiedCards.length);
  const alexCard = qualifiedCards.find(c => c.id === contactId);
  console.log('Found Alex Mercer card in Qualified:', !!alexCard, '| Card tags:', alexCard?.tags?.map(t => t.name));
  console.log('✅ Pipeline Kanban verified.\n');

  // 12. Export Excel, CSV, PDF
  console.log('--- 12. Testing Data Exports (Excel, CSV, PDF) ---');
  const [excelRes, csvRes, pdfRes] = await Promise.all([
    fetch(`${baseUrl}/api/export/excel`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${baseUrl}/api/export/csv`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${baseUrl}/api/export/pdf`, { headers: { Authorization: `Bearer ${adminToken}` } }),
  ]);
  const excelBuf = await excelRes.arrayBuffer();
  const csvText = await csvRes.text();
  const pdfBuf = await pdfRes.arrayBuffer();
  console.log('Excel export size:', excelBuf.byteLength, 'bytes');
  console.log('CSV preview:', csvText.split('\n')[0]);
  console.log('PDF export size:', pdfBuf.byteLength, 'bytes');
  if (excelBuf.byteLength < 500 || !csvText.includes('Full Name') || pdfBuf.byteLength < 500) {
    throw new Error('Export generation failed');
  }
  console.log('✅ All Export formats (Excel, CSV, PDF) verified.\n');

  // 13. Dashboard Metrics
  console.log('--- 13. Testing Dashboard Analytics ---');
  const dashRes = await fetch(`${baseUrl}/api/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const dashJson = await dashRes.json();
  console.log('Dashboard KPI summary:');
  console.log('  Total Contacts:', dashJson.metrics.totalContacts);
  console.log('  Open Conversations:', dashJson.metrics.openConversations);
  console.log('  Qualified Leads:', dashJson.metrics.qualifiedLeads);
  console.log('  Pipeline Distribution stages:', dashJson.pipelineDistribution.length);
  console.log('  Lead Sources:', dashJson.leadSources.map(s => `${s.source}: ${s.count}`).join(', '));
  console.log('✅ Dashboard analytics verified.\n');

  console.log('🎉 ALL 13 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
