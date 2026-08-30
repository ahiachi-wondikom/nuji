// ============================================================
// Nuji backend — Express API server (port 4000)
// Run with:  npm run server
// ============================================================
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  getDB, save, findUser, createUser, POINT_RULES,
  levelInfo, totalSubs, BADGES, earnedBadges, activityPayload, bumpDay,
  rankOf, topLanguage, STATE_ZONES
} from './db.js';

// ---- prompts store (admin-managed, database only) ----
{
  const d = getDB();
  if (!d.prompts) {
    d.prompts = [];
    d.promptSeq = 1;
    save();
  }
}

// Accepts 0803..., +234803..., 234803...
const normalizePhone = (p) => {
  let d = String(p || '').replace(/[\s-]/g, '');
  if (d.startsWith('+234')) d = '0' + d.slice(4);
  else if (d.startsWith('234')) d = '0' + d.slice(3);
  return d;
};
const validNaijaPhone = (p) => /^0(70|80|81|90|91|93)\d{8}$/.test(p);

// ---------- duplicate detection ----------
const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9à-öø-ÿ-ỿ-]+/g, ' ').trim();
const tokensOf = (s) => normText(s).split(' ').filter(Boolean);
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// friendly root so the Render URL shows a status instead of "Cannot GET /"
app.get('/', (req, res) => res.json({ ok: true, service: 'nuji-api', try: ['/api/leaderboard', '/api/states', '/api/stats'] }));

// ---------- voice recording uploads ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webm`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
app.use('/uploads', express.static(UPLOAD_DIR));

// ================= AUTH / PROFILE =================

// Check a phone number; creates the account if new
app.post('/api/auth/phone', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!validNaijaPhone(phone)) return res.status(400).json({ error: 'Enter a valid Nigerian number, e.g. 0803 123 4567' });
  const existing = findUser(phone);
  const user = existing || createUser(phone);
  res.json({ exists: !!existing, phone: user.phone, hasProfile: user.profileKind === 'full' });
});

// kind: 'full' (create profile form) | 'quick' (quick-contribute questions)
app.post('/api/profile', (req, res) => {
  const { phone, nickname, state, lga, age, gender, languages, contribution, ref, kind } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  const user = createUser(phone);

  Object.assign(user, {
    nickname: kind === 'full' ? (nickname || '') : (user.nickname || ''),
    state: state || user.state,
    lga: kind === 'full' ? (lga || '') : (user.lga || ''),
    age: age || user.age,
    gender: gender || user.gender,
    languages: kind === 'full' ? (languages || []) : (user.languages || []),
    contributionLang: contribution || user.contributionLang
  });
  if (kind === 'full') user.profileKind = 'full';
  else if (!user.profileKind) user.profileKind = 'quick';
  if (user.languages.length) {
    for (const l of user.languages) user.langCounts[l] = user.langCounts[l] || 0;
  }

  // referral: +10 points to the referrer, once
  if (ref && !user.referredBy) {
    const referrer = Object.values(getDB().users).find(u => u.refCode === ref);
    if (referrer && referrer.phone !== user.phone) {
      user.referredBy = ref;
      referrer.referrals += 1;
      referrer.points += POINT_RULES.referral;
    }
  }

  save();
  res.json(profilePayload(user));
});

// Full profile payload used by the Profile page
app.get('/api/profile/:phone', (req, res) => {
  const user = findUser(req.params.phone);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(profilePayload(user));
});

function profilePayload(user) {
  const act = activityPayload(user);
  const earned = earnedBadges(user);
  return {
    phone: user.phone,
    nickname: user.nickname,
    state: user.state,
    lga: user.lga,
    points: user.points,
    rank: rankOf(user.phone),
    submissions: totalSubs(user),
    reviews: user.reviews,
    ...levelInfo(user.points),
    streak: user.streak,
    profileKind: user.profileKind || null,
    hasProfile: user.profileKind === 'full',
    overview: [
      { icon: 'total', number: totalSubs(user), label: 'Total' },
      { icon: 'text', number: user.subs.text, label: 'Text Only' },
      { icon: 'voice', number: user.subs.voice, label: 'Voice Only' },
      { icon: 'both', number: user.subs.both, label: 'Text + Voice' },
      { icon: 'mix', number: user.subs.mix, label: 'Code-switched' },
      { icon: 'reviews', number: user.reviews, label: 'Reviews Done' }
    ],
    breakdown: [
      { label: 'Text only', count: user.subs.text, rate: POINT_RULES.text },
      { label: 'Voice only', count: user.subs.voice, rate: POINT_RULES.voice },
      { label: 'Text + Voice', count: user.subs.both, rate: POINT_RULES.both }
    ],
    activityCells: act.cells,
    activityMonths: act.months,
    badges: BADGES.map(b => ({ ...b, earned: earned.includes(b.name) })),
    badgesEarned: earned.length,
    badgesTotal: BADGES.length,
    referral: {
      url: `https://nuji-test.netlify.app?ref=${user.refCode}`,
      refCode: user.refCode,
      joined: user.referrals,
      points: user.referrals * POINT_RULES.referral
    }
  };
}

// ================= PROMPTS =================
app.get('/api/prompts', (req, res) => {
  const language = req.query.language || 'Igbo';
  const seed = parseInt(req.query.seed || '0', 10);
  // RATIONING: max 2 contributors per prompt, then rotate
  // Prompts are English source sentences — same prompt for every language (contributors translate it)
  const db = getDB();
  const pool = db.prompts.filter(p => p.is_active);
  let p = pool.filter(x => (x.uses || 0) < 2).sort((a, b) => (a.uses - b.uses) || (a.id - b.id))[0]
         || pool.sort((a, b) => (a.uses - b.uses) || (a.id - b.id))[0];
  if (p) { p.uses = (p.uses || 0) + 1; save(); return res.json({ text: p.text, language, id: p.id, uses: p.uses }); }
  res.json({ text: '', language });
});

// ================= CONTRIBUTIONS =================

// Accepts JSON (text only) or multipart with an "audio" file (voice / both)
app.post('/api/contributions', upload.single('audio'), (req, res) => {
  const body = { ...req.body, ...(req.body.data ? JSON.parse(req.body.data) : {}) };
  const { phone, language, text, translation, langs = [], formality, prompt } = body;

  const hasText = !!String(text || '').trim();
  const hasVoice = !!req.file;
  if (!hasText && !hasVoice) return res.status(400).json({ error: 'Nothing to submit' });
  if (hasText && String(text).trim().split(/\s+/).length < 3) return res.status(400).json({ error: 'too_short_text' });

  // quality gate
  const duration = Number(body.duration) || 0;
  if (hasVoice && duration > 0 && duration < 3) return res.status(400).json({ error: 'too_short' });

  // duplicate detection
  if (hasText && phone) {
    const prev = getDB().contributions.filter(c => c.phone === normalizePhone(phone)).slice(-50);
    const t1 = tokensOf(body.text);
    for (const p of prev) {
      if (normText(p.text) && (normText(p.text) === normText(body.text) || jaccard(t1, tokensOf(p.text)) >= 0.85)) {
        return res.status(409).json({ error: 'duplicate' });
      }
    }
  }

  const mix = (langs || []).length >= 2;
  const earned = (hasText && hasVoice ? POINT_RULES.both : hasVoice ? POINT_RULES.voice : POINT_RULES.text) + (mix ? POINT_RULES.mix : 0);

  let user = null;
  if (phone) {
    user = createUser(phone);
    user.points += earned;
    if (hasText && hasVoice) user.subs.both += 1;
    else if (hasVoice) user.subs.voice += 1;
    else user.subs.text += 1;
    if (mix) user.subs.mix += 1;
    for (const l of (langs.length ? langs : [language])) user.langCounts[l] = (user.langCounts[l] || 0) + 1;
    bumpDay(user);
  }

  const speaker = user ? { age: user.age || '', gender: user.gender || '', state: user.state || '', lga: user.lga || '', dialect: user.state || '' } : {};
  const contribution = {
    id: crypto.randomUUID(),
    phone: phone || null,
    language,
    prompt: prompt || '',
    text: text || '',
    translation: translation || '',
    langs,
    formality: formality || 'Normal',
    audioUrl: req.file ? `/uploads/${req.file.filename}` : null,
    points: earned,
    duration,
    status: 'pending',
    qualityFlags: [],
    speaker,
    annotation: '',
    reviews: [],
    createdAt: new Date().toISOString()
  };
  getDB().contributions.push(contribution);
  save();

  res.json({ ok: true, earned, totalPoints: user ? user.points : earned, contributionId: contribution.id });
});

// ================= LISTEN / REVIEWS =================

// A clip awaiting review: has audio, fewer than 3 reviews
app.get('/api/clips', (req, res) => {
  const language = req.query.language;
  const skip = parseInt(req.query.skip || '0', 10);
  const exclude = req.query.exclude || '';
  const reviewerPhone = req.query.phone ? normalizePhone(req.query.phone) : '';
  const pool = [...getDB().contributions].reverse()
    .filter(c =>
      c.audioUrl &&
      (c.status || 'pending') === 'pending' &&
      (c.reviews || []).length < 3 &&
      c.phone !== reviewerPhone &&
      c.id !== exclude &&
      !(c.reviews || []).some(r => r.phone && r.phone === reviewerPhone)
    );
  const clip = pool.length ? pool[Math.min(skip, pool.length - 1)] : null;
  if (!clip) return res.json(null);
  res.json({ id: clip.id, audioUrl: clip.audioUrl, prompt: clip.prompt || '', text: clip.text || '' });
});

app.post('/api/reviews', (req, res) => {
  const { phone, clipId, decision } = req.body;
  const db = getDB();
  const clip = db.contributions.find(c => c.id === clipId);
  if (!clip) return res.status(404).json({ error: 'Clip not found' });

  clip.reviews.push({ phone: phone || null, decision, at: new Date().toISOString() });
  if (clip.reviews.length >= 3) {
    const yes = clip.reviews.filter(r => r.decision === 'yes').length;
    const no = clip.reviews.filter(r => r.decision === 'no').length;
    clip.status = yes > no ? 'approved' : 'flagged';
  }

  let user = null;
  if (phone) {
    user = createUser(phone);
    user.reviews += 1;
    user.points += POINT_RULES.review;
    bumpDay(user);
  }
  save();
  res.json({ ok: true, earned: POINT_RULES.review, totalPoints: user ? user.points : POINT_RULES.review });
});

// ================= PUBLIC DATA =================

app.get('/api/leaderboard', (req, res) => {
  const rows = Object.values(getDB().users)
    .filter(u => totalSubs(u) > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)
    .map(u => [u.nickname || 'Anonymous', topLanguage(u), totalSubs(u).toLocaleString()]);
  res.json(rows);
});

app.get('/api/states', (req, res) => {
  const agg = {};
  for (const u of Object.values(getDB().users)) {
    if (!u.state) continue;
    const s = agg[u.state] = agg[u.state] || { name: u.state, zone: STATE_ZONES[u.state] || '—', points: 0, contributors: 0, submissions: 0 };
    s.points += u.points;
    s.contributors += 1;
    s.submissions += totalSubs(u);
  }
  res.json(Object.values(agg));
});

// ================= COMMUNITY TOTALS =================
app.get('/api/stats', (req, res) => {
  const db = getDB();
  res.json({
    sentences: db.contributions.length,
    reviews: db.contributions.reduce((s, c) => s + (c.reviews || []).length, 0)
  });
});

// ================= ADMIN (token-protected) =================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nuji.ng';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nuji-admin-2026';
const SECRET = process.env.ADMIN_SECRET || 'nuji-dev-secret';

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
};
const verifyToken = (token) => {
  try {
    const [body, sig] = String(token).split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (sig !== expect) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
};

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ token: signToken({ exp: Date.now() + 12 * 3600 * 1000 }) });
  }
  res.status(401).json({ error: 'Invalid email or password' });
});

const requireAdmin = (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '')) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const subsOf = (u) => (u.subs ? (u.subs.text || 0) + (u.subs.voice || 0) + (u.subs.both || 0) : 0);

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const db = getDB();
  const U = Object.values(db.users), C = [...db.contributions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 500);
  const dayMs = 86400000, now = Date.now();
  const byLang = {}, byDay = {};
  for (const c of C) {
    byLang[c.language] = (byLang[c.language] || 0) + 1;
    const d = (c.createdAt || '').slice(0, 10);
    if (d) byDay[d] = (byDay[d] || 0) + 1;
  }
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * dayMs).toISOString().slice(0, 10);
    return { date: d, count: byDay[d] || 0 };
  });
  const statesAgg = {};
  for (const u of U) {
    if (!u.state) continue;
    const s = statesAgg[u.state] = statesAgg[u.state] || { name: u.state, zone: STATE_ZONES[u.state] || '—', points: 0, contributors: 0, submissions: 0 };
    s.points += u.points || 0; s.contributors += 1; s.submissions += subsOf(u);
  }
  res.json({
    totals: {
      users: U.length,
      profiles: U.filter(u => u.profileKind === 'full').length,
      quick: U.filter(u => u.profileKind === 'quick').length,
      contributions: db.contributions.length,
      audio: db.contributions.filter(c => c.audioUrl).length,
      textOnly: db.contributions.filter(c => !c.audioUrl && c.text).length,
      reviews: db.contributions.reduce((s, c) => s + (c.reviews || []).length, 0),
      pointsIssued: U.reduce((s, u) => s + (u.points || 0), 0),
      signups7: U.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < 7 * dayMs).length,
      audioHours: Math.round((db.contributions.reduce((s, c) => s + (c.duration || 0), 0) / 3600) * 100) / 100,
      approved: db.contributions.filter(c => (c.status || 'pending') === 'approved').length,
      pending: db.contributions.filter(c => (c.status || 'pending') === 'pending').length,
      flagged: db.contributions.filter(c => (c.status || 'pending') === 'flagged').length,
      rejected: db.contributions.filter(c => (c.status || 'pending') === 'rejected').length,
      needTranslation: db.contributions.filter(c => !c.translation).length
    },
    byLang, last14,
    topUsers: [...U].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10)
      .map(u => ({ name: u.nickname || 'Anonymous', phone: u.phone, state: u.state || '—', points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0 })),
    recentUsers: [...U].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 10)
      .map(u => ({ phone: u.phone, nickname: u.nickname || '—', state: u.state || '—', kind: u.profileKind || 'none', points: u.points || 0, createdAt: u.createdAt })),
    recentContribs: C.slice(0, 200).map(c => ({
      id: c.id, phone: c.phone || 'guest', language: c.language, prompt: c.prompt || '',
      text: (c.text || '').slice(0, 120), fullText: c.text || '', hasAudio: !!c.audioUrl, audioUrl: c.audioUrl || null,
      points: c.points || 0, duration: c.duration || 0, status: c.status || 'pending',
      hasTranslation: !!c.translation, translation: c.translation || '', annotation: c.annotation || '',
      annotation_status: c.annotationStatus || 'pending',
      speaker: c.speaker || {}, langs: c.langs || [], formality: c.formality || '',
      reviews: (c.reviews || []).length, maxReviews: 3, createdAt: c.createdAt
    })),
    topStates: Object.values(statesAgg).sort((a, b) => b.points - a.points).slice(0, 10),
    allUsers: [...U].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 200).map(u => ({
      phone: u.phone, nickname: u.nickname || '', state: u.state || '', lga: u.lga || '', age: u.age || '',
      gender: u.gender || '', languages: u.languages || [], contributionLang: u.contributionLang || 'Igbo',
      kind: u.profileKind || 'none', refCode: u.refCode || '', referredBy: u.referredBy || '',
      points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0, streak: u.streak || 0,
      bestStreak: u.bestStreak || 0, badgesEarned: earnedBadges(u).length, createdAt: u.createdAt || ''
    }))
  });
});

// admin: approve / flag / reject
app.post('/api/admin/status', requireAdmin, (req, res) => {
  const { id, status } = req.body || {};
  if (!['approved', 'flagged', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  const c = getDB().contributions.find(x => x.id === id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.status = status;
  save();
  res.json({ ok: true });
});

// admin: save translation / annotation
app.post('/api/admin/meta', requireAdmin, (req, res) => {
  const { id, translation, annotation } = req.body || {};
  const c = getDB().contributions.find(x => x.id === id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (typeof translation === 'string') c.translation = translation;
  if (typeof annotation === 'string') c.annotation = annotation;
  if (typeof (req.body || {}).annotationStatus === 'string') c.annotationStatus = req.body.annotationStatus;
  if (typeof (req.body || {}).text === 'string') c.text = req.body.text;
  save();
  res.json({ ok: true });
});

// admin: attach a missing voice recording to a submission
app.post('/api/admin/audio', requireAdmin, upload.single('audio'), (req, res) => {
  const id = (req.body || {}).id;
  if (!id || !req.file) return res.status(400).json({ error: 'id and audio file required' });
  const c = getDB().contributions.find(x => x.id === id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const fname = `admin-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webm`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), req.file.buffer);
  c.audioUrl = `/uploads/${fname}`;
  if (req.body.duration) c.duration = Number(req.body.duration) || 0;
  save();
  res.json({ ok: true, audioUrl: c.audioUrl });
});

// ================= ADMIN: ANALYTICS =================
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const db = getDB();
  const U = Object.values(db.users), C = db.contributions;
  const langCounts = {}, stateCounts = {}, genderDist = {}, byDay = {};
  let codeSwitch = 0, approved = 0, pending = 0, flagged = 0, audio = 0;
  const dayMs = 86400000, now = Date.now();
  for (const c of C) {
    langCounts[c.language] = (langCounts[c.language] || 0) + 1;
    if ((c.langs || []).length > 1) codeSwitch++;
    if (c.audioUrl) audio++;
    const st = c.status || 'pending';
    if (st === 'approved') approved++; else if (st === 'flagged') flagged++; else pending++;
    const d = (c.createdAt || '').slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + 1;
  }
  const lastByUser = {};
  for (const c of C) if (c.phone) { const d = c.createdAt || ''; if (!lastByUser[c.phone] || d > lastByUser[c.phone]) lastByUser[c.phone] = d; }
  for (const u of U) {
    if (u.state) stateCounts[u.state] = (stateCounts[u.state] || 0) + 1;
    genderDist[u.gender || 'Unknown'] = (genderDist[u.gender || 'Unknown'] || 0) + 1;
  }
  const growthByDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * dayMs).toISOString().slice(0, 10);
    return { date: d, count: byDay[d] || 0 };
  });
  const oldUsers = U.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() >= 7 * dayMs);
  const stillActive = oldUsers.filter(u => lastByUser[u.phone] && now - new Date(lastByUser[u.phone]).getTime() <= 7 * dayMs).length;
  res.json({
    langCounts, stateCounts, genderDistribution: genderDist, growthByDay,
    totalSubmissions: C.length, approved, pending, flagged, audio,
    totalContributors: U.length,
    approvalRate: C.length ? Math.round(approved / C.length * 100) : 0,
    flagRate: C.length ? Math.round(flagged / C.length * 100) : 0,
    codeSwitchRate: C.length ? Math.round(codeSwitch / C.length * 100) : 0,
    retention: { week1Total: oldUsers.length, stillActive, retentionRate: oldUsers.length ? Math.round(stillActive / oldUsers.length * 100) : 0 }
  });
});

// ================= ADMIN: PROMPTS MANAGER =================
app.get('/api/admin/prompts', requireAdmin, (req, res) => res.json([...getDB().prompts].reverse().slice(0, 300)));
app.post('/api/admin/prompts', requireAdmin, (req, res) => {
  const { text, language, category } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  const db = getDB();
  db.prompts.push({ id: db.promptSeq++, language: language || 'Igbo', category: category || 'Greetings', text: text.trim(), is_active: true });
  save();
  res.json({ ok: true });
});
app.post('/api/admin/prompts/bulk', requireAdmin, (req, res) => {
  const { lines = [], language = 'Igbo', category = 'Greetings' } = req.body || {};
  const rows = lines.map(l => String(l || '').trim()).filter(l => l.length > 3);
  if (!rows.length) return res.status(400).json({ error: 'No valid lines' });
  const db = getDB();
  rows.forEach(t => db.prompts.push({ id: db.promptSeq++, language, category, text: t, is_active: true }));
  save();
  res.json({ ok: true, count: rows.length });
});
app.post('/api/admin/prompts/delete', requireAdmin, (req, res) => {
  const db = getDB();
  db.prompts = db.prompts.filter(p => p.id !== (req.body || {}).id);
  save();
  res.json({ ok: true });
});
app.post('/api/admin/prompts/toggle', requireAdmin, (req, res) => {
  const p = getDB().prompts.find(x => x.id === (req.body || {}).id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.is_active = !p.is_active;
  save();
  res.json({ ok: true });
});

// ================= ADMIN: ANNOTATION QUEUE =================
app.get('/api/admin/annotate-queue', requireAdmin, (req, res) => {
  const q = [...getDB().contributions].reverse()
    .filter(c => (c.text || '').trim() && (c.annotationStatus || 'pending') === 'pending');
  res.json(q.slice(0, 50));
});

// ================= START =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Nuji API running on http://localhost:${PORT}`));
