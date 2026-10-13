import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { STATUS, fmtDate, fmtTime, fmtDur } from './constants.js';
import AudioCell from './AudioCell.jsx';
import ExportBar from './ExportBar.jsx';

export default function SubmissionsTab({
  contribs = [],
  onSelect,
  filteredContribs: propFiltered,
  contribRows: propRows,
  query: propQuery,
  setQuery: propSetQuery,
  statusFilter: propStatusFilter,
  setStatusFilter: propSetStatusFilter,
  voiceOnly: propVoiceOnly,
  setVoiceOnly: propSetVoiceOnly,
  needTrans: propNeedTrans,
  setNeedTrans: propSetNeedTrans
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const [internalStatus, setInternalStatus] = useState('All');
  const [internalVoice, setInternalVoice] = useState(false);
  const [internalTrans, setInternalTrans] = useState(false);

  const query = propQuery !== undefined ? propQuery : internalQuery;
  const setQuery = propSetQuery || setInternalQuery;
  const statusFilter = propStatusFilter !== undefined ? propStatusFilter : internalStatus;
  const setStatusFilter = propSetStatusFilter || setInternalStatus;
  const voiceOnly = propVoiceOnly !== undefined ? propVoiceOnly : internalVoice;
  const setVoiceOnly = propSetVoiceOnly || setInternalVoice;
  const needTrans = propNeedTrans !== undefined ? propNeedTrans : internalTrans;
  const setNeedTrans = propSetNeedTrans || setInternalTrans;

  const filtered = propFiltered || contribs.filter(c => {
    const q = query.toLowerCase();
    const mQ = !q || [c.text, c.prompt, c.phone, c.language].join(' ').toLowerCase().includes(q);
    const mS = statusFilter === 'All' || c.status === statusFilter;
    const mV = !voiceOnly || c.hasAudio;
    const mT = !needTrans || !c.hasTranslation;
    return mQ && mS && mV && mT;
  });

  const rows = propRows || [
    ['Date', 'Time', 'Phone', 'Language', 'Prompt', 'Response', 'Status', 'Duration(s)', 'Speaker', 'Has voice', 'Audio URL', 'Translation', 'Reviews', 'Points'],
    ...filtered.map(c => [
      fmtDate(c.createdAt),
      fmtTime(c.createdAt),
      c.phone,
      c.language,
      c.prompt,
      c.fullText || c.text,
      c.status,
      c.duration,
      [c.speaker?.age, c.speaker?.gender, c.speaker?.state].filter(Boolean).join('/') || '-',
      c.hasAudio ? 'yes' : 'no',
      c.audioUrl || '',
      c.translation,
      c.reviews,
      c.points
    ])
  ];

  return (
    <div className="admin-content">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h3>Submissions review console</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="admin-count">{filtered.length} shown</span>
            <ExportBar rows={rows} filename="nuji-contributions.csv" />
          </div>
        </div>
        <div className="admin-filters">
          <div className="admin-search" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <Search size={16} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search response, prompt, phone…" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All statuses</option><option value="pending">Pending</option>
            <option value="approved">Approved</option><option value="flagged">Flagged</option><option value="rejected">Rejected</option>
          </select>
          <label className="admin-check"><input type="checkbox" checked={voiceOnly} onChange={e => setVoiceOnly(e.target.checked)} /> Voice only</label>
          <label className="admin-check"><input type="checkbox" checked={needTrans} onChange={e => setNeedTrans(e.target.checked)} /> Missing translation</label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Phone</th><th>Lang</th><th>Response / prompt</th><th>Voice</th><th>Reviews</th><th>Status</th><th>Pts</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => onSelect && onSelect(c)} style={{ cursor: 'pointer' }}>
                  <td className="admin-nowrap">{fmtDate(c.createdAt)}<br /><small>{fmtTime(c.createdAt)}</small></td>
                  <td className="admin-nowrap">{c.phone}</td>
                  <td><span className="admin-chip">{c.language}</span></td>
                  <td className="admin-cell-text">{c.text || c.prompt}{!c.hasTranslation && <small style={{ color: '#c0392b' }}> · ⚠ no translation</small>}</td>
                  <td>{c.hasAudio ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AudioCell url={c.audioUrl} /><small>{fmtDur(c.duration)}</small></div> : <span className="admin-muted">—</span>}</td>
                  <td><span className="admin-prog"><i><b style={{ width: `${(c.reviews / c.maxReviews) * 100}%`, background: c.reviews >= c.maxReviews ? 'var(--green)' : 'var(--gold)' }} /></i><span>{c.reviews}/{c.maxReviews}</span></span></td>
                  <td><span className={`admin-chip ${(STATUS[c.status] || STATUS.pending).cls}`}>{(STATUS[c.status] || STATUS.pending).label}</span></td>
                  <td><b>+{c.points}</b></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24 }} className="admin-muted">No submissions match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="admin-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>Click any row to see everything, listen, download, translate, annotate, approve, flag or reject.</p>
      </div>
    </div>
  );
}

export { SubmissionsTab };

