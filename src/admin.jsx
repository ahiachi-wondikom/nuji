// ============================================================
// Nuji ADMIN PORTAL — standalone page (admin.html -> /admin)
// Professional, fully responsive dashboard fed live by the API
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Award, FileText, Globe, Headphones, LayoutDashboard, LogOut,
  LockKeyhole, Mail, MapPin, Mic, RefreshCcw, Search, Users, TrendingUp
} from 'lucide-react';
import { api } from './api.js';
import './styles.css';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label> }

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'contributions', label: 'Contributions', icon: <Mic size={17} /> },
  { id: 'users', label: 'Users', icon: <Users size={17} /> },
  { id: 'states', label: 'States', icon: <MapPin size={17} /> }
];

function Admin() {
  const [token, setTokenState] = useState(() => { try { return localStorage.getItem('nuji_admin_token') || ''; } catch { return ''; } });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');

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

  // ---------------- LOGIN ----------------
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
  const filteredUsers = (data.allUsers || []).filter(u =>
    !query || [u.nickname, u.phone, u.state, u.lga, u.gender, u.kind].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const KPIS = [
    { icon: <Users size={18} />, label: 'Total users', value: t.users, tone: 'green' },
    { icon: <Award size={18} />, label: 'Full profiles', value: t.profiles, tone: 'gold' },
    { icon: <Mic size={18} />, label: 'Quick contributors', value: t.quick, tone: 'berry' },
    { icon: <FileText size={18} />, label: 'Contributions', value: t.contributions, tone: 'green' },
    { icon: <Headphones size={18} />, label: 'Voice recordings', value: t.audio, tone: 'blue' },
    { icon: <TrendingUp size={18} />, label: 'Reviews done', value: t.reviews, tone: 'gold' },
    { icon: <Award size={18} />, label: 'Points issued', value: t.pointsIssued.toLocaleString(), tone: 'green' },
    { icon: <Users size={18} />, label: 'Signups (7 days)', value: t.signups7, tone: 'berry' }
  ];

  return (
    <div className="admin-app">
      {/* ---------- sidebar (desktop) ---------- */}
      <aside className="admin-side">
        <div className="admin-side-brand"><span className="brand-mark">N</span><span>nuji <b>admin</b></span></div>
        <nav className="admin-side-nav">
          {TABS.map(x => (
            <button key={x.id} className={tab === x.id ? 'admin-nav-btn active' : 'admin-nav-btn'} onClick={() => setTab(x.id)}>
              {x.icon}{x.label}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="/">← Back to site</a>
          <button onClick={logout}><LogOut size={15} /> Log out</button>
        </div>
      </aside>

      {/* ---------- main ---------- */}
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

        {/* mobile tab bar */}
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
              <div className="admin-panel-head" style={{ marginTop: 18 }}><h3>Top states</h3></div>
              <div className="admin-mini-list">
                {data.topStates.slice(0, 5).map((s, i) => (
                  <div key={s.name} className="admin-mini-row">
                    <span className="admin-rank">{i + 1}</span>
                    <b>{s.name}</b>
                    <small>{s.zone}</small>
                    <strong>{s.points.toLocaleString()} pts</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Latest contributions</h3><button className="admin-link" onClick={() => setTab('contributions')}>View all →</button></div>
              <div className="admin-mini-list">
                {data.recentContribs.slice(0, 6).map(c => (
                  <div key={c.id} className="admin-mini-row">
                    <span className={`admin-dot ${c.hasAudio ? 'audio' : ''}`}>{c.hasAudio ? '🎙️' : '✍️'}</span>
                    <b>{c.language}</b>
                    <small className="admin-ellipsis">{c.text || c.prompt}</small>
                    <strong>+{c.points}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h3>Recent signups</h3><button className="admin-link" onClick={() => setTab('users')}>View all →</button></div>
              <div className="admin-mini-list">
                {data.recentUsers.slice(0, 6).map(u => (
                  <div key={u.phone} className="admin-mini-row">
                    <span className="admin-avatar">{(u.nickname || u.phone).slice(0, 2).toUpperCase()}</span>
                    <b>{u.nickname || 'Anonymous'}</b>
                    <small>{u.state || '—'} · {u.kind}</small>
                    <strong>{fmtDate(u.createdAt)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}

        {/* ================= CONTRIBUTIONS ================= */}
        {tab === 'contributions' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head"><h3>All recent contributions</h3><span className="admin-count">{data.recentContribs.length} shown</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>When</th><th>Phone</th><th>Lang</th><th>Response / prompt</th><th>Voice</th><th>Reviews</th><th>Pts</th></tr></thead>
                <tbody>
                  {data.recentContribs.map(c => (
                    <tr key={c.id}>
                      <td className="admin-nowrap">{fmtDate(c.createdAt)}<br /><small>{fmtTime(c.createdAt)}</small></td>
                      <td className="admin-nowrap">{c.phone}</td>
                      <td><span className="admin-chip">{c.language}</span></td>
                      <td className="admin-cell-text">{c.text || c.prompt}</td>
                      <td>{c.hasAudio ? '🎙️' : '—'}</td>
                      <td>{c.reviews}/3</td>
                      <td><b>+{c.points}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>}

        {/* ================= USERS (full registration data) ================= */}
        {tab === 'users' && <div className="admin-content">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h3>Registered users</h3>
              <span className="admin-count">{filteredUsers.length} of {(data.allUsers || []).length}</span>
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
            <div className="admin-panel-head"><h3>State vs State — live standings</h3></div>
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
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
