// ============================================================
// Nuji ADMIN PORTAL — standalone page (admin.html -> /admin)
// Overview · Submissions review · Contributors · Prompts ·
// Analytics · Code-switch Annotation · Weekly WhatsApp Digest
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Award, FileDown, FileText, Headphones, LayoutDashboard, LogOut,
  LockKeyhole, Mail, MapPin, Mic, Pause, Play, Download, Printer, RefreshCcw,
  Search, Users, TrendingUp, X, Check, Flag, Save, BarChart3, MessageCircle, Tag, Plus, Trash2
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

const TAGS = [
  { tag: 'IGBO', label: 'Igbo', color: '#059669', bg: '#f0fdf4' },
  { tag: 'YOR', label: 'Yoruba', color: '#d97706', bg: '#fff7ed' },
  { tag: 'HAU', label: 'Hausa', color: '#0284c7', bg: '#eff6ff' },
  { tag: 'PID', label: 'Pidgin', color: '#7c3aed', bg: '#f5f3ff' },
  { tag: 'ENG', label: 'English', color: '#6b7280', bg: '#f3f4f6' }
];

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
  { id: 'submissions', label: 'Submissions', icon: <Mic size={17} /> },
  { id: 'contributors', label: 'Contributors', icon: <Users size={17} /> },
  { id: 'prompts', label: 'Prompts', icon: <FileText size={17} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={17} /> },
  { id: 'annotate', label: 'Annotate', icon: <Tag size={17} /> },
  { id: 'digest', label: 'Digest', icon: <MessageCircle size={17} /> }
];

// ================= DETAIL MODAL (full review console) =================
function DetailModal({ item, onClose, onChanged }) {
  const [translation, setTranslation] = useState(item.translation || '');
  const [annotation, setAnnotation] = useState(item.annotation || '');
  const [status, setStatus] = useState(item.status || 'pending');
  const [msg, setMsg] = useState('');

  const saveMeta = async () => {
    await api.adminUpdateMeta({ id: item.id, translation, annotation });
    setMsg('Saved ✓'); onChanged(); setTimeout(() => setMsg(''), 1500);
  };
  const setStatusAnd = async (st) => { await api.adminSetStatus(item.id, st); setStatus(st); onChanged(); };

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="admin-chip">{item.language}</span>
            <span className={`admin-chip ${STATUS[status].cls}`}>{STATUS[status].label}</span>
            {sp.state && <span className="admin-chip">📍 {sp.state}{sp.lga ? ` · ${sp.lga}` : ''}</span>}
            {(item.langs || []).length > 1 && <span className="admin-chip">🔀 {item.langs.join(' + ')}</span>}
          </div>
          <button className="admin-icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-ready" style={{ marginBottom: 12 }}>
            {ready.map(r => <span key={r.label} className={r.ok ? 'ok' : 'no'}>{r.ok ? '✓' : '✗'} {r.label}</span>)}
          </div>

          <div className="admin-modal-section"><h5>📝 Daily prompt</h5><p>{item.prompt}</p></div>
          <div className="admin-modal-section"><h5>💬 Contributor response {item.formality && <em style={{ textTransform: 'none' }}>· {item.formality}</em>}</h5><p>{item.fullText || item.text || '—'}</p></div>

          {item.hasAudio ? (
            <div className="admin-modal-section">
              <h5>🎙 Voice recording · {fmtDur(item.duration)}</h5>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AudioCell url={item.audioUrl} />
                <span className="admin-muted" style={{ fontSize: 12 }}>Quality-checked on submission (≥3s, not silent, not noisy)</span>
              </div>
            </div>
          ) : (
            <div className="admin-modal-section"><h5>⚠️ No voice recording</h5><p>Text-only submission. Voice + text pairs are far more valuable for training.</p></div>
          )}

          <div className="admin-modal-section">
            <h5>🗣 Speaker metadata (for voice training)</h5>
            <p>{sp.age ? `Age ${sp.age} · ` : ''}{sp.gender ? `${sp.gender} · ` : ''}{sp.state ? `Region: ${sp.state}${sp.lga ? ` (${sp.lga})` : ''}` : 'Region: not provided'}{(item.langs || []).length > 0 && <> · Languages: {item.langs.join(', ')}</>}</p>
          </div>

          <div style={{ marginBottom: 10 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>🌍 English translation {!item.translation && <span style={{ color: '#c0392b', textTransform: 'none' }}>— missing</span>}</h5>
            <textarea className="admin-textarea" value={translation} onChange={e => setTranslation(e.target.value)} placeholder="What does this mean in English? Be literal and natural." />
          </div>

          {(item.langs || []).length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>🔀 Code-switch annotation {!item.annotation && <span style={{ color: '#7c3aed', textTransform: 'none' }}>— needs labelling</span>}</h5>
              <textarea className="admin-textarea" style={{ fontFamily: 'monospace' }} value={annotation} onChange={e => setAnnotation(e.target.value)} placeholder="e.g. [PID]E don happen[/PID] [IGBO]kedu ka i mere[/IGBO]" />
            </div>
          )}

          {msg && <p style={{ color: '#166534', fontWeight: 700, fontSize: 13, margin: '6px 0' }}>{msg}</p>}

          <div className="admin-modal-actions">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMeta}><Save size={15} /> Save edits</button>
            <button className="btn" style={{ flex: 1, background: '#dcfce7', color: '#166534' }} onClick={() => setStatusAnd('approved')}><Check size={15} /> Approve</button>
            <button className="btn" style={{ flex: 1, background: '#fef3c7', color: '#92400e' }} onClick={() => setStatusAnd('flagged')}><Flag size={15} /> Flag</button>
            <button className="btn" style={{ flex: 1, background: '#fee2e2', color: '#991b1b' }} onClick={() => setStatusAnd('rejected')}><X size={15} /> Reject</button>
          </div>
          <p className="admin-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            Reviews: {item.reviews}/{item.maxReviews} · +{item.points} pts · {fmtDate(item.createdAt)} {fmtTime(item.createdAt)} · {item.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

// ================= ANNOTATION TAB =================
function AnnotateTab({ onChanged }) {
  const [queue, setQueue] = useState(null);
  const [idx, setIdx] = useState(0);
  const [selectedTag, setSelectedTag] = useState(null);
  const [segments, setSegments] = useState([]);
  const [saved, setSaved] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(() => api.adminAnnotateQueue().then(q => { setQueue(q || []); setIdx(0); }), []);
  useEffect(() => { load(); }, [load]);

  const current = (queue || [])[idx] || null;
  const remaining = (queue || []).length - idx;

  useEffect(() => {
    if (!current) return;
    const words = (current.fullText || current.text || '').split(/\s+/).filter(Boolean);
    setSegments(words.map(w => ({ word: w, tag: null })));
    setSelectedTag(null);
  }, [idx, current && current.id]);

  if (!queue) return <p className="admin-muted" style={{ textAlign: 'center', padding: 40 }}>Loading annotation queue…</p>;
  if (!current || remaining <= 0) return (
    <div className="admin-panel" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 44 }}>🎉</div>
      <h3 style={{ margin: '8px 0' }}>All caught up!</h3>
      <p className="admin-muted">You annotated {saved} submission{saved !== 1 ? 's' : ''} this session. No more code-switch submissions waiting.</p>
      <button className="btn btn-primary" onClick={load}><RefreshCcw size={15} /> Refresh queue</button>
    </div>
  );

  const tagWord = (i) => { if (!selectedTag) return; setSegments(p => p.map((s, k) => k === i ? { ...s, tag: s.tag === selectedTag ? null : selectedTag } : s)); };
  const tagAll = (t) => setSegments(p => p.map(s => ({ ...s, tag: t })));
  const clearAll = () => setSegments(p => p.map(s => ({ ...s, tag: null })));

  const build = () => {
    const out = []; let cur = null;
    segments.forEach(({ word, tag }) => {
      const t = tag || 'UNK';
      if (cur && cur.tag === t) cur.text += ' ' + word;
      else { if (cur) out.push(cur); cur = { tag: t, text: word }; }
    });
    if (cur) out.push(cur);
    return out;
  };
  const preview = build().map(s => `[${s.tag}]${s.text}[/${s.tag}]`).join(' ');
  const switchPoints = Math.max(0, build().length - 1);

  const save = async () => {
    await api.adminUpdateMeta({ id: current.id, annotation: preview, annotationStatus: 'annotated' });
    setSaved(s => s + 1); setIdx(i => i + 1); onChanged();
  };
  const skip = async () => {
    await api.adminUpdateMeta({ id: current.id, annotationStatus: 'skipped' });
    setIdx(i => i + 1);
  };

  return (
    <div className="admin-content">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div><h3>Code-Switch Annotation</h3><span className="admin-count">{remaining} remaining · tag each word with its language</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="admin-chip st-approved">✅ {saved} annotated</span>
            <button className="admin-export-btn" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Hide guide' : '📖 Guide'}</button>
          </div>
        </div>

        <div className="admin-prog" style={{ marginBottom: 14 }}><i style={{ flex: 1, height: 6 }}><b style={{ width: `${Math.round((idx / Math.max((queue || []).length, 1)) * 100)}%` }} /></i></div>

        {showGuide && (
          <div className="admin-modal-section">
            <h5>How to annotate</h5>
            <p>1) Select a language tag below · 2) click words to label them (click again to untag) · 3) “Tag all” sets one language for the whole text, then fix exceptions · 4) Save — or Skip if unclear. 💡 Tip: tag all with the dominant language first.</p>
          </div>
        )}

        <div className="admin-modal-section">
          <h5>Submission · {current.language} · {fmtDate(current.createdAt)}</h5>
          <p>{current.fullText || current.text}</p>
          {current.hasAudio && <div style={{ marginTop: 8 }}><AudioCell url={current.audioUrl} /> <span className="admin-muted" style={{ fontSize: 12 }}>{fmtDur(current.duration)} — listen while annotating</span></div>}
        </div>

        {segments.length > 0 && (
          <div className="admin-modal-section">
            <h5>Click a tag, then click words</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, lineHeight: 2 }}>
              {segments.map((s, i) => {
                const st = TAGS.find(t => t.tag === s.tag);
                return (
                  <button key={i} onClick={() => tagWord(i)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: st ? `2px solid ${st.color}` : '2px solid #e5e7eb', background: st ? st.bg : '#fff', color: st ? st.color : '#374151', fontSize: 14, fontWeight: st ? 700 : 400, cursor: 'pointer' }}>
                    {s.word}{s.tag && <span style={{ fontSize: 9, marginLeft: 4, opacity: .8 }}>{s.tag}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="admin-panel" style={{ marginBottom: 12 }}>
          <div className="admin-panel-head">
            <h5 style={{ margin: 0, fontSize: 12 }}>Select language tag</h5>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedTag && <button className="admin-export-btn" onClick={() => tagAll(selectedTag)}>Tag all as {selectedTag}</button>}
              <button className="admin-export-btn" onClick={clearAll}>Clear all</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TAGS.map(t => (
              <button key={t.tag} onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
                className="admin-chip"
                style={{ padding: '8px 16px', borderRadius: 999, border: selectedTag === t.tag ? `2px solid ${t.color}` : '2px solid #e5e7eb', background: selectedTag === t.tag ? t.bg : '#fff', color: selectedTag === t.tag ? t.color : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                [{t.tag}] {t.label}
              </button>
            ))}
          </div>
        </div>

        {segments.some(s => s.tag) && (
          <div className="admin-modal-section">
            <h5>Annotation preview · {switchPoints} switch point{switchPoints !== 1 ? 's' : ''}</h5>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{preview}</p>
          </div>
        )}

        <div className="admin-modal-actions">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={skip}>Skip →</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!segments.some(s => s.tag)} onClick={save}><Check size={15} /> Save annotation</button>
        </div>
        <p className="admin-muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 10 }}>You don't need to tag every word — focus on the language switches.</p>
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
  const [analytics, setAnalytics] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [needTrans, setNeedTrans] = useState(false);
  const [selected, setSelected] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  // prompts manager state
  const [newPrompt, setNewPrompt] = useState({ text: '', language: 'Igbo' });
  const [bulkText, setBulkText] = useState('');
  const [bulkLang, setBulkLang] = useState('Igbo');
  const [promptMsg, setPromptMsg] = useState('');
  // digest
  const [digestMsg, setDigestMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const setToken = (t) => { try { t ? localStorage.setItem('nuji_admin_token', t) : localStorage.removeItem('nuji_admin_token'); } catch {} setTokenState(t); };
  const load = useCallback(() => {
    api.adminOverview().then(d => {
      if (d) setData(d);
      else { setTokenState(''); try { localStorage.removeItem('nuji_admin_token'); } catch {} }
    });
  }, []);
  useEffect(() => { if (token) load(); }, [token, load]);
  useEffect(() => { if (!token) return; if (tab === 'analytics' || tab === 'overview' || tab === 'digest') api.adminAnalytics().then(setAnalytics); if (tab === 'prompts') api.adminPrompts().then(setPrompts); }, [tab, token]);

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
  const users = data.allUsers || [];
  const filteredUsers = users.filter(u => !query || [u.nickname, u.phone, u.state, u.lga, u.gender, u.kind].join(' ').toLowerCase().includes(query.toLowerCase()));

  const contribRows = [
    ['Date', 'Time', 'Phone', 'Language', 'Prompt', 'Response', 'Status', 'Duration(s)', 'Speaker', 'Has voice', 'Audio URL', 'Translation', 'Reviews', 'Points'],
    ...filteredContribs.map(c => [fmtDate(c.createdAt), fmtTime(c.createdAt), c.phone, c.language, c.prompt, c.fullText || c.text, c.status, c.duration, [c.speaker.age, c.speaker.gender, c.speaker.state].filter(Boolean).join('/') || '-', c.hasAudio ? 'yes' : 'no', c.audioUrl || '', c.translation, c.reviews, c.points])
  ];
  const userRows = [
    ['Phone', 'Nickname', 'State', 'LGA', 'Age range', 'Gender', 'Languages spoken', 'Contributing in', 'Type', 'Points', 'Submissions', 'Reviews', 'Best streak', 'Ref code', 'Referred by', 'Joined'],
    ...users.map(u => [u.phone, u.nickname, u.state, u.lga, u.age, u.gender, (u.languages || []).join(' | '), u.contributionLang, u.kind, u.points, u.subs, u.reviews, u.bestStreak, u.refCode, u.referredBy, fmtDate(u.createdAt)])
  ];

  // digest builder
  const buildDigest = () => {
    const a = analytics || {};
    const last7 = (a.growthByDay || []).slice(-7).reduce((s, d) => s + d.count, 0);
    const topState = Object.entries(a.stateCounts || {}).sort((x, y) => y[1] - x[1])[0];
    const topUser = (data.topUsers || [])[0];
    setDigestMsg(`🇳🇬 *NUJI WEEKLY DIGEST*\n\n📊 ${last7} new contributions this week\n🎙️ ${t.audio} voice recordings collected\n👥 ${t.signups7} new contributors joined\n🏆 Leading state: ${topState ? topState[0] : '—'}\n⭐ Top contributor: ${topUser ? `${topUser.name} (${topUser.points} pts)` : '—'}\n✅ Approval rate: ${a.approvalRate ?? 0}%\n\nEvery voice builds AI that speaks our languages.\nJoin: https://nuji-test.netlify.app`);
    setCopied(false);
  };

  const KPIS = [
    { icon: <FileText size={18} />, label: 'Total submissions', value: t.contributions, tone: 'green', go: 'submissions' },
    { icon: <Users size={18} />, label: 'Contributors', value: t.users, tone: 'blue', go: 'contributors' },
    { icon: <Headphones size={18} />, label: 'Pending reviews', value: t.pending, tone: 'gold', go: 'submissions' },
    { icon: <Mic size={18} />, label: 'Audio hours', value: t.audioHours, tone: 'berry', go: 'submissions' },
    { icon: <Check size={18} />, label: 'Approved', value: t.approved, tone: 'green', go: 'submissions' },
    { icon: <Flag size={18} />, label: 'Flagged', value: t.flagged, tone: 'berry', go: 'submissions' },
    { icon: <FileText size={18} />, label: 'Need translation', value: t.needTranslation, tone: 'gold', go: 'submissions' },
    { icon: <Award size={18} />, label: 'Points issued', value: t.pointsIssued.toLocaleString(), tone: 'green', go: 'contributors' }
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

        {/* ============ OVERVIEW ============ */}
        {tab === 'overview' && <div className="admin-content">
          <div className="admin-kpis">
            {KPIS.map(k => (
              <div key={k.label} className={`admin-kpi ${k.tone}`} style={{ cursor: 'pointer' }} onClick={() => setTab(k.go)}>
                <span className="admin-kpi-icon">{k.icon}</span>
                <strong>{k.value}</strong>
                <span className="admin-kpi-label">{k.label}</span>
              </div>
            ))}
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Submissions — last 14 days</h3></div>
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
                {[
                  { label: 'Have voice recording', pct: contribs.length ? Math.round(contribs.filter(c => c.hasAudio).length / contribs.length * 100) : 0, color: 'var(--coral)' },
                  { label: 'Have English translation', pct: contribs.length ? Math.round(contribs.filter(c => c.hasTranslation).length / contribs.length * 100) : 0, color: 'var(--gold)' },
                  { label: 'Peer-reviewed & approved', pct: contribs.length ? Math.round(contribs.filter(c => c.status === 'approved').length / contribs.length * 100) : 0, color: 'var(--berry)' }
                ].map(q => (
                  <div key={q.label} className="admin-langbar">
                    <div className="admin-langbar-top"><span>{q.label}</span><b>{q.pct}%</b></div>
                    <div className="admin-langbar-track"><i style={{ width: `${q.pct}%`, background: q.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}

        {/* ============ SUBMISSIONS ============ */}
        {tab === 'submissions' && <div className="admin-content">
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
                  {filteredContribs.map(c => (
                    <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
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
                  {filteredContribs.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24 }} className="admin-muted">No submissions match your filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="admin-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>Click any row to see everything, listen, download, translate, annotate, approve, flag or reject.</p>
          </div>
        </div>}

        {/* ============ CONTRIBUTORS ============ */}
        {tab === 'contributors' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>Contributors</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="admin-count">{filteredUsers.length} of {users.length}</span>
                <ExportBar rows={userRows} filename="nuji-users.csv" />
              </div>
            </div>
            <div className="admin-search">
              <Search size={16} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone, state, LGA…" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredUsers.map((u, i) => (
                <div key={u.phone} className="admin-user-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', background: expandedUser === u.phone ? '#f8faf6' : '#fff' }} onClick={() => setExpandedUser(expandedUser === u.phone ? null : u.phone)}>
                    <span className={`admin-avatar lg`} style={{ background: i < 3 ? 'linear-gradient(135deg,var(--green),var(--coral))' : 'var(--ink)' }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 14 }}>{u.nickname || 'Anonymous'}</b>
                      <small className="admin-muted">📍 {u.state || 'Unknown'} · 🗣 {(u.languages || []).join(', ') || 'Not set'}</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ color: 'var(--coral-dark)', fontSize: 15 }}>{u.points.toLocaleString()} pts</b>
                      <small className="admin-muted" style={{ display: 'block' }}>{expandedUser === u.phone ? '▲ hide' : '▼ details'}</small>
                    </div>
                  </div>
                  {expandedUser === u.phone && (
                    <div className="admin-user-grid" style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', background: '#f8faf6', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                      {[
                        ['Phone', u.phone], ['LGA', u.lga || 'Unknown'], ['Age range', u.age || 'Unknown'], ['Gender', u.gender || 'Unknown'],
                        ['Streak', `${u.bestStreak || 0} days 🔥`], ['Joined', fmtDate(u.createdAt)], ['Referrals', u.referrals || (u.referredBy ? 'referred' : 0)],
                        ['Referral code', u.refCode || '—'], ['Badges', `${u.badgesEarned ?? 0} earned`], ['Type', u.kind], ['Submissions', u.subs], ['Reviews', u.reviews]
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--line)' }}>
                          <small className="admin-muted" style={{ display: 'block', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 800 }}>{label}</small>
                          <b style={{ fontSize: 12.5 }}>{value}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="admin-empty">No contributors match “{query}”. Share Nuji to get started! 🚀</p>}
            </div>
          </div>
        </div>}

        {/* ============ PROMPTS MANAGER ============ */}
        {tab === 'prompts' && <div className="admin-content">
          <div className="admin-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {['Igbo', 'Yoruba', 'Hausa', 'Pidgin'].map(l => (
              <div key={l} className="admin-kpi green">
                <strong>{(prompts || []).filter(p => p.language === l && p.is_active).length}</strong>
                <span className="admin-kpi-label">{l} active prompts</span>
              </div>
            ))}
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Add a prompt</h3></div>
              <Field label="Prompt text">
                <textarea className="admin-textarea" value={newPrompt.text} onChange={e => setNewPrompt(p => ({ ...p, text: e.target.value }))} placeholder="e.g. Kedu ka ị siri teta ụtụtụ a?" />
              </Field>
              <Field label="Language">
                <select value={newPrompt.language} onChange={e => setNewPrompt(p => ({ ...p, language: e.target.value }))}>
                  {['Igbo', 'Yoruba', 'Hausa', 'Pidgin'].map(l => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={async () => {
                if (!newPrompt.text.trim()) return;
                await api.adminAddPrompt(newPrompt);
                setNewPrompt({ text: '', language: 'Igbo' });
                setPromptMsg('Prompt added ✓'); api.adminPrompts().then(setPrompts); setTimeout(() => setPromptMsg(''), 1500);
              }}><Plus size={15} /> Add prompt</button>
              {promptMsg && <p style={{ color: '#166534', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{promptMsg}</p>}

              <div className="admin-panel-head" style={{ marginTop: 18 }}><h3>Bulk import (one per line)</h3></div>
              <textarea className="admin-textarea" rows={5} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={'Paste many prompts, one per line…'} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <select value={bulkLang} onChange={e => setBulkLang(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', font: 'inherit', fontSize: 13 }}>
                  {['Igbo', 'Yoruba', 'Hausa', 'Pidgin'].map(l => <option key={l}>{l}</option>)}
                </select>
                <button className="btn btn-primary" onClick={async () => {
                  const lines = bulkText.split('\n');
                  const r = await api.adminBulkPrompts({ lines, language: bulkLang });
                  setPromptMsg(r && r.ok ? `Imported ${r.count} prompts ✓` : 'Import failed');
                  setBulkText(''); api.adminPrompts().then(setPrompts); setTimeout(() => setPromptMsg(''), 2000);
                }}><FileDown size={15} /> Import all</button>
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-head"><h3>All prompts</h3><span className="admin-count">{(prompts || []).length} loaded</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                {(prompts || []).map(p => (
                  <div key={p.id} className="admin-mini-row" style={{ opacity: p.is_active ? 1 : .5 }}>
                    <span className="admin-chip">{p.language}</span>
                    <small className="admin-ellipsis" style={{ flex: 1 }}>{p.text}</small>
                    <button className="admin-mini-btn" title={p.is_active ? 'Deactivate' : 'Activate'} onClick={async () => { await api.adminTogglePrompt(p.id); api.adminPrompts().then(setPrompts); }}>{p.is_active ? <Check size={13} /> : <X size={13} />}</button>
                    <button className="admin-mini-btn" title="Delete" onClick={async () => { await api.adminDeletePrompt(p.id); api.adminPrompts().then(setPrompts); }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}

        {/* ============ ANALYTICS ============ */}
        {tab === 'analytics' && <div className="admin-content">
          {!analytics ? <p className="admin-muted" style={{ textAlign: 'center', padding: 40 }}>Loading analytics…</p> : <>
            <div className="admin-kpis">
              <div className="admin-kpi green"><strong>{analytics.approvalRate}%</strong><span className="admin-kpi-label">Approval rate</span></div>
              <div className="admin-kpi berry"><strong>{analytics.flagRate}%</strong><span className="admin-kpi-label">Flag rate</span></div>
              <div className="admin-kpi gold"><strong>{analytics.codeSwitchRate}%</strong><span className="admin-kpi-label">Code-switch rate</span></div>
              <div className={`admin-kpi ${analytics.retention.retentionRate >= 40 ? 'green' : analytics.retention.retentionRate >= 20 ? 'gold' : 'berry'}`}>
                <strong>{analytics.retention.retentionRate}%</strong>
                <span className="admin-kpi-label">Week-1 retention ({analytics.retention.stillActive}/{analytics.retention.week1Total})</span>
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Growth — last 30 days</h3></div>
              <div className="admin-chart">
                {analytics.growthByDay.map(d => (
                  <div key={d.date} className="admin-bar" title={`${d.date}: ${d.count}`}>
                    <i style={{ height: `${(d.count / Math.max(1, ...analytics.growthByDay.map(x => x.count))) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-grid-2">
              <div className="admin-panel">
                <div className="admin-panel-head"><h3>Gender distribution</h3></div>
                <div className="admin-langbars">
                  {Object.entries(analytics.genderDistribution).map(([g, c]) => {
                    const total = Object.values(analytics.genderDistribution).reduce((a, b) => a + b, 0) || 1;
                    const colors = { Male: '#2f6fed', Female: '#d1477a', 'Prefer not to say': '#9aa39b', Unknown: '#c9d2c9' };
                    return (
                      <div key={g} className="admin-langbar">
                        <div className="admin-langbar-top"><span>{g}</span><b>{c} ({Math.round(c / total * 100)}%)</b></div>
                        <div className="admin-langbar-track"><i style={{ width: `${(c / total) * 100}%`, background: colors[g] || '#6b7280' }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="admin-panel">
                <div className="admin-panel-head"><h3>Top states</h3></div>
                <div className="admin-mini-list">
                  {Object.entries(analytics.stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, c], i) => (
                    <div key={s} className="admin-mini-row"><span className="admin-rank">{i + 1}</span><b>{s}</b><strong>{c} contributors</strong></div>
                  ))}
                </div>
              </div>
            </div>
          </>}
        </div>}

        {/* ============ ANNOTATE ============ */}
        {tab === 'annotate' && <AnnotateTab onChanged={load} />}

        {/* ============ DIGEST ============ */}
        {tab === 'digest' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>Weekly WhatsApp Digest</h3>
              <button className="btn btn-primary" onClick={buildDigest}><MessageCircle size={15} /> Generate this week's digest</button>
            </div>
            {digestMsg ? (
              <>
                <div className="admin-modal-section"><h5>Message preview</h5><p style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12.5 }}>{digestMsg}</p></div>
                <div className="admin-modal-actions">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { navigator.clipboard?.writeText(digestMsg); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
                  <button className="btn" style={{ flex: 1, background: '#25D366', color: '#fff' }} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(digestMsg)}`, '_blank', 'noopener,noreferrer')}>Open in WhatsApp</button>
                </div>
              </>
            ) : (
              <p className="admin-muted" style={{ textAlign: 'center', padding: 30 }}>Generate a ready-to-share weekly summary of contributions, top state and top contributor — then send it to your community WhatsApp groups.</p>
            )}
          </div>
        </div>}
      </div>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

// Standalone entry (admin.html uses #admin-root) — also importable as a route from the main app
const adminRoot = document.getElementById('admin-root');
if (adminRoot) createRoot(adminRoot).render(<Admin />);

export default Admin;
