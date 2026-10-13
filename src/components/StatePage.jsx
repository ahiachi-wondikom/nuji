import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { zones, FALLBACK_STATES } from '../utils/constants.js';

export default function StatePage({ navigate }) {
  const [selectedZone, setSelectedZone] = useState('All States');
  const [selectedView, setSelectedView] = useState('states');
  const [data, setData] = useState(null);

  useEffect(() => { api.states().then(d => { if (d && d.length) setData(d); }); }, []);
  const stateData = data || FALLBACK_STATES;

  const filteredStates = selectedZone === 'All States' ? stateData : stateData.filter(s => s.zone === selectedZone);
  const sortedStates = [...filteredStates].sort((a, b) => b.points - a.points);
  const topState = sortedStates[0];

  return <section className="state-page wave-bg slim-wave">
    <div className="container">
      <div className="state-hero">
        <div className="state-title">
          <span className="state-icon">🏟️</span>
          <h1>State vs State</h1>
          <p className="state-subtitle">Which state is building Nigerian language AI the hardest? 🇳🇬</p>
        </div>
      </div>
      {topState && (
        <div className="leading-state-card">
          <div className="leading-state-content">
            <div className="leading-state-header"><span className="trophy-icon">🥇</span><span className="leading-label">Leading State</span></div>
            <div className="leading-state-name">{topState.name}</div>
            <div className="leading-state-stats">
              <div className="leading-stat"><span className="stat-number">{topState.points.toLocaleString()}</span><span className="stat-label">points</span></div>
              <div className="leading-stat"><span className="stat-number">{topState.contributors}</span><span className="stat-label">contributors</span></div>
              <div className="leading-stat"><span className="stat-number">{topState.submissions}</span><span className="stat-label">submissions</span></div>
            </div>
            <div className="leading-state-zone">{topState.zone}</div>
          </div>
        </div>
      )}
      <div className="state-controls">
        <div className="view-tabs">
          <button className={selectedView === 'states' ? 'view-tab active' : 'view-tab'} onClick={() => setSelectedView('states')}>By states</button>
          <button className={selectedView === 'zones' ? 'view-tab active' : 'view-tab'} onClick={() => setSelectedView('zones')}>By zones</button>
        </div>
        <div className="zone-filters">
          {zones.map(zone => (<button key={zone} className={selectedZone === zone ? 'zone-filter active' : 'zone-filter'} onClick={() => setSelectedZone(zone)}>{zone}</button>))}
        </div>
      </div>
      <div className="state-leaderboard">
        <div className="state-rank-head"><span>Rank</span><span>State</span><span>Zone</span><span>Contributors</span><span>Submissions</span><span>Points</span></div>
        {sortedStates.map((state, index) => (
          <div key={state.name} className={`state-rank-row ${index < 3 ? 'top-rank' : ''}`}>
            <span className="state-rank-num">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
            <span className="state-name">{state.name}</span>
            <span className="state-zone-tag">{state.zone}</span>
            <span className="state-contributors">{state.contributors}</span>
            <span className="state-submissions">{state.submissions}</span>
            <span className="state-points">{state.points.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  </section>;
}

export { StatePage };

