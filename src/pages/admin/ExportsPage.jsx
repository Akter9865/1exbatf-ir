import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, FileCode, Calendar, Filter, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ExportsPage() {
  const { token } = useAuth();

  const [stages, setStages] = useState([]);
  const [tags, setTags] = useState([]);

  // Filter criteria
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState('');
  const [tag, setTag] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloading, setDownloading] = useState(null); // 'excel' | 'csv' | 'pdf'

  useEffect(() => {
    async function loadMeta() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [pRes, tRes] = await Promise.all([
          fetch('/api/pipeline', { headers }),
          fetch('/api/tags', { headers })
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          setStages(pData.stages || []);
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          setTags(tData.tags || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMeta();
  }, [token]);

  const handleDownload = async (format) => {
    setDownloading(format);

    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (stage) params.append('stage', stage);
      if (tag) params.append('tag', tag);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const res = await fetch(`/api/export/${format}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Export generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRM_Contacts_Export_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download export file');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          CRM Data Export Center
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Export CRM contacts, conversation metrics, and customer lead records in Excel, CSV, or formatted PDF tables.
        </p>
      </div>

      {/* Filter Parameters Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <Filter size={18} style={{ color: 'var(--wa-green)' }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
            Configure Export Filters (Optional)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {/* Status */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Lead Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            >
              <option value="">All Statuses</option>
              <option value="New Lead">New Lead</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {/* Stage */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Pipeline Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            >
              <option value="">All Stages</option>
              {stages.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {/* Tag */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Assigned Tag
            </label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            >
              <option value="">All Tags</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Created From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            />
          </div>

          {/* To Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Created To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Export Format Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Microsoft Excel */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <FileSpreadsheet size={26} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
              Microsoft Excel (.xlsx)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 20px' }}>
              Structured spreadsheet formatted with automated column widths, header titles, contact phone numbers, tags, and pipeline stages.
            </p>
          </div>

          <button
            onClick={() => handleDownload('excel')}
            disabled={downloading !== null}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {downloading === 'excel' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            <span>Download Excel Sheet</span>
          </button>
        </div>

        {/* Card 2: Standard CSV */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <FileCode size={26} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
              Standard CSV (.csv)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 20px' }}>
              Universal comma-separated data file for importing into other CRM systems, marketing automations, or Google Sheets.
            </p>
          </div>

          <button
            onClick={() => handleDownload('csv')}
            disabled={downloading !== null}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {downloading === 'csv' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            <span>Download CSV File</span>
          </button>
        </div>

        {/* Card 3: Formatted PDF Report */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <FileText size={26} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
              Printable PDF Report (.pdf)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 20px' }}>
              Professionally formatted printable document table layout with company branding, alternating row highlights, and summary headers.
            </p>
          </div>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloading !== null}
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {downloading === 'pdf' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            <span>Download PDF Report</span>
          </button>
        </div>

      </div>
    </div>
  );
}
