import React, { useState, useRef } from 'react';
import { ArrowRight, Mic, Trophy } from 'lucide-react';
import { api } from '../api.js';
import {
  languages, nigeriaStates, nigeriaStateNames, normalizeNaija, validNaijaPhone
} from '../utils/constants.js';

function Field({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function Trust({ icon, title, text }) {
  return <div className="trust-item"><span>{icon}</span><div><b>{title}</b><small>{text}</small></div></div>;
}

export default function Join({ navigate, language, setLanguage, phone, setPhone, onSaved }) {
  const [step, setStep] = useState('phone');
  const [localPhone, setLocalPhone] = useState(phone);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSubmitting, setSubmittingPhone] = useState(false);
  const [returning, setReturning] = useState(false); // existing phone with a full profile
  const [quick, setQuick] = useState({ state: '', age: '', gender: '' });
  const [quickLang, setQuickLang] = useState('Igbo'); // independent — not tied to the rest of the app
  const [profile, setProfile] = useState({ nickname:'', state:'', lga:'', age:'', gender:'', languages:[], contribution: language.name });
  const ref = useRef(new URLSearchParams(window.location.search).get('ref')).current;
  const update = (key, value) => setProfile(p => ({...p, [key]: value}));
  const updateState = (value) => setProfile(p => ({...p, state: value, lga: ''}));
  const toggleLanguage = (name) => setProfile(p => ({...p, languages: p.languages.includes(name) ? p.languages.filter(x => x !== name) : [...p.languages, name]}));

  // 1) phone screen -> validates Nigerian number, checks if returning user
  const submitPhone = async (e) => {
    e.preventDefault();
    if (phoneSubmitting) return;
    const normalized = normalizeNaija(localPhone);
    if (!validNaijaPhone(normalized)) {
      setPhoneError('Enter a valid Nigerian number, e.g. 0803 123 4567');
      return;
    }
    setPhoneError('');
    setSubmittingPhone(true);
    setLocalPhone(normalized);
    setPhone(normalized);
    try {
      const res = await api.checkPhone(normalized);
      // Registered member (full profile) -> straight to the profile dashboard
      if (res && res.hasProfile) { navigate('contribute'); return; }
      // Brand-new number OR previously quick-contributed -> show both options
      setReturning(false);
      setStep('choose');
    } finally {
      setSubmittingPhone(false);
    }
  };

  // 2) quick contribute -> three quick questions, then straight to Speak
  const submitQuick = async (e) => {
    e.preventDefault();
    await api.saveProfile({ phone: localPhone || phone, state: quick.state, age: quick.age, gender: quick.gender, contribution: quickLang, kind: 'quick' });
    setLanguage(languages.find(l => l.name === quickLang)); // open the Speak page in the chosen language
    onSaved();
    navigate('contribute');
  };

  // 3) full profile -> stored in the backend (new phones only)
  const submitProfile = async (e) => {
    e.preventDefault();
    await api.saveProfile({ ...profile, phone: localPhone || phone, ref, kind: 'full' });
    setPhone(localPhone || phone);
    onSaved();
    navigate('profile');
  };

  if (step === 'choose') return (
    <section className="join-page">
      <div className="join-container choice-screen">
        <button className="back-link" onClick={() => setStep('phone')}>← Back</button>
        <div className="join-heading">
          <div className="eyebrow">Start contributing</div>
          <h1>How do you want<br/>to <em>contribute?</em></h1>
          <p>Choose how you'd like to get started today.</p>
        </div>
        <div className="entry-choice-grid">
          <button className="entry-choice quick" onClick={() => setStep('quick')}>
            <div className="choice-top"><span className="choice-icon"><Mic/></span><span className="choice-badge">Fastest</span></div>
            <h2>Quick Contribute</h2>
            <p>Just 3 quick questions — no account needed. Start contributing in under 30 seconds.</p>
            <span className="choice-action">Start now <ArrowRight size={17}/></span>
          </button>
          {returning ? (
            <button className="entry-choice profile" onClick={() => navigate('profile')}>
              <div className="choice-top"><span className="choice-icon"><Trophy/></span><span className="choice-badge">Welcome back</span></div>
              <h2>My Profile</h2>
              <p>Continue where you stopped — see your points, badges and rank.</p>
              <span className="choice-action">Go to my profile <ArrowRight size={17}/></span>
            </button>
          ) : (
            <button className="entry-choice profile" onClick={() => setStep('profile')}>
              <div className="choice-top"><span className="choice-icon"><Trophy/></span><span className="choice-badge">Track Points</span></div>
              <h2>Create Profile</h2>
              <p>Save your profile, earn points, and climb the leaderboard. Takes 2 minutes.</p>
              <span className="choice-action">Set up profile <ArrowRight size={17}/></span>
            </button>
          )}
        </div>
      </div>
    </section>
  );

  if (step === 'quick') return (
    <section className="join-page">
      <div className="profile-container">
        <button className="back-link" onClick={() => setStep('choose')}>← Back to options</button>
        <div className="form-heading">
          <div className="eyebrow">Quick contribute</div>
          <h1>Three quick questions ⚡</h1>
          <p>This helps us tag your contribution correctly.</p>
        </div>
        <form className="profile-form" onSubmit={submitQuick}>
          <Field label="State of Origin *">
            <select value={quick.state} onChange={e => setQuick(q => ({...q, state: e.target.value}))} required>
              <option value="">Select your state</option>
              {nigeriaStateNames.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Age Range *">
            <select value={quick.age} onChange={e => setQuick(q => ({...q, age: e.target.value}))} required>
              <option value="">Select age range</option>
              <option>18-25</option><option>26-35</option><option>36-50</option><option>50+</option>
            </select>
          </Field>
          <Field label="Gender *">
            <div className="gender-options">
              {['Male','Female','Prefer not to say'].map(g => (
                <label key={g}>
                  <input type="radio" name="quick-gender" value={g} checked={quick.gender === g} onChange={e => setQuick(q => ({...q, gender: e.target.value}))} required/>
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </Field>
          <p className="form-note">Helps ensure our dataset represents all Nigerians equally 🇳🇬</p>
          <Field label="Contributing in">
            <select value={quickLang} onChange={e => setQuickLang(e.target.value)}>
              {languages.map(l => <option key={l.name}>{l.name}</option>)}
            </select>
            <small>— freely choose the language you want to contribute in</small>
          </Field>
          <button className="btn btn-primary profile-submit" type="submit">Start Contributing Now <ArrowRight size={18}/></button>
        </form>
      </div>
    </section>
  );

  if (step === 'profile') return (
    <section className="join-page">
      <div className="profile-container">
        <button className="back-link" onClick={() => setStep('choose')}>← Back to options</button>
        <div className="form-heading">
          <div className="eyebrow">Profile setup · 1 of 1</div>
          <h1>Tell us about <em>yourself.</em></h1>
          <p>This helps tag your dialect correctly — making your data more valuable.</p>
        </div>
        <form className="profile-form" onSubmit={submitProfile}>
          <Field label="Nickname (optional)">
            <input value={profile.nickname} onChange={e => update('nickname', e.target.value)} placeholder="e.g. Chukwuemeka or stay anonymous"/>
          </Field>
          <div className="form-pair">
            <Field label="State of Origin *">
              <select value={profile.state} onChange={e => updateState(e.target.value)} required>
                <option value="">Select your state</option>
                {nigeriaStateNames.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="LGA *">
              <select value={profile.lga} onChange={e => update('lga', e.target.value)} required disabled={!profile.state}>
                <option value="">{profile.state ? 'Select your LGA' : 'Select state first'}</option>
                {(nigeriaStates[profile.state] || []).map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-pair">
            <Field label="Age Range *">
              <select value={profile.age} onChange={e => update('age', e.target.value)} required>
                <option value="">Select age range</option>
                <option>18–24</option><option>25–34</option><option>35–44</option><option>45+</option>
              </select>
            </Field>
            <Field label="Gender *">
              <div className="gender-options">
                {['Male','Female','Prefer not to say'].map(g =>
                  <label key={g}>
                    <input type="radio" name="gender" value={g} checked={profile.gender === g} onChange={e => update('gender', e.target.value)} required/>
                    <span>{g}</span>
                  </label>)}
              </div>
            </Field>
          </div>
          <p className="form-note">Helps ensure our dataset represents all Nigerians equally 🇳🇬</p>
          <Field label="Languages spoken at home *">
            <div className="checkbox-grid">
              {languages.map(l =>
                <label key={l.name}>
                  <input type="checkbox" checked={profile.languages.includes(l.name)} onChange={() => toggleLanguage(l.name)}/>
                  <span>{l.name}</span>
                </label>)}
            </div>
          </Field>
          <Field label="Contributing today in *">
            <select value={profile.contribution} onChange={e => {update('contribution', e.target.value); setLanguage(languages.find(l => l.name === e.target.value));}} required>
              {languages.map(l => <option key={l.name}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Phone number">
            <input value={localPhone} onChange={e => setLocalPhone(e.target.value)} placeholder="080 0000 0000" inputMode="tel"/>
            <small>Used to recognise you on future visits. No OTP needed.</small>
          </Field>
          <button className="btn btn-primary profile-submit" type="submit">Create Profile & Start <ArrowRight size={18}/></button>
          <p className="required-note">Fields marked * help us tag your dialect correctly.</p>
        </form>
      </div>
    </section>
  );

  return (
    <section className="join-page">
      <div className="join-container phone-layout">
        <div className="phone-card">
          <div className="eyebrow">Contribute to Nuji</div>
          <h1>Welcome <span>👋</span></h1>
          <p>Enter your phone number to continue. New here? We'll set you up in seconds.</p>
          <form onSubmit={submitPhone}>
            <Field label="Phone Number">
              <input value={localPhone} onChange={e => { setLocalPhone(e.target.value); setPhoneError(''); }} placeholder="0803 123 4567" inputMode="tel" required disabled={phoneSubmitting}/>
              {phoneError && <small style={{color:'#c0392b',fontWeight:700}}>{phoneError}</small>}
            </Field>
            <button className="btn btn-primary phone-submit" type="submit" disabled={phoneSubmitting} aria-busy={phoneSubmitting}>{phoneSubmitting ? 'Please wait…' : <>Continue <ArrowRight size={18}/></>}</button>
          </form>
          <div className="phone-key">
            <span>🔑</span>
            <div><b>Your phone number is your key</b><small>No password, no long process.</small></div>
          </div>
        </div>
        <div className="trust-panel">
          <div className="trust-mark"><span className="trust-logo-mark">N</span></div>
          <div className="trust-list">
            <Trust icon="🔒" title="No password" text="Just your phone number"/>
            <Trust icon="⚡" title="Instant access" text="Returning users skip setup"/>
            <Trust icon="🏆" title="Track points" text="See your rank & progress"/>
            <Trust icon="🇳🇬" title="Your data" text="Helping 200M+ Nigerians"/>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Join };

