import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Check, CircleHelp, Headphones, Mic, Pause, Play, RotateCcw, Type
} from 'lucide-react';
import { api } from '../api.js';
import { queuePush } from '../offlineQueue.js';
import { analyzeAudio, audioProblems, AUDIO_ERROR_MSG, fmtDur } from '../utils/audio.js';
import { pointRules, formalityLevels, exampleResponses } from '../utils/constants.js';
import LanguageSelect from './LanguageSelect.jsx';

export default function Contribute({ language, setLanguage, phone, refreshProfile, navigate, online }) {
  const [textResponse, setTextResponse] = useState('');
  const [recStage, setRecStage] = useState('idle'); // idle | recording | recorded
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState([]);
  const [translation, setTranslation] = useState('');
  const [formality, setFormality] = useState('Normal');
  const [submitted, setSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [count, setCount] = useState(1);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioMeta, setAudioMeta] = useState(null);
  const [audioError, setAudioError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [savedOffline, setSavedOffline] = useState(false);
  const [breakChoice, setBreakChoice] = useState(false);
  const [promptText, setPromptText] = useState(language.sample);
  const recRef = useRef(null);
  const startTsRef = useRef(0);
  const blobUrlRef = useRef(null);

  // rotate a fresh prompt from the database for every sentence
  useEffect(() => {
    let on = true;
    api.getPrompt(language.name, count).then(p => { if (on && p && p.text) setPromptText(p.text); });
    return () => { on = false; };
  }, [language.name, count]);

  useEffect(() => { if (recStage !== 'recording') return; const id = setInterval(() => setTime(t => t + 1), 1000); return () => clearInterval(id); }, [recStage]);

  const hasText = textResponse.trim().length > 0;
  const hasVoice = recStage === 'recorded';
  const basePoints = hasText && hasVoice ? pointRules.both : hasVoice ? pointRules.voice : hasText ? pointRules.text : 0;
  const mixBonus = selectedLangs.length >= 2 ? pointRules.mix : 0;
  const totalPoints = basePoints + mixBonus;
  const toggleLang = (name) => setSelectedLangs(l => l.includes(name) ? l.filter(x => x !== name) : [...l, name]);

  const startRecording = async () => {
    setTime(0); setRecStage('recording'); setAudioBlob(null); setAudioMeta(null); setAudioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // LIVE mic monitoring — measures level/noise WHILE recording (works everywhere)
      const stats = { sum: 0, n: 0, zc: 0, active: 0, prev: 0 };
      let actx = null, timer = null;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        actx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        timer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i += 4) {
            const v = buf[i];
            stats.sum += v * v; stats.n++;
            if (Math.abs(v) > 0.01) stats.active++;
            if ((v >= 0) !== (stats.prev >= 0)) stats.zc++;
            stats.prev = v;
          }
        }, 100);
      } catch { /* monitoring unavailable — duration still enforced */ }

      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timer) clearInterval(timer);
        if (actx) actx.close().catch(() => {});
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        // deep analysis of the FINISHED recording — detects real human voice,
        // rejects empty recordings and background-noise-only takes
        let meta = await analyzeAudio(blob);
        if (!meta) {
          // decoding unavailable — fall back to live mic monitoring stats
          const n = stats.n || 0;
          meta = {
            duration: (Date.now() - startTsRef.current) / 1000,
            rms: n ? Math.sqrt(stats.sum / n) : 0,
            activeFrac: n ? stats.active / n : 0,
            zcr: n ? stats.zc / n : 0,
            n
          };
        }
        const probs = audioProblems(meta);
        if (probs.length) {
          // automatic rejection — bad audio never reaches the database
          setAudioError(AUDIO_ERROR_MSG[probs[0]]);
          setAudioBlob(null); setAudioMeta(null); setRecStage('idle');
        } else {
          setAudioError(''); setAudioMeta(meta); setAudioBlob(blob); setRecStage('recorded');
        }
      };
      recRef.current = rec;
      startTsRef.current = Date.now();
      rec.start();
    } catch {
      recRef.current = null;
      setAudioError('Microphone unavailable — check browser permissions and try again.');
      setRecStage('idle');
    }
  };
  const stopRecording = () => { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); setRecStage('recorded'); };
  const reRecord = () => {
    setTime(0); setRecStage('idle'); setAudioBlob(null); setAudioMeta(null); setAudioError(''); setIsPlaying(false);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
  };
  const fmt = (n) => `00:${String(n).padStart(2,'0')}`;
  const canSubmit = hasText || hasVoice;

  const playRecording = () => {
    if (audioBlob) {
      if (!blobUrlRef.current) blobUrlRef.current = URL.createObjectURL(audioBlob);
      const a = new Audio(blobUrlRef.current);
      if (isPlaying) { a.pause(); setIsPlaying(false); } else { a.play(); setIsPlaying(true); a.onended = () => setIsPlaying(false); }
    } else setIsPlaying(!isPlaying);
  };

  const submit = async () => {
    setSubmitError('');
    // minimum word count for text responses
    if (hasText && textResponse.trim().split(/\s+/).length < 2) {
      setSubmitError('Too short — use at least 2 words.');
      return;
    }
    // final safety net: re-validate the audio at submit time
    if (audioBlob) {
      const probs = audioProblems(audioMeta);
      const dur = (audioMeta && audioMeta.duration) || time;
      if (dur < 1 || probs.length) {
        setAudioError(AUDIO_ERROR_MSG[probs[0] || 'too_short']);
        setSubmitError(AUDIO_ERROR_MSG[probs[0] || 'too_short']);
        setRecStage('idle'); setAudioBlob(null); setAudioMeta(null);
        return;
      }
    }
    const data = { phone: phone || undefined, language: language.name, text: textResponse, translation, langs: selectedLangs, formality, prompt: promptText, duration: audioMeta ? audioMeta.duration : 0 };

    // OFFLINE MODE: queue locally (logged-in users only), sync when back online
    if (!navigator.onLine) {
      if (!phone) { setSubmitError('Log in online once first — offline contributing works only for logged-in contributors.'); return; }
      await queuePush({ id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, data, blob: audioBlob, at: new Date().toISOString() }).catch(() => {});
      setEarnedPoints(totalPoints);
      setSavedOffline(true);
      setSubmitted(true);
      return;
    }

    let result = null;
    if (audioBlob) {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');
      fd.append('data', JSON.stringify(data));
      result = await api.trySubmitAudio(fd);
    } else {
      result = await api.trySubmit(data);
    }
    if (!result || !result.ok) {
      if (result && result.error === 'duplicate') setSubmitError('This response is identical (or nearly identical) to one you already submitted — please say something new.');
      else if (result && result.error === 'too_short') setSubmitError(AUDIO_ERROR_MSG.too_short);
      else if (result && result.error === 'bad_audio') setSubmitError(AUDIO_ERROR_MSG.bad_audio);
      else if (result && result.error === 'too_short_text') setSubmitError('Too short — use at least 3 words.');
      else setSubmitError('Something went wrong while saving — please try again.');
      return;
    }
    setSavedOffline(false);
    setEarnedPoints(result.earned || totalPoints);
    setSubmitted(true);
    refreshProfile();
  };

  const nextSentence = () => {
    setCount(c => c + 1); setTextResponse(''); setRecStage('idle'); setTime(0);
    setSelectedLangs([]); setTranslation(''); setFormality('Normal'); setSubmitted(false);
    setAudioBlob(null); setAudioMeta(null); setAudioError(''); setSubmitError(''); setIsPlaying(false); blobUrlRef.current = null;
    setSavedOffline(false); setBreakChoice(false);
  };

  return <section className="task-page wave-bg slim-wave"><div className="container task-layout">
    <aside className="task-aside"><div className="eyebrow ink">Contribute</div><h1>Speak a little<br/><em>closer to home.</em></h1><p>Read each prompt naturally. Type it, say it, or both — every clear contribution makes the collection stronger.</p><div className="task-aside-card"><span>Language</span><LanguageSelect language={language} setLanguage={setLanguage}/><div className="mini-progress"><div><span>Today’s goal</span><b>{count}/10 sentences</b></div><div className="progress-track"><i style={{width: `${count*10}%`}}/></div></div></div><div className="aside-tip"><CircleHelp size={18}/><span>Find a quiet spot and speak at a comfortable pace.</span></div></aside>

    <div className="task-main">
      {!submitted && <>
        <div className="points-banner">
          <span className="points-banner-label">Points for this sentence</span>
          <div className="points-pills-row">
            <span className={`points-pill-lg ${hasText && !hasVoice ? 'active' : ''}`}><Type size={14}/> Text +{pointRules.text}</span>
            <span className={`points-pill-lg ${hasVoice && !hasText ? 'active' : ''}`}><Mic size={14}/> Voice +{pointRules.voice}</span>
            <span className={`points-pill-lg ${hasText && hasVoice ? 'active' : ''}`}><Check size={14}/> Both +{pointRules.both}</span>
            <span className={`points-pill-lg mix ${mixBonus ? 'active' : ''}`}>🔀 Mix +{pointRules.mix} bonus</span>
          </div>
          {totalPoints > 0 && <div className="points-banner-total">You'll earn <strong>{totalPoints} pts</strong> for this one</div>}
        </div>

        <div className="task-card contribute-card">
          <div className="task-card-head"><span className="language-badge"><span className={`dot ${language.color}`}/> {language.name}</span><span className="counter">Sentence {count} of 10</span></div>
          <div className="prompt-card"><span>Today's Prompt — {language.name}</span><p>“{promptText}”</p></div>
          <div className="no-rules-note">
            <span className="no-rules-badge">No rules — just speak naturally</span>
            <p>Respond exactly how you'd say it to a close friend — one language, three languages, whatever comes out naturally. However it flows is exactly what we need.</p>
            <div className="example-list"><span>Example responses</span>{exampleResponses.map((ex,i) => <p key={i} className="example-item">“{ex}”</p>)}</div>
          </div>
          <div className="contribute-step">
            <div className="contribute-step-head"><span className="step-num">1</span><h3>Type your response</h3></div>
            <textarea className="response-textarea" rows={3} value={textResponse} onChange={e => setTextResponse(e.target.value)} placeholder="Type exactly what you'd say — mix languages if that's natural for you..."/>
          </div>
          <div className="contribute-step">
            <div className="contribute-step-head"><span className="step-num">2</span><h3>Record your voice</h3></div>
            {recStage === 'idle' && <button className="btn btn-secondary voice-start-btn" onClick={startRecording}><Mic size={17}/> Tap the microphone to start recording</button>}
            {audioError && <p className="task-help" style={{ color: '#c0392b', fontWeight: 700 }}>⚠️ {audioError}</p>}
            {recStage === 'recording' && <div className="inline-recorder">
              <div className="recording-header"><span className="record-status large"><i/> Recording</span><span>{fmt(time)}</span></div>
              <div className="big-waveform">{Array.from({length:31},(_,i) => <b key={i} style={{height: `${16 + Math.abs(Math.sin(i*.8+time))*54}px`}}/>)}</div>
              <button className="record-button" onClick={stopRecording} aria-label="Stop recording"><span><span className="stop-square"/></span></button>
              <p className="record-instruction">Tap when you’ve finished speaking</p>
            </div>}
            {recStage === 'recorded' && <div className="inline-recorder">
              <div className="review-player"><button className="round-play dark" onClick={playRecording} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><div className="player-line"><i style={{width: isPlaying ? '66%' : '24%'}}/></div><span>{audioMeta ? `${fmtDur(audioMeta.duration)} ✓ quality ok` : `00:${String(Math.max(time,3)).padStart(2,'0')}`}</span></div>
              <button className="text-action small" onClick={reRecord}><RotateCcw size={15}/> Record again</button>
            </div>}
          </div>
          <div className="contribute-step">
            <h3 className="step-label">Which languages did you use? <small>(select all that apply)</small></h3>
            <p className="step-sublabel">Even if you mixed — especially if you mixed! 🔀</p>
            <div className="checkbox-grid">
              {['Igbo','Yoruba','Hausa','Pidgin','English'].map(name => <label key={name}><input type="checkbox" checked={selectedLangs.includes(name)} onChange={() => toggleLang(name)}/><span>{name}</span></label>)}
            </div>
          </div>
          <div className="contribute-step">
            <h3 className="step-label">English translation <small>(optional but very valuable)</small></h3>
            <p className="step-sublabel">This helps align meanings across languages for AI training 🧠</p>
            <textarea className="response-textarea" rows={2} value={translation} onChange={e => setTranslation(e.target.value)} placeholder="What does this mean in English?"/>
          </div>
          <div className="contribute-step">
            <h3 className="step-label">How formal is this response?</h3>
            <div className="formality-toggle">
              {formalityLevels.map(f => <button key={f} className={formality === f ? 'formality-btn active' : 'formality-btn'} onClick={() => setFormality(f)}>{f}</button>)}
            </div>
          </div>
          <button className="btn btn-primary task-cta submit-response-btn" disabled={!canSubmit} onClick={submit}>Submit response <ArrowRight size={17}/></button>
          {submitError && <p className="task-help" style={{ color: '#c0392b', fontWeight: 700 }}>⚠️ {submitError}</p>}
          {!canSubmit && <p className="task-help">Type a response or record your voice to submit.</p>}
        </div>
      </>}

      {submitted && <div className="task-card">
        <div className="task-icon success"><Check size={29}/></div>
        <h2>That sounded great.</h2>
        <p className="task-intro">Your contribution has been added to the {language.name} collection. Thank you for making room for more voices.</p>
        <div className="success-line"><span><Check size={15}/></span> +{earnedPoints} points earned{savedOffline ? ' · saved offline 📴' : ''}</div>
        {savedOffline && <p className="task-help">You're offline — this contribution is stored on this device and will upload automatically once you're back online.</p>}
        <button className="btn btn-primary task-cta" onClick={nextSentence}>Next sentence <ArrowRight size={18}/></button>
        {!breakChoice ? (
          <button className="text-action centered" onClick={() => setBreakChoice(true)}>Take a short break</button>
        ) : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <span className="task-help" style={{ margin: 0 }}>Do you want to review or visit the homepage?</span>
            <button className="btn btn-secondary" onClick={() => navigate('listen')}><Headphones size={15}/> Review clips</button>
            <button className="btn btn-secondary" onClick={() => navigate('home')}>Visit homepage</button>
          </div>
        )}
      </div>}
    </div>
  </div></section>;
}

export { Contribute };

