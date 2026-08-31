import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, ChevronDown, CircleHelp, Headphones, LockKeyhole, Mail, Menu, Mic, Pause, Play, RotateCcw, SkipForward, Trophy, Volume2, X, User, Clock, Award, Send, Phone, Music, MessageCircle, MapPin, Flag, BarChart3, Users, Layers, Globe, Zap, Lock, Type, LogOut } from "lucide-react";
import { api } from './api.js';
import { queuePush, queueAll, queueDelete, queueCount } from './offlineQueue.js';
import Admin from './admin.jsx';
import nuji10 from './assets/nuji14.jpg';
import nuji11 from './assets/nuji13.jpg';
import './styles.css';

const languages = [
  { name: 'Igbo', native: 'Asụsụ Igbo', sample: 'Kedu ka ị dị taa?', color: 'green' },
  { name: 'Yoruba', native: 'Èdè Yorùbá', sample: 'Bawo ni ọjọ́ rẹ?', color: 'green' },
  { name: 'Hausa', native: 'Harshen Hausa', sample: 'Yaya ake yi yau?', color: 'green' },
  { name: 'Pidgin', native: 'Naija Pidgin', sample: 'How you dey today?', color: 'green' },
];

const FALLBACK_RANKS = [
  ['Amina Yusuf', 'Hausa', '1,240'],
  ['Chiamaka Okoro', 'Igbo', '1,126'],
  ['Tunde Adeyemi', 'Yoruba', '978'],
  ['Blessing James', 'Pidgin', '842'],
  ['Sani Garba', 'Hausa', '770'],
];

const FALLBACK_STATES = [
  { name: 'Anambra', zone: 'South East', points: 6864, contributors: 1, submissions: 44 },
  { name: 'Borno', zone: 'North East', points: 22, contributors: 1, submissions: 2 },
  { name: 'Lagos', zone: 'South West', points: 154, contributors: 3, submissions: 12 },
  { name: 'Enugu', zone: 'South East', points: 89, contributors: 2, submissions: 7 },
  { name: 'Kano', zone: 'North West', points: 45, contributors: 1, submissions: 4 },
  { name: 'Oyo', zone: 'South West', points: 67, contributors: 2, submissions: 5 },
  { name: 'Rivers', zone: 'South South', points: 34, contributors: 1, submissions: 3 },
  { name: 'Kaduna', zone: 'North West', points: 28, contributors: 1, submissions: 2 },
  { name: 'Plateau', zone: 'North Central', points: 19, contributors: 1, submissions: 1 },
  { name: 'Edo', zone: 'South South', points: 41, contributors: 2, submissions: 4 },
];

const zones = ['All States', 'South East', 'South West', 'South South', 'North Central', 'North East', 'North West'];

const pointRules = { text: 3, voice: 5, both: 8, mix: 3 };

// ---------- Nigerian phone helpers ----------
const normalizeNaija = (p) => {
  let d = String(p || '').replace(/[\s-]/g, '');
  if (d.startsWith('+234')) d = '0' + d.slice(4);
  else if (d.startsWith('234')) d = '0' + d.slice(3);
  return d;
};
const validNaijaPhone = (p) => /^0(70|80|81|90|91|93)\d{8}$/.test(p);

// ---------- audio quality validation (runs in the browser before upload) ----------
// Small in-place radix-2 FFT (size must be a power of 2) — used to detect human voice
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi;
        const vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nw = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nw;
      }
    }
  }
}

// Full analysis of the finished recording: level + frame-based HUMAN VOICE detection.
// Rejects empty recordings and background noise (fans, traffic, hiss, TV static) —
// only real speech has voiced frames, a peaky spectrum, voice-band energy and syllable dynamics.
async function analyzeAudio(blob) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    ctx.close();

    // overall level (same metrics as before)
    let sum = 0, zc = 0, prev = 0, n = 0, active = 0;
    const step = Math.max(1, Math.floor(ch.length / 60000));
    for (let i = 0; i < ch.length; i += step) { const v = ch[i]; sum += v * v; if (Math.abs(v) > 0.01) active++; if ((v >= 0) !== (prev >= 0)) zc++; prev = v; n++; }
    const rms = Math.sqrt(sum / (n || 1));
    const zcr = zc / (n || 1);

    // frame-based voice detection (21 ms frames, 50% overlap)
    const N = 1024, hop = 512;
    const frameCount = Math.max(0, Math.floor((ch.length - N) / hop) + 1);
    const energies = [], flatArr = [], bandArr = [], zcrArr = [];
    const re = new Float64Array(N), im = new Float64Array(N);
    const binHz = sr / N;
    const loBin = Math.max(2, Math.round(80 / binHz)), hiBin = Math.min(N / 2 - 1, Math.round(3500 / binHz));
    for (let f = 0; f < frameCount; f++) {
      const off = f * hop;
      let e = 0, z = 0, pv = 0;
      for (let i = 0; i < N; i++) {
        const v = ch[off + i];
        re[i] = v * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)));
        im[i] = 0;
        e += v * v;
        if ((v >= 0) !== (pv >= 0)) z++;
        pv = v;
      }
      e = Math.sqrt(e / N);
      energies.push(e);
      zcrArr.push(z / N);
      fftInPlace(re, im);
      let total = 0, band = 0, logSum = 0, linSum = 0;
      for (let k = 1; k < N / 2; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        total += p;
        if (k >= loBin && k <= hiBin) band += p;
        const pp = p + 1e-12;
        logSum += Math.log(pp); linSum += pp;
      }
      const bins = N / 2 - 1;
      flatArr.push(Math.exp(logSum / bins) / ((linSum / bins) || 1e-12)); // 1 = flat noise, ~0 = peaky voice
      bandArr.push(total ? band / total : 0);
    }

    // adaptive noise floor (20th percentile of frame energy)
    const sorted = [...energies].sort((a, b) => a - b);
    const pct = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
    const floor = Math.max(pct(0.2), 0.0015);
    const thr = Math.max(floor * 3, 0.004);

    let activeFrames = 0, voicedFrames = 0, flatSum = 0, bandSum = 0;
    for (let f = 0; f < frameCount; f++) {
      if (energies[f] <= thr) continue;
      activeFrames++;
      if (zcrArr[f] < 0.2) voicedFrames++;          // voiced speech: low zero-crossing rate
      flatSum += flatArr[f];
      bandSum += bandArr[f];
    }
    const activeFracV = frameCount ? activeFrames / frameCount : 0;
    const voicedFrac = frameCount ? voicedFrames / frameCount : 0;
    const flatness = activeFrames ? flatSum / activeFrames : 1;
    const bandRatio = activeFrames ? bandSum / activeFrames : 0;
    const dynamics = pct(0.9) / Math.max(pct(0.1), floor * 0.5, 1e-4); // speech varies, steady noise doesn't

    const voice = {
      activeFrac: activeFracV, voicedFrac, flatness, bandRatio, dynamics,
      ok: activeFracV >= 0.18 && voicedFrac >= 0.12 && flatness <= 0.4 && bandRatio >= 0.45 && dynamics >= 2.2
    };
    return { duration: buf.duration, rms, zcr, activeFrac: n ? active / n : 0, n, voice };
  } catch { return null; }
}
// industry-style heuristics: too short / silent mic / extreme noise / no human voice
// (voice metrics come from analysing the FINISHED recording, so they can't be faked)
function audioProblems(m) {
  if (!m) return [];
  const p = [];
  if (m.duration < 3) p.push('too_short');
  if (m.n > 0 && (m.activeFrac < 0.05 || m.rms < 0.005)) p.push('silent');
  if (m.n > 0 && (m.rms > 0.35 || (m.zcr > 0.4 && m.rms > 0.06))) p.push('noisy');
  if (m.voice && !m.voice.ok) p.push('no_voice');
  return p;
}
const AUDIO_ERROR_MSG = {
  too_short: 'Recording is under 3 seconds — speak a little longer and try again.',
  silent: 'No voice detected (silent recording). Check your microphone and try again.',
  noisy: 'Extreme background noise detected. Move to a quieter spot and try again.',
  no_voice: 'We could not detect a clear human voice in this recording. Please speak clearly into the microphone and try again — background noise alone is not accepted.',
  bad_audio: 'This audio file could not be accepted. Please record again in the app and try once more.'
};
const fmtDur = (s) => `0:${String(Math.max(0, Math.round(s))).padStart(2, '0')}`;

// ---------- cookie session helpers ----------
const getCookie = () => { const m = document.cookie.match(/(?:^|; )nuji_phone=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
const setCookie = (v) => { document.cookie = `nuji_phone=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`; };
const clearCookie = () => { document.cookie = 'nuji_phone=; path=/; max-age=0'; };

const FALLBACK_BADGES = [
  { category: 'Getting Started', icon: '🎙️', name: 'First Voice', desc: 'Made your first contribution', earned: true },
  { category: 'Volume', icon: '🔥', name: 'On Fire', desc: '10 contributions submitted', earned: true },
  { category: 'Volume', icon: '💪', name: 'Dedicated', desc: '50 contributions submitted', earned: false },
  { category: 'Volume', icon: '🏆', name: 'Champion', desc: '100 contributions submitted', earned: false },
  { category: 'Voice', icon: '🎤', name: 'Voice Hero', desc: '20 voice recordings submitted', earned: false },
  { category: 'Language', icon: '🦅', name: 'Igbo Pride', desc: '20 Igbo contributions', earned: false },
  { category: 'Language', icon: '⭐', name: 'Yoruba Star', desc: '20 Yoruba contributions', earned: false },
  { category: 'Language', icon: '🌙', name: 'Arewa Champion', desc: '20 Hausa contributions', earned: false },
  { category: 'Language', icon: '👑', name: 'Pidgin King', desc: '20 Pidgin contributions', earned: true },
  { category: 'Code Switch', icon: '🔀', name: 'Language Mixer', desc: 'First code-switched submission', earned: true },
  { category: 'Code Switch', icon: '🌍', name: 'Multilingual Master', desc: 'Code-switched in 3+ languages', earned: true },
  { category: 'Streaks', icon: '📅', name: '7 Day Streak', desc: 'Contributed 7 days in a row', earned: false },
  { category: 'Streaks', icon: '️', name: 'Two Week Warrior', desc: '14 day streak', earned: false },
  { category: 'Streaks', icon: '🌟', name: 'Monthly Legend', desc: 'Contributed 30 days in a row', earned: false },
  { category: 'Community', icon: '👥', name: 'Reviewer', desc: 'Reviewed 10 submissions', earned: true },
  { category: 'Community', icon: '🧓', name: 'Elder', desc: 'Reviewed 50 submissions', earned: false },
  { category: 'Community', icon: '🤝', name: 'Village Champion', desc: 'Referred 5 contributors', earned: false },
  { category: 'Points', icon: '⭐', name: 'Top Scorer', desc: 'Earned 100 points', earned: true },
  { category: 'Special', icon: '🐦', name: 'Early Bird', desc: 'One of the first 100 contributors', earned: true },
];

const recentWeeks = [0,1,0,0,0, 0,2,0,1,0, 0,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,1,0];

// Demo profile shown only when the backend is unreachable
const DEMO_PROFILE = {
  phone: '', nickname: '', state: 'Anambra', lga: '',
  points: 153, rank: 1, submissions: 43, reviews: 9,
  level: 'Expert Contributor', levelProgress: 73, levelTarget: 100, streak: 1,
  profileKind: 'full', hasProfile: true,
  overview: [
    { icon: 'total', number: 43, label: 'Total' },
    { icon: 'text', number: 25, label: 'Text Only' },
    { icon: 'voice', number: 4, label: 'Voice Only' },
    { icon: 'both', number: 14, label: 'Text + Voice' },
    { icon: 'mix', number: 3, label: 'Code-switched' },
    { icon: 'reviews', number: 9, label: 'Reviews Done' }
  ],
  breakdown: [
    { label: 'Text only', count: 1, rate: 3 },
    { label: 'Voice only', count: 0, rate: 2 },
    { label: 'Text + Voice', count: 0, rate: 5 }
  ],
  activityCells: [...Array(371 - recentWeeks.length).fill(0), ...recentWeeks],
  activityMonths: ['S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A'],
  badges: FALLBACK_BADGES,
  badgesEarned: FALLBACK_BADGES.filter(b => b.earned).length,
  badgesTotal: FALLBACK_BADGES.length,
  referral: { url: 'https://nuji-test.netlify.app/?ref=', joined: 0, points: 0 }
};

// Nigeria's 36 states + FCT with LGAs
const nigeriaStates = {
  'Abia': ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umuahia North','Umuahia South','Umu Nneochi'],
  'Adamawa': ['Demsa','Fufure','Ganye','Gayuk','Gombi','Grie','Hong','Jada','Lamurde','Madagali','Maiha','Mayo Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
  'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat Enin','Nsit Atai','Nsit Ibom','Nsit Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
  'Anambra': ['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
  'Bauchi': ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau',"Jama'are",'Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
  'Bayelsa': ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
  'Benue': ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
  'Borno': ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
  'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakuur','Yala'],
  'Delta': ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
  'Ebonyi': ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
  'Edo': ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Orhionmwon','Oredo','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde'],
  'Ekiti': ['Ado Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
  'Enugu': ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo Etiti','Igbo Eze North','Igbo Eze South','Isi Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo Uwani'],
  'FCT': ['Abaji','Abuja Municipal','Bwari','Gwagwalada','Kuje','Kwali'],
  'Gombe': ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
  'Imo': ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West','Unuimo'],
  'Jigawa': ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi'],
  'Kaduna': ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba',"Jema'a",'Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
  'Kano': ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
  'Katsina': ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi',"Dutsin-Ma",'Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada',"Mai'Adua",'Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
  'Kebbi': ['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
  'Kogi': ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
  'Kwara': ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi'],
  'Lagos': ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
  'Nasarawa': ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Egon','Obi','Toto','Wamba'],
  'Niger': ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Moya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
  'Ogun': ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Egbado North','Egbado South','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Shagamu'],
  'Ondo': ['Akoko North-East','Akoko North-West','Akoko South-West','Akoko South-East','Akure North','Akure South','Ese Odo','Idanre','Ifedore','Ilaje','Ile Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
  'Osun': ['Aiyedaade','Aiyedire','Atakunmosa East','Atakunmosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ede North','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
  'Oyo': ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
  'Plateau': ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin',"Qua'an Pan",'Riyom','Shendam','Wase'],
  'Rivers': ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Emuoha','Eleme','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
  'Sokoto': ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
  'Taraba': ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kurmi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
  'Yobe': ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
  'Zamfara': ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Chafe','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'],
};

const nigeriaStateNames = Object.keys(nigeriaStates);

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
  const profileData = profile || DEMO_PROFILE;

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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Nav page={page} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} hasProfile={hasProfile} points={profileData.points} />
      <main id="main">
        {page === 'home' && <Home navigate={navigate} language={language} setLanguage={setLanguage} hasProfile={hasProfile} />}
        {page === 'about' && <About navigate={navigate} hasProfile={hasProfile} />}
        {page === 'join' && <Join navigate={navigate} language={language} setLanguage={setLanguage} phone={phone} setPhone={setPhone} onSaved={refreshProfile} />}
        {page === 'contribute' && <Contribute language={language} setLanguage={setLanguage} phone={phone} refreshProfile={refreshProfile} navigate={navigate} online={online} />}
        {page === 'listen' && <Listen language={language} setLanguage={setLanguage} phone={phone} refreshProfile={refreshProfile} navigate={navigate} />}
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'state' && <StatePage navigate={navigate} />}
        {page === 'profile' && <Profile navigate={navigate} profile={profileData} onLogout={logout} />}
        {page === 'admin' && <Admin />}
      </main>
      {page !== 'admin' && <Footer navigate={navigate} hasProfile={hasProfile} />}
      {pendingSync > 0 && (
        <div className="offline-banner">
          {online ? '🔄 Uploading your offline contributions…' : `📴 Offline mode — ${pendingSync} contribution${pendingSync !== 1 ? 's' : ''} saved on this device, will sync automatically when you're online`}
        </div>
      )}
    </div>
  );
}

function Nav({ page, menuOpen, setMenuOpen, navigate, hasProfile, points }) {
  const links = [['home', 'Home'], ['about', 'About'], ['join', 'Contribute'], ['listen', 'Listen'], ['leaderboard', 'Leaderboard'], ['state', 'State']];
  return <>
    <header className="nav-wrap">
      <nav className="nav container" aria-label="Main navigation">
        <button className="brand" onClick={() => navigate('home')} aria-label="Nuji home"><img className="brand-logo" src="/assets/nuji-logo.png" alt=""/><span>nuji</span></button>
        <div className="nav-links">
          {links.map(([key,label]) => <button key={key} className={page === key ? 'nav-link active' : 'nav-link'} onClick={() => navigate(key)}>{label}</button>)}
        </div>
        <div className="nav-actions">
          <button className="language-nav"><span className="dot"/> Igbo <ChevronDown size={16}/></button>
          {hasProfile && <button className="points-pill" onClick={() => navigate('profile')} aria-label="View points"><Award size={14}/> {points}</button>}
          <button className="btn btn-primary nav-cta" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Contribute <ArrowRight size={16}/></button>
          {hasProfile && <button className={page === 'profile' ? 'profile-avatar active' : 'profile-avatar'} onClick={() => navigate('profile')} aria-label="My profile"><User size={17}/></button>}
          <button className="menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={23}/></button>
        </div>
      </nav>
    </header>
    <div className={menuOpen ? 'mobile-menu open' : 'mobile-menu'} aria-hidden={!menuOpen}>
      <div className="mobile-menu-top"><button className="brand" onClick={() => navigate('home')}><img className="brand-logo" src="/assets/nuji-logo.png" alt=""/><span>nuji</span></button><button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X/></button></div>
      <div className="mobile-links">
        {links.map(([key,label], i) => <button key={key} onClick={() => navigate(key)}><span>0{i + 1}</span>{label}<ArrowRight size={18}/></button>)}
        {hasProfile && <button onClick={() => navigate('profile')}><span>0{links.length + 1}</span>My Profile<ArrowRight size={18}/></button>}
      </div>
      <button className="btn btn-primary mobile-cta" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Start contributing <ArrowRight size={17}/></button>
    </div>
  </>;
}

function Home({ navigate, language, setLanguage, hasProfile }) {
  return <>
    <section className="hero wave-bg">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot"/> Made with voices across Nigeria</div>
          <h1>Technology that <em>understands</em> home.</h1>
          <p>Help build voice data in the languages Nigerians actually use — at the market, with family, and everywhere in between.</p>
          <div className="hero-actions"><button className="btn btn-primary" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Add your voice <ArrowRight size={18}/></button><button className="text-action" onClick={() => navigate('leaderboard')}>See community progress <ArrowRight size={17}/></button></div>
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
      <div className="language-grid">{languages.map(lang => <button className={`language-card ${lang.color}`} onClick={() => {setLanguage(lang);navigate(hasProfile ? 'contribute' : 'join')}} key={lang.name}><div className="lang-card-top"><span>{lang.name}</span><ArrowRight size={20}/></div><div className="lang-native">{lang.native}</div><p>“{lang.sample.replace(/[“”]/g,'')}”</p><div className="card-lines"/></button>)}</div></div>
    </section>

    <section className="section contribution-section">
      <div className="container"><div className="contribute-heading"><div className="eyebrow ink">Three ways to help</div><h2>Small moments. <em>Real</em> impact.</h2></div><div className="path-grid">
        <Path icon={<Mic/>} number="01" title="Speak a sentence" text="Read short prompts aloud in the language you use every day." cta="Start speaking" action={() => navigate(hasProfile ? 'contribute' : 'join')} tone="green"/>
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
          <button className="text-action" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Contribute a sentence <ArrowRight size={17}/></button>
        </div>
      </div>
    </section>

    <section className="final-cta"><div className="container final-inner"><div><div className="eyebrow">Your turn</div><h2>Your voice belongs<br/>in the dataset.</h2></div><button className="btn btn-light" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Contribute now <ArrowRight size={18}/></button></div></section>
  </>;
}

function About({ navigate, hasProfile }) {
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
            <button className="btn btn-primary" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Start contributing <ArrowRight size={18} /></button>
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
          <button className="btn btn-light" onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Start Contributing <ArrowRight size={18} /></button>
        </div>
        <p className="about-signoff">Built for the people. Powered by their voice. 🇳🇬</p>
      </section>
    </section>
  );
}

function StatePage({ navigate }) {
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

function Profile({ navigate, profile, onLogout }) {
  const [tab, setTab] = useState('overview');
  const overviewIconMap = { total: <BarChart3 size={20}/>, text: <Layers size={20}/>, voice: <Mic size={20}/>, both: <Award size={20}/>, mix: <MessageCircle size={20}/>, reviews: <Users size={20}/> };
  const overviewToneMap = { total: 'tone-green', text: 'tone-blue', voice: 'tone-purple', both: 'tone-gold', mix: 'tone-pink', reviews: 'tone-teal' };

  const badgeCategories = [];
  for (const b of profile.badges) {
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
            <div><span className="profile-hero-label">Your progress</span><h1>{profile.nickname ? profile.nickname : 'My Profile'}</h1></div>
          </div>
          <button className="btn btn-light logout-btn" onClick={onLogout}><LogOut size={16}/> Log out</button>
        </div>
        <div className="profile-pills">
          <span className="profile-pill"><Award size={14}/> {profile.points} pts</span>
          <span className="profile-pill"><Trophy size={14}/> #{profile.rank} rank</span>
          <span className="profile-pill"><Mic size={14}/> {profile.submissions} submissions</span>
          <span className="profile-pill"><Users size={14}/> {profile.reviews} reviews</span>
        </div>
      </div>

      <div className="profile-level-card">
        <span className="profile-level-icon"><Award size={22}/></span>
        <div className="profile-level-body">
          <div className="profile-level-row"><b>{profile.level}</b><span>{profile.levelProgress}/{profile.levelTarget}</span></div>
          <div className="progress-track green-track"><i style={{width: `${Math.min(100, (profile.levelProgress/profile.levelTarget)*100)}%`}}/></div>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={tab==='overview'?'profile-tab active':'profile-tab'} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab==='activity'?'profile-tab active':'profile-tab'} onClick={() => setTab('activity')}>Activity</button>
        <button className={tab==='badges'?'profile-tab active':'profile-tab'} onClick={() => setTab('badges')}>Badges ({profile.badgesEarned})</button>
      </div>

      {tab === 'overview' && <div className="profile-panel">
        <div className="overview-grid">
          {profile.overview.map(s => <div className={`overview-card ${overviewToneMap[s.icon]}`} key={s.label}><span className="overview-icon">{overviewIconMap[s.icon]}</span><strong>{s.number}</strong><span>{s.label}</span></div>)}
        </div>

        <div className="points-breakdown-card">
          <h3>Points Breakdown</h3>
          <div className="breakdown-rows">
            {profile.breakdown.map(row => <div className="breakdown-row" key={row.label}>
              <span className="breakdown-label">{row.label}</span>
              <span className="breakdown-calc">{row.count} × {row.rate}pts</span>
              <span className="breakdown-pts">{row.count * row.rate} pts</span>
            </div>)}
          </div>
          <div className="breakdown-total-row"><span>Total</span><strong>{profile.breakdown.reduce((s,r) => s + r.count * r.rate, 0)} pts</strong></div>
        </div>

        <div className="invite-card">
          <h3>🤝 Invite Friends</h3>
          <p>Earn <strong>+10 points</strong> for every person who joins!</p>
          <div className="invite-link-row">
            <span className="invite-link">{profile.referral.url}</span>
            <button className="invite-copy-btn" onClick={() => navigator.clipboard?.writeText(profile.referral.url)}>Copy</button>
          </div>
          <div className="invite-stats-row">
            <span className="invite-stat-pill"><Users size={14}/> {profile.referral.joined} joined</span>
            <span className="invite-stat-pill gold"><Award size={14}/> +{profile.referral.points} pts</span>
          </div>
          <button className="btn invite-whatsapp" onClick={() => {
            const shareText = `🇳🇬 Join me on Nuji! Let's build AI that understands our Nigerian languages. Use my link to start contributing: ${profile.referral.url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
          }}><MessageCircle size={17}/> Share on WhatsApp</button>
          <button className="btn btn-primary invite-continue" onClick={() => navigate('contribute')}>Continue Contributing <ArrowRight size={17}/></button>
        </div>
      </div>}

      {tab === 'activity' && <div className="profile-panel">
        <div className="activity-card">
          <h3>Contribution Activity</h3>
          <p className="activity-sub">{profile.submissions} contributions in the last year</p>
          <div className="activity-months">{profile.activityMonths.map((m, i) => <span key={i}>{m}</span>)}</div>
          <div className="activity-scroll">
            <div className="activity-cells">
              {profile.activityCells.map((level, i) => <span key={i} className={`activity-cell level-${level}`}/>)}
            </div>
          </div>
          <div className="activity-legend">
            <span>Less</span>
            <i className="level-0"/><i className="level-1"/><i className="level-2"/><i className="level-3"/><i className="level-4"/>
            <span>More</span>
          </div>
        </div>
        <div className="streak-card"><span className="streak-icon">🔥</span><div><b>{profile.streak} day streak!</b><small>Keep contributing daily to maintain your streak</small></div></div>
      </div>}

      {tab === 'badges' && <div className="profile-panel">
        <div className="badges-head">
          <div><h3>All Badges</h3><p className="activity-sub">{profile.badgesEarned} of {profile.badgesTotal} earned</p></div>
          <span className="badges-percent">{Math.round((profile.badgesEarned/profile.badgesTotal)*100)}%</span>
        </div>
        <div className="progress-track green-track"><i style={{width: `${(profile.badgesEarned/profile.badgesTotal)*100}%`}}/></div>
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

function Join({ navigate, language, setLanguage, phone, setPhone, onSaved }) {
  const [step, setStep] = useState('phone');
  const [localPhone, setLocalPhone] = useState(phone);
  const [phoneError, setPhoneError] = useState('');
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
    const normalized = normalizeNaija(localPhone);
    if (!validNaijaPhone(normalized)) {
      setPhoneError('Enter a valid Nigerian number, e.g. 0803 123 4567');
      return;
    }
    setPhoneError('');
    setLocalPhone(normalized);
    setPhone(normalized);
    const res = await api.checkPhone(normalized);
    // Registered member (full profile) -> straight to the profile dashboard
    if (res && res.hasProfile) { navigate('contribute'); return; }
    // Brand-new number OR previously quick-contributed -> show both options
    setReturning(false);
    setStep('choose');
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
              <input value={localPhone} onChange={e => { setLocalPhone(e.target.value); setPhoneError(''); }} placeholder="0803 123 4567" inputMode="tel" required/>
              {phoneError && <small style={{color:'#c0392b',fontWeight:700}}>{phoneError}</small>}
            </Field>
            <button className="btn btn-primary phone-submit" type="submit">Continue <ArrowRight size={18}/></button>
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

function Field({label, children}) { return <label className="form-field"><span>{label}</span>{children}</label> }
function Trust({icon,title,text}) { return <div className="trust-item"><span>{icon}</span><div><b>{title}</b><small>{text}</small></div></div> }

const exampleResponses = [
  "Nna men! Where you dey? E don tey — kedu ka ị mere? Hope everything dey okay sha.",
  "Biko come help me carry this thing, my body no fit again — agwụọla m ike!",
  "Oya let's go! Time waits for no one — anyị gaghị abia oge!",
];
const formalityLevels = ['Very Casual', 'Normal', 'Formal'];

function Contribute({ language, setLanguage, phone, refreshProfile, navigate, online }) {
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
    if (hasText && textResponse.trim().split(/\s+/).length < 3) {
      setSubmitError('Too short — use at least 3 words.');
      return;
    }
    // final safety net: re-validate the audio at submit time
    if (audioBlob) {
      const probs = audioProblems(audioMeta);
      const dur = (audioMeta && audioMeta.duration) || time;
      if (dur < 3 || probs.length) {
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

function Listen({ language, setLanguage, phone, refreshProfile, navigate }) {
  const [decision, setDecision] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState(null); // real submission from Supabase: voice + response + prompt + translation
  const [clipLoading, setClipLoading] = useState(true);
  const [clipNum, setClipNum] = useState(1);
  const [skip, setSkip] = useState(0);       // skips do NOT count toward the session
  const [excludeIds, setExcludeIds] = useState([]); // clip ids already shown this session (reviewed or skipped) — never shown twice
  const [dur, setDur] = useState(0);         // real duration of this recording
  const audioRef = useRef(null);
  const clipId = clip ? clip.id : null;

  // Pull the next pending submission (with voice) from the database.
  // `phone` is always sent so the backend can exclude the current contributor's
  // own submissions — nobody should be able to review or listen to their own clip.
  // `excludeList` accumulates every clip id already shown this session (reviewed
  // or skipped) so the same clip is never served twice in a row.
  const fetchClip = useCallback((currentSkip, excludeList) => {
    setClipLoading(true);
    setClip(null);
    api.pendingClip(language.name, phone, currentSkip, excludeList.join(','))
      .then(c => { setClip(c || null); setClipLoading(false); })
      .catch(() => { setClip(null); setClipLoading(false); });
  }, [language.name, phone]);

  // fresh session whenever the language (or logged-in contributor) changes
  useEffect(() => {
    setDecision(null); setSkip(0); setExcludeIds([]); setClipNum(1);
    fetchClip(0, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language.name, phone]);

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

  // move to the next clip after a decision or a skip, making sure we never
  // re-serve a clip already shown this session
  const advance = (nextSkip) => {
    const newExcludes = clip ? [...excludeIds, clip.id] : excludeIds;
    setExcludeIds(newExcludes);
    setSkip(nextSkip);
    fetchClip(nextSkip, newExcludes);
  };

  const next = () => {
    setDecision(null);
    advance(0);
  };

  const decide = async (d) => {
    if (!clip) return;
    setDecision(d);
    await api.submitReview({ phone: phone || undefined, clipId: clip.id, decision: d });
    refreshProfile();
    setClipNum(c => c + 1);
    // the next clip is only fetched once the user taps "Next clip" on the
    // thank-you screen, via next() -> advance()
  };

  const skipClip = () => {
    if (!clip) return;
    advance(skip + 1);
  };

  const noClipAvailable = !clipLoading && !clip && !decision;

  return <section className="task-page listen-page"><div className="container task-layout">
    <aside className="task-aside"><div className="eyebrow ink">Listen</div><h1>Help keep every<br/><em>voice clear.</em></h1><p>Listen to a short recording, compare it to the sentence, and make a simple call.</p><div className="task-aside-card"><span>Reviewing in</span><LanguageSelect language={language} setLanguage={setLanguage}/><div className="mini-progress"><div><span>This session</span><b>{clipNum}/10 clips</b></div><div className="progress-track green-track"><i style={{width: `${clipNum*10}%`}}/></div></div></div></aside>

    <div className="task-main">
      {noClipAvailable ? (
        <div className="task-card validation-card">
          <div className="task-icon neutral"><Headphones size={29}/></div>
          <h2>No available prompt to review.</h2>
          <p className="task-intro">There's nothing waiting for review in {language.name} right now — check back soon, or try another language.</p>
          <button className="btn btn-primary task-cta" onClick={() => navigate('home')}>Go to Home <ArrowRight size={18}/></button>
        </div>
      ) : <>
        <div className="review-kicker"><span>Clip {clipNum} of 10</span><span>About 1 minute left</span></div>
        <div className="task-card validation-card">
          <div className="task-card-head"><span className="language-badge"><span className={`dot ${language.color}`}/> {language.name}</span><span className="counter">Community review</span></div>
          {!decision ? <>
            <h2>Does this recording match?</h2>
            <div className="listen-prompt">
              <span>The prompt they responded to</span>
              <p>“{clip && clip.prompt ? clip.prompt : '—'}”</p>
              {clip && clip.text && (<><span style={{ display: 'block', marginTop: 10 }}>Contributor's response ({language.name}) — does the voice match it?</span><p>“{clip.text}”</p></>)}
              {clip && clip.translation && (<><span style={{ display: 'block', marginTop: 10 }}>English translation</span><p>“{clip.translation}”</p></>)}
            </div>
            {clip ? <div className="listen-player"><button className="listen-play" onClick={togglePlay} aria-label={playing ? 'Pause recording' : 'Play recording'}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button><div className="player-wave">{Array.from({length:35},(_,i) => <b key={i} style={{height: `${9 + Math.abs(Math.sin(i*.55))*28}px`}}/>)}</div><span>{dur ? fmtDur(dur) : '—'}</span></div> : <p className="task-help">Loading the next clip…</p>}
            <p className="decision-label">Listen once, then choose what you heard.</p>
            <div className="decision-grid">
              <button className="decision yes" disabled={!clip} onClick={() => decide('yes')}><span><Check size={21}/></span><div><b>Yes, it matches</b><small>The words are clear and correct</small></div></button>
              <button className="decision no" disabled={!clip} onClick={() => decide('no')}><span><X size={20}/></span><div><b>No, it doesn’t match</b><small>The words are different or unclear</small></div></button>
            </div>
            <button className="skip-btn" disabled={!clip} onClick={skipClip}>Skip this clip <SkipForward size={16}/></button>
          </> : <>
            <div className={`task-icon ${decision === 'yes' ? 'success' : 'neutral'}`}>{decision === 'yes' ? <Check size={29}/> : <X size={29}/>}</div>
            <h2>{decision === 'yes' ? 'Thanks for confirming.' : 'Thanks for reviewing.'}</h2>
            <p className="task-intro">Your review helps keep this collection useful for everyone who speaks {language.name}.</p>
            <button className="btn btn-primary task-cta" onClick={next}>Next clip <ArrowRight size={18}/></button>
            <button className="text-action centered" onClick={() => setDecision(null)}>Change answer</button>
          </>}
        </div>
      </>}
    </div>
  </div></section>;
}

function Leaderboard() {
  const [filter, setFilter] = useState('This month');
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.leaderboard().then(r => { if (r && r.length) setRows(r); });
    api.stats().then(s => { if (s) setStats(s); });
  }, []);
  const ranks = rows || FALLBACK_RANKS;

  return <section className="leader-page wave-bg slim-wave"><div className="container"><div className="leader-hero"><div><div className="eyebrow ink">Community progress</div><h1>Every contribution<br/>moves us <em>forward.</em></h1></div><p>A small thank-you to the people helping Nigerian languages take up the space they deserve.</p></div><div className="leader-stats"><Stat number={stats ? stats.sentences.toLocaleString() : '0'} label="Sentences contributed" accent="green"/><Stat number={stats ? stats.reviews.toLocaleString() : '0'} label="Clips reviewed" accent="green"/><Stat number="4" label="Languages growing" accent="green"/></div><div className="leader-controls"><div className="filters">{['This week','This month','All time'].map(x => <button key={x} className={filter === x ? 'filter active' : 'filter'} onClick={() => setFilter(x)}>{x}</button>)}</div><button className="language-nav leader-lang"><span className="dot"/> All languages <ChevronDown size={16}/></button></div><div className="leaderboard-card"><div className="rank-head"><span>Rank</span><span>Contributor</span><span>Language</span><span>Contributions</span></div>{ranks.map((r,i) => <div className={`rank-row ${i<3 ? 'top-rank' : ''}`} key={r[0]}><span className={`rank-num rank-${i+1}`}>{i<3 ? <Trophy size={18}/> : String(i+1).padStart(2,'0')}</span><span className="person"><i>{r[0].split(' ').map(x => x[0]).join('')}</i><b>{r[0]}</b></span><span className="rank-lang"><span className="dot"/>{r[1]}</span><span className="rank-count">{r[2]}</span></div>)}</div><div className="rank-note"><span><Check size={16}/> Rankings celebrate contribution, not competition.</span><span>Updated today</span></div></div></section>;
}

function LanguageSelect({language,setLanguage}) { const [open,setOpen]=useState(false); return <div className="selector-wrap"><button className="select-button" onClick={() => setOpen(!open)}>{language.name}<ChevronDown size={16}/></button>{open&&<div className="select-menu">{languages.map(l => <button key={l.name} onClick={() => {setLanguage(l);setOpen(false)}}><span className={`dot ${l.color}`}/>{l.name}{l.name===language.name&&<Check size={15}/>}</button>)}</div>}</div> }

function Stat({number,label,accent}) { return <div className={`stat ${accent}`}><strong>{number}</strong><span>{label}</span><i/></div> }
function Path({icon,number,title,text,cta,action,tone}) { return <article className={`path-card ${tone}`}><div className="path-top"><span className="path-icon">{icon}</span><span>{number}</span></div><h3>{title}</h3><p>{text}</p><button onClick={action}>{cta}<ArrowRight size={17}/></button></article> }

function Footer({navigate, hasProfile}) {
  const socials = [
    { label: 'Facebook', d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
    { label: 'Instagram', d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
    { label: 'Telegram', d: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
    { label: 'WhatsApp', d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' },
    { label: 'Twitter/X', d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
    { label: 'TikTok', d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84.02 8.76-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.3-.67.31-1.06.04-2.26.02-4.51.02-6.77.02-2.93-.01-5.85.02-8.78z' },
  ];
  return <footer className="footer"><div className="container footer-grid">
    <div><button className="brand footer-brand" onClick={() => navigate('home')}><img className="brand-logo" src="/assets/nuji-logo.png" alt=""/><span>nuji</span></button><p>Language data made by the people who speak it.</p>
      <div className="footer-social">
        {socials.map(s => <a key={s.label} href="#" aria-label={s.label}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={s.d}/></svg></a>)}
      </div>
    </div>
    <div className="footer-links"><div><span>Explore</span><button onClick={() => navigate(hasProfile ? 'contribute' : 'join')}>Contribute</button><button onClick={() => navigate('listen')}>Listen</button><button onClick={() => navigate('leaderboard')}>Leaderboard</button><button onClick={() => navigate('state')}>State vs State</button></div><div><span>Languages</span><button>Igbo</button><button>Yoruba</button><button>Hausa</button><button>Pidgin</button></div></div>
  </div><div className="container footer-bottom"><span>© 2026 Nuji. Built for voices.</span><span>Open · Community-led · Nigerian · <button className="footer-admin" onClick={() => { window.location.assign('/admin'); }}>Admin</button></span></div></footer>;
}

createRoot(document.getElementById('root')).render(<App />);
