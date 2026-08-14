// ============================================================
// Nuji ADMIN PORTAL — standalone page (admin.html -> /admin)
// Review console: statuses, audio QC, translation/annotation,
// approve/flag, CSV/PDF export. Live data via the API.
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Award, FileDown, FileText, Headphones, LayoutDashboard, LogOut,
  LockKeyhole, Mail, MapPin, Mic, Pause, Play, Download, Printer, RefreshCcw, Search, Users, TrendingUp, X, Check, Flag, Save
} from 'lucide-react';
import { api } from './api.js';
import './styles.css';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDur = (s) => s ? `${Number(s).toFixed(1)}s` : '—';

const STATUS = {
  pending: { label: 'Pending', cls: 'st-pending' },
  approved: { label: 'Approved', cls: 'st-approved' },
  flagged: { label: 'Flagged', cls: 'st-flagged' },
  rejected: { label: 'Rejected', cls: 'st-rejected' }
};

// ---------- CSV / PDF export ----------
const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const downloadCSV = (name, rows) => {
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

function ExportBar({ rows, filename }) {
  return (
    <div className="admin-export">
      <button className="admin-export-btn" onClick={() => downloadCSV(filename, rows)} title="Download CSV"><FileDown size={14} /> CSV</button>
      <button className="admin-export-btn" onClick={() => window.print()} title="Print / Save as PDF"><Printer size={14} /> PDF</button>
    </div>
  );
}

// ---------- audio play + download ----------
function AudioCell({ url }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef(null);
  if (!url) return <span className="admin-muted">—</span>;
  const toggle = (e) => {
    e && e.stopPropagation();
    if (!ref.current) { ref.current = new Audio(url); ref.current.onended = () => setPlaying(false); }
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play(); setPlaying(true); }
  };
  return (
    <div className="admin-audio" onClick={e => e.stopPropagation()}>
      <button className="admin-mini-btn play" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
      <a className="admin-mini-btn" href={url} download="nuji-recording.webm" title="Download audio"><Download size={13} /></a>
    </div>
  );
}

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label> }

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'contributions', label: 'Contributions', icon: <Mic size={17} /> },
  { id: 'users', label: 'Users', icon: <Users size={17} /> },
  { id: 'states', label: 'States', icon: <MapPin size={17} /> }
];

// ================= DETAIL MODAL (review console) =================
function DetailModal({ item, onClose, onChanged }) {
  const [translation, setTranslation] = useState(item.translation || '');
  const [annotation, setAnnotation] = useState(item.annotation || '');
  const [status, setStatus] = useState(item.status || 'pending');
  const [msg, setMsg] = useState('');

  const saveMeta = async () => {
    await api.adminUpdateMeta({ id: item.id, translation, annotation });
    setMsg('Saved ✓');
    onChanged();
    setTimeout(() => setMsg(''), 1500);
  };
  const setStatusAnd = async (st) => {
    await api.adminSetStatus(item.id, st);
    setStatus(st);
    onChanged();
  };

  const sp = item.speaker || {};
  const ready = [
    { label: 'Has text', ok: !!(item.fullText || item.text) },
    { label: 'Has voice', ok: !!item.hasAudio },
    { label: 'Has translation', ok: !!translation },
    { label: 'Annotated', ok: !!annotation },
    { label: 'Peer approved', ok: status === 'approved' }
  ];

  return (
    <div className="admin-modal" onClick={onClose}>
      <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="admin-chip">{item.language}</span>
            <span className={`admin-chip ${STATUS[status].cls}`}>{STATUS[status].label}</span>
            {sp.state && <span className="admin-chip">📍 {sp.state}{sp.lga ? ` · ${sp.lga}` : ''}</span>}
          </div>
          <button className="admin-icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-ready" style={{ marginBottom: 12 }}>
            {ready.map(r => <span key={r.label} className={r.ok ? 'ok' : 'no'}>{r.ok ? '✓' : '✗'} {r.label}</span>)}
          </div>

          <div className="admin-modal-section">
            <h5>📝 Daily prompt</h5>
            <p>{item.prompt}</p>
          </div>
          <div className="admin-modal-section">
            <h5>💬 Contributor response {item.formality && <em style={{ textTransform: 'none' }}>· {item.formality}</em>}</h5>
            <p>{item.fullText || item.text || '—'}</p>
          </div>

          {item.hasAudio ? (
            <div className="admin-modal-section">
              <h5>🎙 Voice recording · {fmtDur(item.duration)}</h5>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AudioCell url={item.audioUrl} />
                <span className="admin-muted" style={{ fontSize: 12 }}>Quality-checked on submission (≥3s, not silent, not noisy)</span>
              </div>
            </div>
          ) : (
            <div className="admin-modal-section">
              <h5>⚠️ No voice recording</h5>
              <p>Text-only submission. Voice + text pairs are far more valuable for training.</p>
            </div>
          )}

          <div className="admin-modal-section">
            <h5>🗣 Speaker metadata (for voice training)</h5>
            <p>
              {sp.age ? `Age ${sp.age} · ` : ''}{sp.gender ? `${sp.gender} · ` : ''}
              {sp.state ? `Region: ${sp.state}${sp.lga ? ` (${sp.lga})` : ''}` : 'Region: not provided'}
              {(item.langs || []).length > 0 && <> · Languages: {item.langs.join(', ')}</>}
            </p>
          </div>

          <div style={{ marginBottom: 10 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>🌍 English translation {!item.translation && <span style={{ color: '#c0392b', textTransform: 'none' }}>— missing</span>}</h5>
            <textarea className="admin-textarea" value={translation} onChange={e => setTranslation(e.target.value)} placeholder="What does this mean in English? Be literal and natural." />
          </div>

          {(item.langs || []).length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>🔀 Code-switch annotation {!item.annotation && <span style={{ color: '#7c3aed', textTransform: 'none' }}>— needs labelling</span>}</h5>
              <textarea className="admin-textarea" style={{ fontFamily: 'monospace' }} value={annotation} onChange={e => setAnnotation(e.target.value)} placeholder="e.g. [PIDGIN]E don happen[/PIDGIN] [IGBO]kedu ka i mere[/IGBO]" />
            </div>
          )}

          {msg && <p style={{ color: '#166534', fontWeight: 700, fontSize: 13, margin: '6px 0' }}>{msg}</p>}

          <div className="admin-modal-actions">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMeta}><Save size={15} /> Save edits</button>
            <button className="btn" style={{ flex: 1, background: '#dcfce7', color: '#166534' }} onClick={() => setStatusAnd('approved')}><Check size={15} /> Approve</button>
            <button className="btn" style={{ flex: 1, background: '#fee2e2', color: '#991b1b' }} onClick={() => setStatusAnd('flagged')}><Flag size={15} /> Flag</button>
          </div>
          <p className="admin-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            Reviews: {item.reviews}/{item.maxReviews} · +{item.points} pts · {fmtDate(item.createdAt)} {fmtTime(item.createdAt)} · {item.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

// ================= MAIN =================
function Admin() {
  const [token, setTokenState] = useState(() => { try { return localStorage.getItem('nuji_admin_token') || ''; } catch { return ''; } });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [needTrans, setNeedTrans] = useState(false);
  const [selected, setSelected] = useState(null);

  const setToken = (t) => { try { t ? localStorage.setItem('nuji_admin_token', t) : localStorage.removeItem('nuji_admin_token'); } catch {} setTokenState(t); };
  const load = useCallback(() => {
    api.adminOverview().then(d => {
      if (d) setData(d);
      else { setTokenState(''); try { localStorage.removeItem('nuji_admin_token'); } catch {} }
    });
  }, []);
  useEffect(() => { if (token) load(); }, [token, load]);

  const login = async (e) => {
    e.preventDefault();
    const res = await api.adminLogin(email, password);
    if (res && res.token) { setToken(res.token); setError(''); }
    else setError('Invalid email or password');
  };
  const logout = () => { setToken(''); setData(null); };

  if (!token) return (
    <section className="admin-page"><div className="admin-shell">
      <div className="admin-aside"><div><div className="eyebrow">Nuji operations</div><h1>Keep every voice<br /><em>moving forward.</em></h1><p>Secure access for Nuji dataset administrators and community operations teams.</p></div><span>© 2026 Nuji · Internal platform</span></div>
      <div className="admin-login">
        <div className="admin-mobile-logo"><span className="brand-mark">N</span></div>
        <div className="admin-copy"><div className="eyebrow ink">Admin portal</div><h2>Welcome back.</h2><p>Sign in to manage contributions and community quality.</p></div>
        <form onSubmit={login}>
          <Field label="Work email"><span className="input-icon"><Mail size={18} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@nuji.ng" required /></span></Field>
          <Field label="Password"><span className="input-icon"><LockKeyhole size={18} /><input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required /><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></span></Field>
          {error && <small style={{ color: '#c0392b', fontWeight: 700 }}>{error}</small>}
          <button type="submit" className="btn btn-primary admin-submit">Sign in to admin <ArrowRight size={17} /></button>
        </form>
        <div className="admin-security"><LockKeyhole size={15} /><span>Protected access · Authorized Nuji team members only</span></div>
        <p style={{ marginTop: '18px' }}><a href="/" style={{ color: '#8d3c71', fontWeight: 700, fontSize: 13 }}>← Back to nuji site</a></p>
      </div>
    </div></section>
  );

  if (!data) return <section className="admin-page"><div className="admin-copy"><h2>Loading dashboard…</h2></div></section>;

  const t = data.totals;
  const maxDay = Math.max(1, ...data.last14.map(d => d.count));
  const langMax = Math.max(1, ...Object.values(data.byLang));

  const contribs = data.recentContribs || [];
  const filteredContribs = contribs.filter(c => {
    const q = query.toLowerCase();
    const mQ = !q || [c.text, c.prompt, c.phone, c.language].join(' ').toLowerCase().includes(q);
    const mS = statusFilter === 'All' || c.status === statusFilter;
    const mV = !voiceOnly || c.hasAudio;
    const mT = !needTrans || !c.hasTranslation;
    return mQ && mS && mV && mT;
  });

  const filteredUsers = (data.allUsers || []).filter(u =>
    !query || [u.nickname, u.phone, u.state, u.lga, u.gender, u.kind].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const quality = [
    { label: 'Have voice recording', pct: contribs.length ? Math.round(contribs.filter(c => c.hasAudio).length / contribs.length * 100) : 0, color: 'var(--coral)' },
    { label: 'Have English translation', pct: contribs.length ? Math.round(contribs.filter(c => c.hasTranslation).length / contribs.length * 100) : 0, color: 'var(--gold)' },
    { label: 'Peer-reviewed & approved', pct: contribs.length ? Math.round(contribs.filter(c => c.status === 'approved').length / contribs.length * 100) : 0, color: 'var(--berry)' }
  ];

  const userRows = [
    ['Phone', 'Nickname', 'State', 'LGA', 'Age range', 'Gender', 'Languages spoken', 'Contributing in', 'Type', 'Points', 'Submissions', 'Reviews', 'Best streak', 'Ref code', 'Referred by', 'Joined'],
    ...(data.allUsers || []).map(u => [u.phone, u.nickname, u.state, u.lga, u.age, u.gender, (u.languages || []).join(' | '), u.contributionLang, u.kind, u.points, u.subs, u.reviews, u.bestStreak, u.refCode, u.referredBy, fmtDate(u.createdAt)])
  ];
  const contribRows = [
    ['Date', 'Time', 'Phone', 'Language', 'Prompt', 'Response', 'Status', 'Duration(s)', 'Speaker', 'Has voice', 'Audio URL', 'Translation', 'Reviews', 'Points'],
    ...filteredContribs.map(c => [fmtDate(c.createdAt), fmtTime(c.createdAt), c.phone, c.language, c.prompt, c.fullText || c.text, c.status, c.duration, [c.speaker.age, c.speaker.gender, c.speaker.state].filter(Boolean).join('/') || '-', c.hasAudio ? 'yes' : 'no', c.audioUrl || '', c.translation, c.reviews, c.points])
  ];
  const stateRows = [
    ['Rank', 'State', 'Zone', 'Contributors', 'Submissions', 'Points'],
    ...data.topStates.map((s, i) => [i + 1, s.name, s.zone, s.contributors, s.submissions, s.points])
  ];

  const KPIS = [
    { icon: <Users size={18} />, label: 'Total users', value: t.users, tone: 'green' },
    { icon: <FileText size={18} />, label: 'Contributions', value: t.contributions, tone: 'green' },
    { icon: <Headphones size={18} />, label: 'Voice recordings', value: t.audio, tone: 'blue' },
    { icon: <TrendingUp size={18} />, label: 'Audio hours', value: t.audioHours, tone: 'blue' },
    { icon: <Check size={18} />, label: 'Approved', value: t.approved, tone: 'green' },
    { icon: <Headphones size={18} />, label: 'Pending review', value: t.pending, tone: 'gold' },
    { icon: <Flag size={18} />, label: 'Flagged', value: t.flagged, tone: 'berry' },
    { icon: <FileText size={18} />, label: 'Need translation', value: t.needTranslation, tone: 'berry' },
    { icon: <TrendingUp size={18} />, label: 'Reviews done', value: t.reviews, tone: 'gold' },
    { icon: <Award size={18} />, label: 'Points issued', value: t.pointsIssued.toLocaleString(), tone: 'green' },
    { icon: <Award size={18} />, label: 'Full profiles', value: t.profiles, tone: 'gold' },
    { icon: <Users size={18} />, label: 'Signups (7 days)', value: t.signups7, tone: 'berry' }
  ];

  return (
    <div className="admin-app">
      <aside className="admin-side">
        <div className="admin-side-brand"><span className="brand-mark">N</span><span>nuji <b>admin</b></span></div>
        <nav className="admin-side-nav">
          {TABS.map(x => (
            <button key={x.id} className={tab === x.id ? 'admin-nav-btn active' : 'admin-nav-btn'} onClick={() => setTab(x.id)}>{x.icon}{x.label}</button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="/">← Back to site</a>
          <button onClick={logout}><LogOut size={15} /> Log out</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <div>
            <h1>{TABS.find(x => x.id === tab).label}</h1>
            <p>Live data · updated {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="admin-top-actions">
            <button className="admin-icon-btn" onClick={load} title="Refresh"><RefreshCcw size={16} /></button>
            <button className="admin-icon-btn logout" onClick={logout} title="Log out"><LogOut size={16} /></button>
          </div>
        </header>

        <div className="admin-mobile-tabs">
          {TABS.map(x => (
            <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => setTab(x.id)}>{x.icon}{x.label}</button>
          ))}
        </div>

        {/* ================= OVERVIEW ================= */}
        {tab === 'overview' && <div className="admin-content">
          <div className="admin-kpis">
            {KPIS.map(k => (
              <div key={k.label} className={`admin-kpi ${k.tone}`}>
                <span className="admin-kpi-icon">{k.icon}</span>
                <strong>{k.value}</strong>
                <span className="admin-kpi-label">{k.label}</span>
              </div>
            ))}
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Contributions — last 14 days</h3></div>
              <div className="admin-chart">
                {data.last14.map(d => (
                  <div key={d.date} className="admin-bar" title={`${d.date}: ${d.count}`}>
                    <i style={{ height: `${(d.count / maxDay) * 100}%` }} />
                    <span>{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Language mix</h3></div>
              <div className="admin-langbars">
                {Object.entries(data.byLang).map(([l, c]) => (
                  <div key={l} className="admin-langbar">
                    <div className="admin-langbar-top"><span>{l}</span><b>{c}</b></div>
                    <div className="admin-langbar-track"><i style={{ width: `${(c / langMax) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="admin-panel-head" style={{ marginTop: 18 }}><h3>Data quality checklist</h3></div>
              <div className="admin-langbars">
                {quality.map(q => (
                  <div key={q.label} className="admin-langbar">
                    <div className="admin-langbar-top"><span>{q.label}</span><b>{q.pct}%</b></div>
                    <div className="admin-langbar-track"><i style={{ width: `${q.pct}%`, background: q.color }} /></div>
                  </div>
                ))}
              </div>
              <p className="admin-muted" style={{ fontSize: 11.5, marginTop: 12 }}>💡 Submissions need voice + translation + peer approval to be training-ready. Audio is auto-checked on submission (≥3s, not silent, not noisy) and duplicates are auto-rejected.</p>
            </div>
          </div>
        </div>}

        {/* ================= CONTRIBUTIONS (review console) ================= */}
        {tab === 'contributions' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>Submissions review console</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="admin-count">{filteredContribs.length} shown</span>
                <ExportBar rows={contribRows} filename="nuji-contributions.csv" />
              </div>
            </div>

            <div className="admin-filters">
              <div className="admin-search" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                <Search size={16} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search response, prompt, phone…" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="flagged">Flagged</option>
                <option value="rejected">Rejected</option>
              </select>
              <label className="admin-check"><input type="checkbox" checked={voiceOnly} onChange={e => setVoiceOnly(e.target.checked)} /> Voice only</label>
              <label className="admin-check"><input type="checkbox" checked={needTrans} onChange={e => setNeedTrans(e.target.checked)} /> Missing translation</label>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>When</th><th>Phone</th><th>Lang</th><th>Response / prompt</th><th>Voice</th><th>Reviews</th><th>Status</th><th>Pts</th></tr></thead>
                <tbody>
                  {filteredContribs.map(c => (
                    <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
                      <td className="admin-nowrap">{fmtDate(c.createdAt)}<br /><small>{fmtTime(c.createdAt)}</small></td>
                      <td className="admin-nowrap">{c.phone}</td>
                      <td><span className="admin-chip">{c.language}</span></td>
                      <td className="admin-cell-text">
                        {c.text || c.prompt}
                        {!c.hasTranslation && <small style={{ color: '#c0392b' }}> · ⚠ no translation</small>}
                      </td>
                      <td>{c.hasAudio ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AudioCell url={c.audioUrl} /><small>{fmtDur(c.duration)}</small></div> : <span className="admin-muted">—</span>}</td>
                      <td>
                        <span className="admin-prog">
                          <i><b style={{ width: `${(c.reviews / c.maxReviews) * 100}%`, background: c.reviews >= c.maxReviews ? 'var(--green)' : 'var(--gold)' }} /></i>
                          <span>{c.reviews}/{c.maxReviews}</span>
                        </span>
                      </td>
                      <td><span className={`admin-chip ${(STATUS[c.status] || STATUS.pending).cls}`}>{(STATUS[c.status] || STATUS.pending).label}</span></td>
                      <td><b>+{c.points}</b></td>
                    </tr>
                  ))}
                  {filteredContribs.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24 }} className="admin-muted">No submissions match your filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="admin-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>Click any row to listen, download, translate, annotate, approve or flag.</p>
          </div>
        </div>}

        {/* ================= USERS ================= */}
        {tab === 'users' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>Registered users</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="admin-count">{filteredUsers.length} of {(data.allUsers || []).length}</span>
                <ExportBar rows={userRows} filename="nuji-users.csv" />
              </div>
            </div>
            <div className="admin-search">
              <Search size={16} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone, state, LGA…" />
            </div>

            <div className="admin-user-cards">
              {filteredUsers.map(u => (
                <div key={u.phone} className="admin-user-card">
                  <div className="admin-user-head">
                    <span className="admin-avatar lg">{(u.nickname || u.phone).slice(0, 2).toUpperCase()}</span>
                    <div className="admin-user-id">
                      <b>{u.nickname || 'Anonymous'}</b>
                      <small>{u.phone}</small>
                    </div>
                    <span className={`admin-chip kind-${u.kind}`}>{u.kind === 'full' ? 'Full profile' : u.kind === 'quick' ? 'Quick' : 'New'}</span>
                  </div>
                  <div className="admin-user-grid">
                    <div><small>State</small><b>{u.state || '—'}</b></div>
                    <div><small>LGA</small><b>{u.lga || '—'}</b></div>
                    <div><small>Age range</small><b>{u.age || '—'}</b></div>
                    <div><small>Gender</small><b>{u.gender || '—'}</b></div>
                    <div><small>Contributing in</small><b>{u.contributionLang}</b></div>
                    <div><small>Joined</small><b>{fmtDate(u.createdAt)}</b></div>
                    <div><small>Points</small><b>{u.points.toLocaleString()}</b></div>
                    <div><small>Submissions</small><b>{u.subs}</b></div>
                    <div><small>Reviews</small><b>{u.reviews}</b></div>
                    <div><small>Best streak</small><b>{u.bestStreak}d</b></div>
                    <div><small>Ref code</small><b>{u.refCode}</b></div>
                    <div><small>Referred by</small><b>{u.referredBy || '—'}</b></div>
                  </div>
                  {u.languages.length > 0 && (
                    <div className="admin-user-langs">
                      <small>Languages spoken:</small>
                      {u.languages.map(l => <span key={l} className="admin-chip">{l}</span>)}
                    </div>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="admin-empty">No users match “{query}”.</p>}
            </div>
          </div>
        </div>}

        {/* ================= STATES ================= */}
        {tab === 'states' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>State vs State — live standings</h3>
              <ExportBar rows={stateRows} filename="nuji-states.csv" />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>#</th><th>State</th><th>Zone</th><th>Contributors</th><th>Submissions</th><th>Points</th></tr></thead>
                <tbody>
                  {data.topStates.map((s, i) => (
                    <tr key={s.name}>
                      <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td><b>{s.name}</b></td>
                      <td><span className="admin-chip">{s.zone}</span></td>
                      <td>{s.contributors}</td>
                      <td>{s.submissions}</td>
                      <td><b>{s.points.toLocaleString()}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>}
      </div>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
