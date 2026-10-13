'use client';

import React from 'react';
import { ArrowRight, Award, ChevronDown, Menu, User, X } from 'lucide-react';

export default function Nav({ page, menuOpen, setMenuOpen, navigate, hasProfile, loggedIn, points }) {
  const links = [['home', 'Home'], ['about', 'About'], ['join', 'Contribute'], ['listen', 'Listen'], ['leaderboard', 'Leaderboard'], ['state', 'State']];
  const resolveKey = (key) => (key === 'join' && loggedIn) ? 'contribute' : key;
  return <>
    <header className="nav-wrap">
      <nav className="nav container" aria-label="Main navigation">
        <button className="brand" onClick={() => navigate('home')} aria-label="Nuji home"><img className="brand-logo" src="/assets/nuji-logo.png" alt=""/><span>nuji</span></button>
        <div className="nav-links">
          {links.map(([key,label]) => <button key={key} className={page === resolveKey(key) ? 'nav-link active' : 'nav-link'} onClick={() => navigate(resolveKey(key))}>{label}</button>)}
        </div>
        <div className="nav-actions">
          <button className="language-nav"><span className="dot"/> Igbo <ChevronDown size={16}/></button>
          {hasProfile && <button className="points-pill" onClick={() => navigate('profile')} aria-label="View points"><Award size={14}/> {points}</button>}
          <button className="btn btn-primary nav-cta" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Contribute <ArrowRight size={16}/></button>
          {hasProfile && <button className={page === 'profile' ? 'profile-avatar active' : 'profile-avatar'} onClick={() => navigate('profile')} aria-label="My profile"><User size={17}/></button>}
          <button className="menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={23}/></button>
        </div>
      </nav>
    </header>
    <div className={menuOpen ? 'mobile-menu open' : 'mobile-menu'} aria-hidden={!menuOpen}>
      <div className="mobile-menu-top"><button className="brand" onClick={() => navigate('home')}><img className="brand-logo" src="/assets/nuji-logo.png" alt=""/><span>nuji</span></button><button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X/></button></div>
      <div className="mobile-links">
        {links.map(([key,label], i) => <button key={key} onClick={() => navigate(resolveKey(key))}><span>0{i + 1}</span>{label}<ArrowRight size={18}/></button>)}
        {hasProfile && <button onClick={() => navigate('profile')}><span>0{links.length + 1}</span>My Profile<ArrowRight size={18}/></button>}
      </div>
      <button className="btn btn-primary mobile-cta" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Start contributing <ArrowRight size={17}/></button>
    </div>
  </>;
}

export { Nav };

