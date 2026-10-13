import React, { useState } from 'react';
import {
  ArrowRight, User, LogOut, Award, Trophy, Mic, Users, BarChart3, Layers, MessageCircle, Lock
} from 'lucide-react';

export default function Profile({ navigate, profile, onLogout }) {
  const [tab, setTab] = useState('overview');
  const overviewIconMap = { total: <BarChart3 size={20}/>, text: <Layers size={20}/>, voice: <Mic size={20}/>, both: <Award size={20}/>, mix: <MessageCircle size={20}/>, reviews: <Users size={20}/> };
  const overviewToneMap = { total: 'tone-green', text: 'tone-blue', voice: 'tone-purple', both: 'tone-gold', mix: 'tone-pink', reviews: 'tone-teal' };

  const badgeCategories = [];
  for (const b of (profile?.badges || [])) {
    let cat = badgeCategories.find(c => c.category === b.category);
    if (!cat) { cat = { category: b.category, badges: [] }; badgeCategories.push(cat); }
    cat.badges.push(b);
  }

  return <section className="profile-page wave-bg slim-wave">
    <div className="container">
      <button className="back-link profile-back" onClick={() => navigate('home')}><ArrowRight size={16} style={{transform:'rotate(180deg)'}}/> Back</button>

      <div className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-id">
            <span className="profile-avatar-large"><User size={26}/></span>
            <div><span className="profile-hero-label">Your progress</span><h1>{profile?.nickname ? profile.nickname : 'My Profile'}</h1></div>
          </div>
          <button className="btn btn-light logout-btn" onClick={onLogout}><LogOut size={16}/> Log out</button>
        </div>
        <div className="profile-pills">
          <span className="profile-pill"><Award size={14}/> {profile?.points || 0} pts</span>
          <span className="profile-pill"><Trophy size={14}/> #{profile?.rank || 1} rank</span>
          <span className="profile-pill"><Mic size={14}/> {profile?.submissions || 0} submissions</span>
          <span className="profile-pill"><Users size={14}/> {profile?.reviews || 0} reviews</span>
        </div>
      </div>

      <div className="profile-level-card">
        <span className="profile-level-icon"><Award size={22}/></span>
        <div className="profile-level-body">
          <div className="profile-level-row"><b>{profile?.level || 'Bronze Contributor'}</b><span>{profile?.levelProgress || 0}/{profile?.levelTarget || 100}</span></div>
          <div className="progress-track green-track"><i style={{width: `${Math.min(100, ((profile?.levelProgress || 0)/(profile?.levelTarget || 100))*100)}%`}}/></div>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={tab==='overview'?'profile-tab active':'profile-tab'} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab==='activity'?'profile-tab active':'profile-tab'} onClick={() => setTab('activity')}>Activity</button>
        <button className={tab==='badges'?'profile-tab active':'profile-tab'} onClick={() => setTab('badges')}>Badges ({profile?.badgesEarned || 0})</button>
      </div>

      {tab === 'overview' && <div className="profile-panel">
        <div className="overview-grid">
          {(profile?.overview || []).map(s => <div className={`overview-card ${overviewToneMap[s.icon]}`} key={s.label}><span className="overview-icon">{overviewIconMap[s.icon]}</span><strong>{s.number}</strong><span>{s.label}</span></div>)}
        </div>

        <div className="points-breakdown-card">
          <h3>Points Breakdown</h3>
          <div className="breakdown-rows">
            {(profile?.breakdown || []).map(row => <div className="breakdown-row" key={row.label}>
              <span className="breakdown-label">{row.label}</span>
              <span className="breakdown-calc">{row.count} × {row.rate}pts</span>
              <span className="breakdown-pts">{row.count * row.rate} pts</span>
            </div>)}
          </div>
          <div className="breakdown-total-row"><span>Total</span><strong>{(profile?.breakdown || []).reduce((s,r) => s + r.count * r.rate, 0)} pts</strong></div>
        </div>

        <div className="invite-card">
          <h3>🤝 Invite Friends</h3>
          <p>Earn <strong>+10 points</strong> for every person who joins!</p>
          <div className="invite-link-row">
            <span className="invite-link">{profile?.referral?.url}</span>
            <button className="invite-copy-btn" onClick={() => navigator.clipboard?.writeText(profile?.referral?.url)}>Copy</button>
          </div>
          <div className="invite-stats-row">
            <span className="invite-stat-pill"><Users size={14}/> {profile?.referral?.joined || 0} joined</span>
            <span className="invite-stat-pill gold"><Award size={14}/> +{profile?.referral?.points || 0} pts</span>
          </div>
          <button className="btn invite-whatsapp" onClick={() => {
            const shareText = `🇳🇬 Join me on Nuji! Let's build AI that understands our Nigerian languages. Use my link to start contributing: ${profile?.referral?.url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
          }}><MessageCircle size={17}/> Share on WhatsApp</button>
          <button className="btn btn-primary invite-continue" onClick={() => navigate('contribute')}>Continue Contributing <ArrowRight size={17}/></button>
        </div>
      </div>}

      {tab === 'activity' && <div className="profile-panel">
        <div className="activity-card">
          <h3>Contribution Activity</h3>
          <p className="activity-sub">{profile?.submissions || 0} contributions in the last year</p>
          <div className="activity-months">{(profile?.activityMonths || []).map((m, i) => <span key={i}>{m}</span>)}</div>
          <div className="activity-scroll">
            <div className="activity-cells">
              {(profile?.activityCells || []).map((level, i) => <span key={i} className={`activity-cell level-${level}`}/>)}
            </div>
          </div>
          <div className="activity-legend">
            <span>Less</span>
            <i className="level-0"/><i className="level-1"/><i className="level-2"/><i className="level-3"/><i className="level-4"/>
            <span>More</span>
          </div>
        </div>
        <div className="streak-card"><span className="streak-icon">🔥</span><div><b>{profile?.streak || 0} day streak!</b><small>Keep contributing daily to maintain your streak</small></div></div>
      </div>}

      {tab === 'badges' && <div className="profile-panel">
        <div className="badges-head">
          <div><h3>All Badges</h3><p className="activity-sub">{profile?.badgesEarned || 0} of {profile?.badgesTotal || 0} earned</p></div>
          <span className="badges-percent">{Math.round(((profile?.badgesEarned || 0)/(profile?.badgesTotal || 1))*100)}%</span>
        </div>
        <div className="progress-track green-track"><i style={{width: `${((profile?.badgesEarned || 0)/(profile?.badgesTotal || 1))*100}%`}}/></div>
        <div className="badge-categories">
          {badgeCategories.map(cat => <div className="badge-category" key={cat.category}>
            <h4>{cat.category}</h4>
            <div className="badge-grid">
              {cat.badges.map(b => <div className={b.earned ? 'badge-card earned' : 'badge-card locked'} key={b.name}>
                <span className="badge-emoji">{b.earned ? b.icon : <Lock size={20}/>}</span>
                <b>{b.name}</b>
                <small>{b.desc}</small>
              </div>)}
            </div>
          </div>)}
        </div>
      </div>}
    </div>
  </section>;
}

export { Profile };

