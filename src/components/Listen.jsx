import React, { useState, useEffect, useRef } from 'react';
import {
  Pause, Play, Check, X, SkipForward, ArrowRight
} from 'lucide-react';
import { api } from '../api.js';
import { fmtDur } from '../utils/audio.js';
import LanguageSelect from './LanguageSelect.jsx';

export default function Listen({ language, setLanguage, phone, refreshProfile }) {
  const [decision, setDecision] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState(null); // real submission from Supabase: voice + response + prompt + translation
  const [clipNum, setClipNum] = useState(1);
  const [skip, setSkip] = useState(0);       // skips do NOT count toward the session
  const [excludeId, setExcludeId] = useState('');
  const [dur, setDur] = useState(0);         // real duration of this recording
  const audioRef = useRef(null);
  const clipId = clip ? clip.id : null;

  // pull the next pending submission (with voice) from the database
  useEffect(() => {
    setClip(null);
    api.pendingClip(language.name, phone, skip, excludeId).then(c => setClip(c));
  }, [language.name, clipNum, phone, skip, excludeId]);

  // real player for the clip's voice recording (loads metadata for the true duration)
  useEffect(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false); setDur(0);
    if (!clipId || !clip || !clip.audioUrl) return;
    const a = new Audio(clip.audioUrl);
    a.addEventListener('loadedmetadata', () => setDur(isFinite(a.duration) ? a.duration : 0));
    a.addEventListener('ended', () => setPlaying(false));
    audioRef.current = a;
    return () => { a.pause(); };
  }, [clipId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const next = () => {
    setClipNum(c => c + 1); setDecision(null);
    api.pendingClip(language.name, phone).then(c => setClip(c));
  };

  const decide = async (d) => {
    setDecision(d);
    if (clip) {
      await api.submitReview({ phone: phone || undefined, clipId: clip.id, decision: d });
      refreshProfile();
      // session clip count increases ONLY on a Yes/No verdict
      setExcludeId(clip.id);
      setSkip(0);
      setClipNum(c => c + 1);
    }
  };

  return <section className="task-page listen-page"><div className="container task-layout">
   <aside className="task-aside"><div className="eyebrow ink">Listen</div><h1>Help keep every<br/><em>voice clear.</em></h1><p>Listen to a short recording, compare it to the sentence, and make a simple call.</p><div className="task-aside-card"><span>Reviewing in</span><LanguageSelect language={language} setLanguage={setLanguage}/><div className="mini-progress"><div><span>This session</span><b>{clipNum}/10 clips</b></div><div className="progress-track green-track"><i style={{width: `${clipNum*10}%`}}/></div></div></div></aside>
    <div className="task-main"><div className="review-kicker"><span>Clip {clipNum} of 10</span><span>About 1 minute left</span></div><div className="task-card validation-card"><div className="task-card-head"><span className="language-badge"><span className={`dot ${language.color}`}/> {language.name}</span><span className="counter">Community review</span></div>{!decision ? <><h2>Does this recording match?</h2><div className="listen-prompt"><span>
    The prompt they responded to</span><p>“{clip && clip.prompt ? clip.prompt : '—'}”</p>{clip && clip.text && (<><span style={{ display: 'block', marginTop: 10 }}>Contributor's response ({language.name}) — does the voice match it?</span><p>“{clip.text}”</p></>)}{clip && clip.translation && (<><span style={{ display: 'block', marginTop: 10 }}>English translation</span><p>“{clip.translation}”</p></>)}</div>{clip ? <div className="listen-player"><button className="listen-play" onClick={togglePlay} aria-label={playing ? 'Pause recording' : 'Play recording'}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button><div className="player-wave">
    {Array.from({length:35},(_,i) => <b key={i} style={{height: `${9 + Math.abs(Math.sin(i*.55))*28}px`}}/>)}</div><span>{dur ? fmtDur(dur) : '—'}</span></div> : <p className="task-help">No voice recordings waiting for review in {language.name}
     yet — contribute a voice or check back soon.</p>}<p className="decision-label">Listen once, then choose what you heard.</p><div className="decision-grid"><button className="decision yes" onClick={() => decide('yes')}><span><Check size={21}/></span><div><b>Yes, it matches</b><small>
    The words are clear and correct</small></div></button><button className="decision no" onClick={() => decide('no')}><span><X size={20}/></span><div><b>No, it doesn’t match</b><small>The words are different or unclear</small></div></button></div><button className="skip-btn" onClick={() => setSkip(s => s + 1)}>Skip this clip <SkipForward size={16}/></button></> : <><div className={`task-icon ${decision === 'yes' ? 'success' : 'neutral'}`}>{decision === 'yes' ? <Check size={29}/> : <X size={29}/>}</div><h2>{decision === 'yes' ? 'Thanks for confirming.' : 'Thanks for reviewing.'}</h2><p className="task-intro">Your review helps keep this collection useful for everyone who speaks {language.name}.</p><button className="btn btn-primary task-cta" onClick={next}>Next clip <ArrowRight size={18}/></button><button className="text-action centered" onClick={() => setDecision(null)}>Change answer</button></>}</div></div>
  </div></section>;
}

export { Listen };

