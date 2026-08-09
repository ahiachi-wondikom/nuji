// ============================================================
// Nuji ADMIN PORTAL — standalone page (admin.html -> /admin)
// Separate from the public site (index.html -> main.jsx)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, LockKeyhole, LogOut, Mail } from 'lucide-react';
import { api } from './api.js';
import './styles.css';

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label> }

function Admin() {
  const [token, setTokenState] = useState(() => { try { return localStorage.getItem('nuji_admin_token') || ''; } catch { return ''; } });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  const setToken = (t) => { try { t ? localStorage.setItem('nuji_admin_token', t) : localStorage.removeItem('nuji_admin_token'); } catch {} setTokenState(t); };
  const load = useCallback(() => { api.adminOverview().then(d => { if (d) setData(d); else { setTokenState(''); try { localStorage.removeItem('nuji_admin_token'); } catch {} } }); }, []);
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
      <div className="admin-aside"><div><div className="eyebrow">Nuji operations</div><h1>Keep every voice<br/><em>moving forward.</em></h1><p>Secure access for Nuji dataset administrators and community operations teams.</p></div><span>© 2026 Nuji · Internal platform</span></div>
      <div className="admin-login">
        <div className="admin-mobile-logo"><span className="brand-mark">N</span></div>
        <div className="admin-copy"><div className="eyebrow ink">Admin portal</div><h2>Welcome back.</h2><p>Sign in to manage contributions and community quality.</p></div>
        <form onSubmit={login}>
          <Field label="Work email"><span className="input-icon"><Mail size={18}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@nuji.ng" required/></span></Field>
          <Field label="Password"><span className="input-icon"><LockKeyhole size={18}/><input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required/><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></span></Field>
          {error && <small style={{color:'#c0392b',fontWeight:700}}>{error}</small>}
          <button type="submit" className="btn btn-primary admin-submit">Sign in to admin <ArrowRight size={17}/></button>
        </form>
        <div className="admin-security"><LockKeyhole size={15}/><span>Protected access · Authorized Nuji team members only</span></div>
        <p style={{marginTop: '18px'}}><a href="/" style={{color:'#8d3c71',fontWeight:700,fontSize:13}}>← Back to nuji.ng site</a></p>
      </div>
    </div></section>
  );

  if (!data) return <section className="admin-page"><div className="admin-copy"><h2>Loading dashboard…</h2></div></section>;

  const t = data.totals;
  const maxDay = Math.max(1, ...data.last14.map(d => d.count));

  return (
    <section className="admin-page admin-dash-page">
      <div className="admin-dash">
        <div className="admin-dash-head">
          <div><div className="eyebrow ink">Nuji operations</div><h1>Admin dashboard</h1></div>
          <div style={{display:'flex',gap:10}}>
            <a href="/" className="btn btn-secondary" style={{textDecoration:'none'}}>← Site</a>
            <button className="btn btn-secondary" onClick={logout}><LogOut size={16}/> Log out</button>
          </div>
        </div>

        <div className="admin-tabs">
          {['overview', 'contributions', 'users', 'states'].map(x => (
            <button key={x} className={tab === x ? 'admin-tab active' : 'admin-tab'} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>

        {tab === 'overview' && <>
          <div className="admin-stats">
            <div className="admin-card"><strong>{t.users}</strong><span>Total users</span></div>
            <div className="admin-card"><strong>{t.profiles}</strong><span>Full profiles</span></div>
            <div className="admin-card"><strong>{t.quick}</strong><span>Quick contributors</span></div>
            <div className="admin-card"><strong>{t.contributions}</strong><span>Contributions</span></div>
            <div className="admin-card"><strong>{t.audio}</strong><span>Voice recordings</span></div>
            <div className="admin-card"><strong>{t.reviews}</strong><span>Reviews done</span></div>
            <div className="admin-card"><strong>{t.pointsIssued.toLocaleString()}</strong><span>Points issued</span></div>
            <div className="admin-card"><strong>{t.signups7}</strong><span>Signups (7 days)</span></div>
          </div>
          <div className="admin-row">
            <div className="admin-card">
              <h3>Contributions — last 14 days</h3>
              <div className="admin-chart">
                {data.last14.map(d => <div key={d.date} className="admin-bar" title={`${d.date}: ${d.count}`}><i style={{height: `${(d.count / maxDay) * 100}%`}}/><span>{d.date.slice(8)}</span></div>)}
              </div>
            </div>
            <div className="admin-card">
              <h3>Contributions by language</h3>
              <div className="admin-langs">
                {Object.entries(data.byLang).map(([l, c]) => <span key={l} className="language-badge">{l} · {c}</span>)}
              </div>
              <h3>Top states</h3>
              <table className="admin-table">
                <thead><tr><th>State</th><th>Points</th><th>Users</th><th>Subs</th></tr></thead>
                <tbody>{data.topStates.slice(0, 5).map(s => <tr key={s.name}><td>{s.name}</td><td>{s.points.toLocaleString()}</td><td>{s.contributors}</td><td>{s.submissions}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </>}

        {tab === 'contributions' && (
          <div className="admin-card">
            <h3>Latest contributions (text & voice)</h3>
            <table className="admin-table">
              <thead><tr><th>When</th><th>Phone</th><th>Lang</th><th>Response / prompt</th><th>Voice</th><th>Reviews</th><th>Pts</th></tr></thead>
              <tbody>
                {data.recentContribs.map(c => (
                  <tr key={c.id}>
                    <td>{(c.createdAt || '').slice(5, 16).replace('T', ' ')}</td>
                    <td>{c.phone}</td>
                    <td>{c.language}</td>
                    <td className="admin-cell-text">{c.text || c.prompt}</td>
                    <td>{c.hasAudio ? '🎙️' : '—'}</td>
                    <td>{c.reviews}</td>
                    <td>{c.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div className="admin-card">
            <h3>Top contributors</h3>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Phone</th><th>State</th><th>Subs</th><th>Reviews</th><th>Points</th></tr></thead>
              <tbody>{data.topUsers.map(u => <tr key={u.phone}><td>{u.name}</td><td>{u.phone}</td><td>{u.state}</td><td>{u.subs}</td><td>{u.reviews}</td><td>{u.points}</td></tr>)}</tbody>
            </table>
            <h3 style={{marginTop: '22px'}}>Recent signups</h3>
            <table className="admin-table">
              <thead><tr><th>When</th><th>Phone</th><th>Nickname</th><th>State</th><th>Type</th><th>Points</th></tr></thead>
              <tbody>{data.recentUsers.map(u => <tr key={u.phone}><td>{(u.createdAt || '').slice(5, 16).replace('T', ' ')}</td><td>{u.phone}</td><td>{u.nickname}</td><td>{u.state}</td><td>{u.kind}</td><td>{u.points}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {tab === 'states' && (
          <div className="admin-card">
            <h3>State vs State — live standings</h3>
            <table className="admin-table">
              <thead><tr><th>#</th><th>State</th><th>Zone</th><th>Contributors</th><th>Submissions</th><th>Points</th></tr></thead>
              <tbody>{data.topStates.map((s, i) => <tr key={s.name}><td>{i + 1}</td><td>{s.name}</td><td>{s.zone}</td><td>{s.contributors}</td><td>{s.submissions}</td><td>{s.points.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
