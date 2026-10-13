import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import { queueAll, queueDelete, queueCount } from './offlineQueue.js';
import Admin from './admin.jsx';
import Nav from './components/Nav.jsx';
import Home from './components/Home.jsx';
import About from './components/About.jsx';
import Join from './components/Join.jsx';
import Contribute from './components/Contribute.jsx';
import Listen from './components/Listen.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import StatePage from './components/StatePage.jsx';
import Profile from './components/Profile.jsx';
import Footer from './components/Footer.jsx';
import { languages, getCookie, setCookie, clearCookie } from './utils/constants.js';
import './styles.css';

function App() {
  const routeMap = { '/': 'home', '/about': 'about', '/contribute': 'join', '/speak': 'contribute', '/listen': 'listen', '/leaderboard': 'leaderboard', '/state': 'state', '/profile': 'profile', '/admin': 'admin' };
  const pathMap = { home: '/', about: '/about', join: '/contribute', contribute: '/speak', listen: '/listen', leaderboard: '/leaderboard', state: '/state', profile: '/profile', admin: '/admin' };
  const [page, setPage] = useState(() => routeMap[window.location.pathname] || 'home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState(languages[0]);

  // ---- session: localStorage + cookie, phone number is the login key ----
  const [phone, setPhoneState] = useState(() => { try { return localStorage.getItem('nuji_phone') || getCookie(); } catch { return getCookie(); } });
  const [profile, setProfile] = useState(null); // live data from the API

  const setPhone = (p) => {
    try { p ? localStorage.setItem('nuji_phone', p) : localStorage.removeItem('nuji_phone'); } catch {}
    p ? setCookie(p) : clearCookie();
    setPhoneState(p);
  };

  const refreshProfile = useCallback(() => {
    if (!phone) { setProfile(null); return; }
    api.getProfile(phone).then(p => setProfile(p));
  }, [phone]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  // icons only appear once a FULL profile exists in the database
  const hasProfile = !!(profile && profile.hasProfile);
  const loggedIn = !!phone;

  const navigate = (next) => { const path = pathMap[next] || '/'; window.history.pushState({}, '', path); setPage(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const logout = () => { setPhone(''); setProfile(null); navigate('home'); };

  // ---- offline sync manager (queue flushes on 'online', on start, every 30s) ----
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSync, setPendingSync] = useState(0);
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = await queueAll().catch(() => []);
    for (const it of items) {
      let ok = false;
      try {
        if (it.blob) {
          const fd = new FormData();
          fd.append('audio', it.blob, 'recording.webm');
          fd.append('data', JSON.stringify(it.data));
          const r = await api.trySubmitAudio(fd);
          ok = !!r && r.ok;
        } else {
          const r = await api.trySubmit(it.data);
          ok = !!r && r.ok;
        }
      } catch { ok = false; }
      if (ok) await queueDelete(it.id).catch(() => {});
      else break;
    }
    setPendingSync(await queueCount().catch(() => 0));
  }, []);
  useEffect(() => {
    const on = () => { setOnline(true); syncQueue(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    syncQueue();
    const iv = setInterval(syncQueue, 30000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(iv); };
  }, [syncQueue]);

  useEffect(() => { const onPop = () => setPage(routeMap[window.location.pathname] || 'home'); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  useEffect(() => { document.title = `Nuji — ${page === 'home' ? 'Voices build the future' : page[0].toUpperCase() + page.slice(1)}`; }, [page]);
  const profileData = profile || { points: 0, nickname: '', badges: [], streak: 0 };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Nav page={page} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} 
      hasProfile={hasProfile} loggedIn={loggedIn} points={profileData?.points || 0} />
      <main id="main">
        {page === 'home' && <Home navigate={navigate} language={language} setLanguage={setLanguage} hasProfile={hasProfile} loggedIn={loggedIn} />}
        {page === 'about' && <About navigate={navigate} hasProfile={hasProfile} loggedIn={loggedIn} />}
        {page === 'join' && <Join navigate={navigate} language={language} setLanguage={setLanguage} phone={phone} setPhone={setPhone} onSaved={refreshProfile} />}
        {page === 'contribute' && <Contribute language={language} setLanguage={setLanguage} phone={phone} refreshProfile={refreshProfile} navigate={navigate} online={online} />}
        {page === 'listen' && <Listen language={language} setLanguage={setLanguage} phone={phone} refreshProfile={refreshProfile} />}
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'state' && <StatePage navigate={navigate} />}
       
        {page === 'profile' && <Profile navigate={navigate}
         profile={profileData} onLogout={logout} />}
        {page === 'admin' && <Admin />}
      </main>
      {page !== 'admin' && <Footer navigate={navigate} hasProfile={hasProfile} loggedIn={loggedIn} />}
      {pendingSync > 0 && (
        <div className="offline-banner">
          {online ? '🔄 Uploading your offline contributions…' : `📴 Offline mode — ${pendingSync} contribution${pendingSync !== 1 ? 's' : ''} saved on this device, will sync automatically when you're online`}
        </div>
      )}
    </div>
  );
}

export default App;

createRoot(document.getElementById('root')).render(<App />);
