import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, MessageSquare, Award, Clock, ArrowUpRight, 
  TrendingUp, CheckCircle2, XCircle, Filter, ArrowRight, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard/metrics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '10px' }}>
        <Loader2 size={32} style={{ color: 'var(--wa-green)', animation: 'spin 1s linear infinite' }} />
        <span>Loading CRM metrics...</span>
      </div>
    );
  }

  const m = data?.metrics || {};

  const kpis = [
    { title: 'Total Contacts', value: m.totalContacts || 0, icon: Users, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    { title: 'New Leads Today', value: m.newLeadsToday || 0, icon: TrendingUp, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { title: 'New Leads (7d)', value: m.newLeadsThisWeek || 0, icon: Clock, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { title: 'Open Chats', value: m.openConversations || 0, icon: MessageSquare, color: '#00a884', bg: 'rgba(0, 168, 132, 0.1)' },
    { title: 'Unread Chats', value: m.unreadConversations || 0, icon: MessageSquare, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    { title: 'Qualified Leads', value: m.qualifiedLeads || 0, icon: Award, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    { title: 'Won Leads', value: m.wonLeads || 0, icon: CheckCircle2, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { title: 'Lost Leads', value: m.lostLeads || 0, icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  ];

  // Calculate max leads for chart scaling
  const maxLeads = Math.max(...(data?.leadsOverTime?.map(l => l.count) || [1]), 1);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            CRM & Live Operations Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Real-time performance metrics, customer acquisition trends, and pipeline health.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/admin/chats')}
            style={{
              backgroundColor: 'var(--wa-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <MessageSquare size={18} />
            <span>Open Live Inbox</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {kpi.title}
                </span>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: kpi.bg,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)' }}>
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* Chart 1: Leads Over Time (Past 7 Days) */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '22px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>
            New Leads Acquisition
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
            Volume of incoming customer leads over the past 7 days
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', gap: '12px', paddingTop: '10px' }}>
            {data?.leadsOverTime?.map((item, i) => {
              const heightPct = Math.max((item.count / maxLeads) * 100, 8);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--wa-green)' }}>
                    {item.count}
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '36px',
                    height: `${heightPct}%`,
                    backgroundColor: 'var(--wa-green)',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.3s ease',
                    opacity: 0.85
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {item.date ? new Date(item.date).toLocaleDateString([], { weekday: 'short' }) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Pipeline Stage Distribution */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '22px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>
                Pipeline Stage Breakdown
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Distribution of contacts across sales stages
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/pipeline')}
              style={{ background: 'none', border: 'none', color: 'var(--wa-green)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              View Kanban →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {data?.pipelineDistribution?.map((stg) => {
              const total = m.totalContacts || 1;
              const pct = Math.round((stg.count / total) * 100) || 0;
              return (
                <div key={stg.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stg.color || '#3b82f6' }} />
                      {stg.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {stg.count} leads ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: stg.color || '#3b82f6', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Lead Sources & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {/* Lead Sources */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '22px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>
            Lead Sources Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.leadSources?.map((src, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-main)'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{src.source}</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'var(--wa-green-bg)',
                  color: 'var(--wa-teal)',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {src.count} leads
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Stream */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '22px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Recent Messages Activity
            </h3>
            <button
              onClick={() => navigate('/admin/chats')}
              style={{ background: 'none', border: 'none', color: 'var(--wa-green)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Open Inbox →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recentActivity?.length > 0 ? (
              data.recentActivity.map((act) => (
                <div key={act.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{act.contact_name}</span>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.text || 'Attachment file'}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No recent message activity yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
