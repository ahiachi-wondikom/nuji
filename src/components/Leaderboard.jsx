import React, { useState, useEffect } from 'react';
import { ChevronDown, Trophy, Check } from 'lucide-react';
import { api } from '../api.js';
import Stat from './Stat.jsx';

export default function Leaderboard() {
  const [filter, setFilter] = useState('This month');
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.leaderboard().then(r => { if (r && r.length) setRows(r); });
    api.stats().then(s => { if (s) setStats(s); });
  }, []);
  const ranks = rows || [];

  return <section className="leader-page wave-bg slim-wave"><div className="container"><div className="leader-hero"><div><div className="eyebrow ink">Community progress</div><h1>Every contribution<br/>moves us <em>forward.</em></h1></div><p>
  A small thank-you to the people helping Nigerian languages take up the space they deserve.
  </p></div><div className="leader-stats"><Stat number={stats ? stats.sentences.toLocaleString() : '0'} label="Sentences contributed" accent="green"/><Stat number={stats ? stats.reviews.toLocaleString() : '0'} label="Clips reviewed" accent="green"/><Stat number="4" label="Languages growing" accent="green"/></div><div className="leader-controls">
  <div className="filters">{['This week','This month','All time'].map(x => <button key={x} className={filter === x ? 'filter active' : 'filter'} onClick={() => setFilter(x)}>{x}</button>)}</div><button className="language-nav leader-lang"><span className="dot"/> All languages <ChevronDown size={16}/></button></div><div className="leaderboard-card"><div className="rank-head"><span>Rank</span><span>Contributor</span><span>Language</span><span>Contributions</span></div>{ranks.map((r,i) => <div className={`rank-row ${i<3 ? 'top-rank' : ''}`} key={r[0]}><span className={`rank-num rank-${i+1}`}>{i<3 ? <Trophy size={18}/> : String(i+1).padStart(2,'0')}</span><span className="person"><i>{r[0].split(' ').map(x => x[0]).join('')}</i><b>{r[0]}</b></span><span className="rank-lang"><span className="dot"/>{r[1]}</span><span className="rank-count">{r[2]}</span></div>)}</div><div className="rank-note"><span><Check size={16}/> Rankings celebrate contribution, not competition.</span><span>Updated today</span></div></div></section>;
}

export { Leaderboard };

