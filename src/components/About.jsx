import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { languages } from '../utils/constants.js';

export default function About({ navigate, hasProfile, loggedIn }) {
  const privacy = [
    'Your voice recordings are used only to train Nigerian language AI models',
    'We never sell your data to third parties',
    'You can choose to contribute anonymously — no real name required',
    'Only your state and age range are collected — no personal details',
    'The resulting AI models will be open and accessible to all Nigerians'
  ];
  const steps = [
    ['01', 'You contribute', 'You respond to everyday prompts in your natural language — Igbo, Yoruba, Hausa, Pidgin, or any mix. Speak, type, or both.'],
    ['02', 'Community verifies', 'Other contributors listen and verify your recording sounds natural. This peer review ensures high quality data.'],
    ['03', 'Data trains AI', 'Verified contributions are used to fine-tune language models that understand real Nigerian speech — not textbook language.']
  ];
  return (
    <section className="about-page">
      <section className="about-hero wave-bg">
        <div className="container about-hero-grid">
          <div>
            <div className="eyebrow">About Nuji</div>
            <h1>Technology that speaks<br /><em>your language.</em></h1>
            <p>Why should AI only work for a few of the world's languages? Our language is our story, our community, our culture. Nuji is building the datasets we want to see in the world.</p>
            <button className="btn btn-primary" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Start contributing <ArrowRight size={18} /></button>
          </div>
          <div className="about-mark">
            <div className="market-woman-svg">
              <img src="/assets/nuji12.png" alt="Nuji marketplace illustration" />
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container reading-section">
          <div className="eyebrow ink">The problem</div>
          <h2>Language should not be a barrier to being <em>understood.</em></h2>
          <div className="reading-copy">
            <p>Over 200 million Nigerians speak Igbo, Yoruba, Hausa, and Pidgin every single day. Yet when they try to use AI assistants, those tools barely understand them — because they were trained almost entirely on English and a handful of other languages.</p>
            <p>The data used by big AI companies doesn't include the way Nigerians actually speak — the code-switching, the street talk, the market language, the informal everyday conversations that make our languages alive. That's the gap Nuji is filling.</p>
          </div>
        </div>
      </section>
      <section className="section how-section">
        <div className="container">
          <div className="section-heading"><div><div className="eyebrow">How it works</div><h2>Built by voices.<br />Checked by community.</h2></div></div>
          <div className="how-grid">
            {steps.map(([n, title, text]) => (<article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-heading"><div><div className="eyebrow ink">The languages</div><h2>Starting at home.<br /><em>Growing from there.</em></h2></div><p>We're starting with Nigeria's four most widely spoken languages — and expanding from there.</p></div>
          <div className="about-language-grid">
            {languages.map(l => (
              <div className={`about-language ${l.color}`} key={l.name}>
                <b>{l.name}</b>
                <span>{l.name === 'Igbo' ? '44M+' : l.name === 'Yoruba' ? '45M+' : l.name === 'Hausa' ? '63M+' : '75M+'} speakers</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section data-section">
        <div className="container data-grid">
          <div><div className="eyebrow">Your data, used responsibly</div><h2>Good data begins with <em>trust.</em></h2></div>
          <ul>{privacy.map(item => (<li key={item}><span><Check size={16} /></span>{item}</li>))}</ul>
        </div>
      </section>
      <section className="section founder-section">
        <div className="container founder-card">
          <div className="founder-seal">N</div>
          <div>
            <div className="eyebrow">Who is building Nuji?</div>
            <h2>A Nigerian founder<br />building what should <em>exist.</em></h2>
            <p>Nuji is built by a Nigerian who speaks Igbo, Yoruba, Pidgin and French — and understands firsthand what it means to be left out of the AI revolution. This is not an academic project. This is infrastructure for 200 million people who deserve AI that speaks their language.</p>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <div className="container final-inner">
          <div>
            <div className="eyebrow">Ready to contribute?</div>
            <h2>Every voice brings<br />us one step closer.</h2>
            <p>Every sentence you speak or type brings Nigerian language AI one step closer to reality.</p>
          </div>
          <button className="btn btn-light" onClick={() => navigate(loggedIn ? 'contribute' : 'join')}>Start Contributing <ArrowRight size={18} /></button>
        </div>
        <p className="about-signoff">Built for the people. Powered by their voice. 🇳🇬</p>
      </section>
    </section>
  );
}

export { About };

