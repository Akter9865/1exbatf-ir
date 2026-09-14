import express from 'express';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authenticateToken);

// Helper function to build filtered contacts query for export
function getExportContacts(filters = {}) {
  const { status, stage, tag, from_date, to_date } = filters;

  let query = `
    SELECT 
      ct.id, ct.name, ct.phone, ct.email, ct.lead_status, ct.lead_source,
      ct.created_at, ct.last_contact_at,
      ps.name as pipeline_stage,
      u.name as assigned_agent,
      (
        SELECT GROUP_CONCAT(t.name, ', ')
        FROM contact_tags ctag
        JOIN tags t ON ctag.tag_id = t.id
        WHERE ctag.contact_id = ct.id
      ) as tags
    FROM contacts ct
    LEFT JOIN pipeline_stages ps ON ct.pipeline_stage_id = ps.id
    LEFT JOIN users u ON ct.assigned_agent_id = u.id
    WHERE 1=1
  `;

  const params = [];

  if (status) {
    query += ` AND ct.lead_status = ?`;
    params.push(status);
  }
  if (stage) {
    query += ` AND ct.pipeline_stage_id = ?`;
    params.push(stage);
  }
  if (tag) {
    query += ` AND EXISTS (SELECT 1 FROM contact_tags ctag WHERE ctag.contact_id = ct.id AND ctag.tag_id = ?)`;
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

  query += ` ORDER BY ct.created_at DESC`;

  return db.prepare(query).all(...params);
}

// 1. Export Excel (.xlsx)
router.get('/excel', (req, res) => {
  try {
    const contacts = getExportContacts(req.query);

    const data = contacts.map((c, i) => ({
      '#': i + 1,
      'Contact ID': c.id,
      'Full Name': c.name,
      'Mobile Phone': c.phone,
      'Email Address': c.email || 'N/A',
      'Lead Status': c.lead_status || 'New Lead',
      'Pipeline Stage': c.pipeline_stage || 'Unassigned',
      'Assigned Agent': c.assigned_agent || 'Unassigned',
      'Lead Source': c.lead_source || 'Website',
      'Tags': c.tags || 'None',
      'Created Date': c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
      'Last Contact Date': c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CRM Contacts');

    // Auto-fit column widths
    const colWidths = [
      { wch: 5 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 24 },
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
      { wch: 14 }, { wch: 16 }
    ];
    worksheet['!cols'] = colWidths;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CRM_Contacts_Export_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export Excel error:', error);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

// 2. Export CSV (.csv)
router.get('/csv', (req, res) => {
  try {
    const contacts = getExportContacts(req.query);

    const headers = [
      'ID', 'Full Name', 'Mobile Phone', 'Email', 'Lead Status', 
      'Pipeline Stage', 'Assigned Agent', 'Lead Source', 'Tags', 'Created Date', 'Last Contact'
    ];

    const csvRows = [headers.join(',')];

    contacts.forEach(c => {
      const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
      const row = [
        escape(c.id),
        escape(c.name),
        escape(c.phone),
        escape(c.email || ''),
        escape(c.lead_status),
        escape(c.pipeline_stage),
        escape(c.assigned_agent),
        escape(c.lead_source),
        escape(c.tags),
        escape(c.created_at),
        escape(c.last_contact_at)
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="CRM_Contacts_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

// 3. Export PDF (.pdf)
router.get('/pdf', (req, res) => {
  try {
    const contacts = getExportContacts(req.query);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CRM_Report_${Date.now()}.pdf"`);

    doc.pipe(res);

    // Header Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#00a884').text('Customer CRM & Lead Management Report', 30, 30);
    doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(`Generated on: ${new Date().toLocaleString()} | Total Records: ${contacts.length}`, 30, 52);
    doc.moveTo(30, 68).lineTo(812, 68).strokeColor('#e2e8f0').stroke();

    // Table Header
    let y = 80;
    doc.rect(30, y, 782, 22).fillColor('#f8fafc').fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('#', 35, y + 6);
    doc.text('Name', 60, y + 6);
    doc.text('Phone', 190, y + 6);
    doc.text('Email', 300, y + 6);
    doc.text('Status', 430, y + 6);
    doc.text('Stage', 520, y + 6);
    doc.text('Source', 610, y + 6);
    doc.text('Created', 700, y + 6);

    y += 24;

    // Table Rows
    doc.font('Helvetica').fontSize(8);
    contacts.slice(0, 100).forEach((c, idx) => {
      if (y > 540) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        y = 40;
      }

      if (idx % 2 === 1) {
        doc.rect(30, y, 782, 18).fillColor('#f1f5f9').fill();
      }

      doc.fillColor('#334155');
      doc.text((idx + 1).toString(), 35, y + 5);
      doc.font('Helvetica-Bold').text(c.name || 'N/A', 60, y + 5, { width: 120, ellipsis: true });
      doc.font('Helvetica').text(c.phone || '', 190, y + 5);
      doc.text(c.email || '-', 300, y + 5, { width: 120, ellipsis: true });
      doc.text(c.lead_status || 'New', 430, y + 5);
      doc.text(c.pipeline_stage || 'Unassigned', 520, y + 5);
      doc.text(c.lead_source || 'Website', 610, y + 5);
      doc.text(c.created_at ? new Date(c.created_at).toLocaleDateString() : '', 700, y + 5);

      y += 19;
    });

    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF export' });
  }
});

export default router;
