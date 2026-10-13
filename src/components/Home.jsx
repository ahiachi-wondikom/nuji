import React from 'react';
import { ArrowRight, Pause, Mic, Headphones, Volume2 } from 'lucide-react';
import { languages } from '../utils/constants.js';
import Stat from './Stat.jsx';
import nuji10 from '../assets/nuji14.jpg';
import nuji11 from '../assets/nuji13.jpg';

function Path({ icon, number, title, text, cta, action, tone }) {
  return (
    <article className={`path-card ${tone}`}>
      <div className="path-top">
        <span className="path-icon">{icon}</span>
        <span>{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button onClick={action}>
        {cta}
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

export default function Home({ navigate, language, setLanguage, hasProfile, loggedIn }) {
  return <>
    <section className="hero wave-bg">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot"/> Made with voices across Nigeria</div>
          <h1>Technology that <em>understands</em> home.</h1>
          <p>Help build voice data in the languages Nigerians actually use — at the market, with family, and everywhere in between.</p>
          <div className="hero-actions"><button className="btn btn-primary" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Add your voice <ArrowRight size={18}/></button><button className="text-action" onClick={() => navigate('leaderboard')}>See community progress <ArrowRight size={17}/></button></div>
          <div className="hero-note"><span className="avatars"><i>A</i><i>C</i><i>T</i></span><span>Join people making language visible.</span></div>
        </div>
        <div className="sound-stage" aria-label="Example recording contribution">
          <div className="stage-orbit orbit-one"></div><div className="stage-orbit orbit-two"></div>
          <div className="record-card">
            <div className="record-top"><span className="language-badge"><span className="dot green"/> Igbo</span><span className="record-status"><i/> Recording</span></div>
            <p className="record-sentence">“Kedu ka ị dị taa?”</p>
            <div className="waveform" aria-hidden="true">{Array.from({length: 29}, (_,i) => <b key={i} style={{height: `${18 + Math.abs(Math.sin(i * .72)) * 49}px`}}/>)}</div>
            <div className="record-bottom"><span>00:09</span><button className="round-play" aria-label="Pause recording"><Pause size={18} fill="currentColor"/></button><span>00:19</span></div>
          </div>
          <div className="floating-stat"><strong>4</strong><span>languages<br/>and growing</span></div>
          <div className="sound-ring">voice<br/>matters</div>
        </div>
      </div>
      <div className="hero-ticker"><span>Igbo</span><b/> <span>Yoruba</span><b/> <span>Hausa</span><b/> <span>Pidgin</span><b/> <span>Everyday Nigerian voices</span></div>
    </section>

    <section className="section intro-section">
      <div className="container split-head"><div><div className="eyebrow ink">A shared voice library</div><h2>Language lives in the way we speak.</h2></div><p>Nuji is a free, open platform where everyday speakers create the data that makes technology more useful to their communities.</p></div>
      <div className="container stat-grid"><Stat number="4" label="Languages represented" accent="green"/><Stat number="200M+" label="People this work speaks for" accent="green"/><Stat number="Open" label="Community-led and accessible" accent="green"/></div>
    </section>

    <section className="section language-section layered-surface">
      <div className="container"><div className="section-heading"><div><div className="eyebrow">Choose a language</div><h2>Start with the words you know.</h2></div><p>Every phrase helps make the next interaction feel a little more familiar.</p></div>
      <div className="language-grid">{languages.map(lang => <button className={`language-card ${lang.color}`} onClick={() => {setLanguage(lang);navigate(loggedIn ? 'contribute' : 'join')}} key={lang.name}><div className="lang-card-top"><span>{lang.name}</span><ArrowRight size={20}/></div><div className="lang-native">{lang.native}</div><p>“{lang.sample.replace(/[“”]/g,'')}”</p><div className="card-lines"/></button>)}</div></div>
    </section>

    <section className="section contribution-section">
      <div className="container"><div className="contribute-heading"><div className="eyebrow ink">Three ways to help</div><h2>Small moments. <em>Real</em> impact.</h2></div><div className="path-grid">
        <Path icon={<Mic/>} number="01" title="Speak a sentence" text="Read short prompts aloud in the language you use every day." cta="Start speaking" action={() => navigate(loggedIn ? 'contribute' : 'join')} tone="green"/>
        <Path icon={<Headphones/>} number="02" title="Listen and validate" text="Help make sure recordings sound natural and clear." cta="Start listening" action={() => navigate('listen')} tone="green"/>
        <Path icon={<Volume2/>} number="03" title="Build the archive" text="Each contribution protects the way our communities speak." cta="See progress" action={() => navigate('leaderboard')} tone="green"/>
      </div></div>
    </section>

    <section className="section culture-section">
      <div className="container culture-grid">
        <div className="culture-visual">
          <img className="photo-block photo-main" src={nuji10} alt="Everyday Nigerian market life"/>
          <img className="photo-block photo-small" src={nuji11} alt="Nigerian community voices"/>
          <div className="culture-stamp">OUR LANGUAGE<br/>IS OUR STORY</div>
        </div>
        <div className="culture-copy">
          <div className="eyebrow">Rooted in culture</div>
          <h2>Not textbook language. <em>Life</em> as it is spoken.</h2>
          <p>From Lagos to Kano and Enugu, everyday voices carry expressions, humour, memory, and place. Nuji gives those voices a place in the technologies being built now.</p>
          <button className="text-action" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Contribute a sentence <ArrowRight size={17}/></button>
        </div>
      </div>
    </section>

    <section className="final-cta"><div className="container final-inner"><div><div className="eyebrow">Your turn</div><h2>Your voice belongs<br/>in the dataset.</h2></div><button className="btn btn-light" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Contribute now <ArrowRight size={18}/></button></div></section>
  </>;
}

export { Home };

