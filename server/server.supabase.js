// ============================================================
// Nuji PRODUCTION backend — Supabase (Postgres + Storage)
//   Run locally : SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run start:supabase
//   Deploy      : Render with the same two env vars, start: npm run start:supabase
// ============================================================
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  POINT_RULES, levelInfo, totalSubs, BADGES, earnedBadges,
  activityPayload, bumpDay, topLanguage, STATE_ZONES
} from './db.js';


const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { realtime: { transport: ws } });
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// friendly root so the Render URL shows a status instead of "Cannot GET /"
app.get('/', (req, res) => res.json({ ok: true, service: 'nuji-api', try: ['/api/leaderboard', '/api/states', '/api/stats'] }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ---------------- helpers ----------------
// Accepts 0803..., +234803..., 234803..., strips spaces/dashes
const normalizePhone = (p) => {
  let d = String(p || '').replace(/[\s-]/g, '');
  if (d.startsWith('+234')) d = '0' + d.slice(4);
  else if (d.startsWith('234')) d = '0' + d.slice(3);
  return d;
};
const validNaijaPhone = (p) => /^0(70|80|81|90|91|93)\d{8}$/.test(p);

// ---------- duplicate detection ----------
const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9à-öø-ÿ-ỿ]+/g, ' ').trim();
const tokensOf = (s) => normText(s).split(' ').filter(Boolean);
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
};

const blankUser = (phone) => ({
  phone, nickname: '', state: '', lga: '', age: '', gender: '', languages: [],
  contributionLang: 'Igbo',
  refCode: 'NJ' + phone.replace(/\D/g, '').slice(-6),
  referredBy: null, referrals: 0, points: 0,
  subs: { text: 0, voice: 0, both: 0, mix: 0 }, langCounts: {},
  reviews: 0, days: {}, streak: 0, bestStreak: 0, lastDay: null, earlyBird: false,
  profileKind: null
});

const toUser = (r) => ({
  phone: r.phone, nickname: r.nickname, state: r.state, lga: r.lga, age: r.age, gender: r.gender,
  languages: r.languages, contributionLang: r.contribution_lang, refCode: r.ref_code, referredBy: r.referred_by,
  referrals: r.referrals, points: r.points, subs: r.subs, langCounts: r.lang_counts, reviews: r.reviews,
  days: r.days, streak: r.streak, bestStreak: r.best_streak, lastDay: r.last_day, earlyBird: r.early_bird,
  profileKind: r.profile_kind
});

const toRow = (u) => ({
  phone: u.phone, nickname: u.nickname, state: u.state, lga: u.lga, age: u.age, gender: u.gender,
  languages: u.languages, contribution_lang: u.contributionLang, ref_code: u.refCode, referred_by: u.referredBy,
  referrals: u.referrals, points: u.points, subs: u.subs, lang_counts: u.langCounts, reviews: u.reviews,
  days: u.days, streak: u.streak, best_streak: u.bestStreak, last_day: u.lastDay, early_bird: u.earlyBird,
  profile_kind: u.profileKind
});

async function getUser(phone) {
  const { data } = await supabase.from('users').select('*').eq('phone', normalizePhone(phone)).maybeSingle();
  return data ? toUser(data) : null;
}
async function saveUser(u) {
  const { error } = await supabase.from('users').upsert(toRow(u));
  if (error) throw error;
}
async function rankOf(phone) {
  const me = await getUser(phone);
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).gt('points', me ? me.points : 0);
  return (count || 0) + 1;
}

async function profilePayload(user) {
  const act = activityPayload(user);
  const earned = earnedBadges(user);
  return {
    phone: user.phone, nickname: user.nickname, state: user.state, lga: user.lga,
    points: user.points, rank: await rankOf(user.phone),
    submissions: totalSubs(user), reviews: user.reviews,
    ...levelInfo(user.points), streak: user.streak,
    profileKind: user.profileKind,
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
    activityCells: act.cells, activityMonths: act.months,
    badges: BADGES.map(b => ({ ...b, earned: earned.includes(b.name) })),
    badgesEarned: earned.length, badgesTotal: BADGES.length,
    referral: {
      url: `https://nuji-test.netlify.app?ref=${user.refCode}`,
      refCode: user.refCode, joined: user.referrals, points: user.referrals * POINT_RULES.referral
    }
  };
}

// ================= AUTH / PROFILE =================
app.post('/api/auth/phone', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!validNaijaPhone(phone)) return res.status(400).json({ error: 'Enter a valid Nigerian number, e.g. 0803 123 4567' });
  let user = await getUser(phone);
  const exists = !!user;
  if (!user) { user = blankUser(phone); await saveUser(user); }
  res.json({ exists, hasProfile: user.profileKind === 'full', phone: user.phone });
});

// kind: 'full' (create profile form) | 'quick' (quick-contribute questions)
app.post('/api/profile', async (req, res) => {
  try {
    const { phone, nickname, state, lga, age, gender, languages, contribution, ref, kind } = req.body;
    const p = normalizePhone(phone);
    if (!p) return res.status(400).json({ error: 'Phone required' });
    let user = (await getUser(p)) || blankUser(p);

    Object.assign(user, {
      nickname: kind === 'full' ? (nickname || '') : user.nickname,
      state: state || user.state,
      lga: kind === 'full' ? (lga || '') : user.lga,
      age: age || user.age,
      gender: gender || user.gender,
      languages: kind === 'full' ? (languages || []) : user.languages,
      contributionLang: contribution || user.contributionLang
    });
    // never downgrade a full profile to quick
    if (kind === 'full') user.profileKind = 'full';
    else if (!user.profileKind) user.profileKind = 'quick';

    if (ref && !user.referredBy) {
      const { data: refRow } = await supabase.from('users').select('*').eq('ref_code', ref).maybeSingle();
      if (refRow && refRow.phone !== user.phone) {
        user.referredBy = ref;
        const refUser = toUser(refRow);
        refUser.referrals += 1;
        refUser.points += POINT_RULES.referral;
        await saveUser(refUser);
      }
    }
    await saveUser(user);
    res.json(await profilePayload(user));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/profile/:phone', async (req, res) => {
  const user = await getUser(req.params.phone);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(await profilePayload(user));
});

// ================= PROMPTS =================
app.get('/api/prompts', async (req, res) => {
  const language = req.query.language || 'Igbo';
  const seed = parseInt(req.query.seed || '0', 10);
  // RATIONING: a prompt is shown to at most 2 contributors, then the next one rotates in
  // Prompts are English source sentences — same prompt for every language (contributors translate it)
  let { data } = await supabase.from('prompts').select('*')
    .eq('is_active', true).lt('uses', 2)
    .order('uses').order('id').limit(1);
  if (!data || !data.length) {
    ({ data } = await supabase.from('prompts').select('*')
      .eq('is_active', true)
      .order('uses').order('id').limit(1));
  }
  if (data && data[0]) {
    const p = data[0];
    await supabase.from('prompts').update({ uses: (p.uses || 0) + 1 }).eq('id', p.id);
    return res.json({ text: p.text, language, id: p.id, uses: (p.uses || 0) + 1 });
  }
  res.json({ text: '', language });
});

// ================= CONTRIBUTIONS =================
app.post('/api/contributions', upload.single('audio'), async (req, res) => {
  try {
    const body = { ...req.body, ...(req.body.data ? JSON.parse(req.body.data) : {}) };
    const { phone, language, text, translation, langs = [], formality, prompt } = body;
    const hasText = !!String(text || '').trim();
    const hasVoice = !!req.file;
    if (!hasText && !hasVoice) return res.status(400).json({ error: 'Nothing to submit' });
    if (hasText && String(text).trim().split(/\s+/).length < 3) return res.status(400).json({ error: 'too_short_text' });

    let audioUrl = null;
    if (req.file) {
      try {
        const path = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webm`;
        const { error } = await supabase.storage.from('recordings').upload(path, req.file.buffer, { contentType: req.file.mimetype || 'audio/webm' });
        if (error) throw error;
        audioUrl = supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
      } catch {
        // storage failed -> embed the audio so reviews still work
        audioUrl = `data:${req.file.mimetype || 'audio/webm'};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    // ---- quality gate: server-side re-check of client audio analysis ----
    const duration = Number(body.duration) || 0;
    if (hasVoice && duration > 0 && duration < 3) return res.status(400).json({ error: 'too_short' });

    // ---- duplicate detection: same contributor, identical / near-identical text ----
    if (hasText && phone) {
      const { data: prev } = await supabase.from('contributions')
        .select('text').eq('phone', normalizePhone(phone))
        .order('created_at', { ascending: false }).limit(50);
      const t1 = tokensOf(body.text);
      for (const p of (prev || [])) {
        if (normText(p.text) && (normText(p.text) === normText(body.text) || jaccard(t1, tokensOf(p.text)) >= 0.85)) {
          return res.status(409).json({ error: 'duplicate' });
        }
      }
    }

    const mix = (langs || []).length >= 2;
    const earned = (hasText && hasVoice ? POINT_RULES.both : hasVoice ? POINT_RULES.voice : POINT_RULES.text) + (mix ? POINT_RULES.mix : 0);

    let user = null;
    if (phone) {
      user = (await getUser(phone)) || blankUser(normalizePhone(phone));
      user.points += earned;
      if (hasText && hasVoice) user.subs.both += 1; else if (hasVoice) user.subs.voice += 1; else user.subs.text += 1;
      if (mix) user.subs.mix += 1;
      for (const l of (langs.length ? langs : [language])) user.langCounts[l] = (user.langCounts[l] || 0) + 1;
      bumpDay(user);
      await saveUser(user);
    }

    // speaker metadata for voice training (age / gender / dialect region)
    const speaker = user ? { age: user.age || '', gender: user.gender || '', state: user.state || '', lga: user.lga || '', dialect: user.state || '' } : {};

    const { data, error } = await supabase.from('contributions').insert({
      phone: phone ? normalizePhone(phone) : null, language, prompt: prompt || '', text: text || '',
      translation: translation || '', langs, formality: formality || 'Normal', audio_url: audioUrl, points: earned,
      duration, status: 'pending', quality_flags: [], speaker, annotation: ''
    }).select().single();
    if (error) throw error;

    res.json({ ok: true, earned, totalPoints: user ? user.points : earned, contributionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= LISTEN / REVIEWS =================

// A clip awaiting review: has audio, matches the requested language, fewer than 3 reviews,
// was not submitted by the current reviewer, hasn't already been reviewed by them, and isn't
// in the `exclude` list (every clip already shown to them this session, comma-separated ids).
app.get('/api/clips', async (req, res) => {
  const language = req.query.language;
  const skip = parseInt(req.query.skip || '0', 10);
  const exclude = String(req.query.exclude || '').split(',').map(s => s.trim()).filter(Boolean);
  const reviewerPhone = req.query.phone ? normalizePhone(req.query.phone) : '';
  const { data } = await supabase.from('contributions')
    .select('*').not('audio_url', 'is', null).eq('language', language).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(100);
  const pool = (data || []).filter(c =>
    (c.reviews || []).length < 3 &&
    c.phone !== reviewerPhone &&
    !exclude.includes(c.id) &&
    !(c.reviews || []).some(r => r.phone && r.phone === reviewerPhone)
  );
  const clip = pool.length ? pool[Math.min(skip, pool.length - 1)] : null;
  if (!clip) return res.json(null);
  res.json({ id: clip.id, audioUrl: clip.audio_url, prompt: clip.prompt || '', text: clip.text || '', translation: clip.translation || '' });
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { phone, clipId, decision } = req.body;
    const { data: clip } = await supabase.from('contributions').select('*').eq('id', clipId).maybeSingle();
    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    const reviews = [...(clip.reviews || []), { phone: phone ? normalizePhone(phone) : null, decision, at: new Date().toISOString() }];
    // auto-verdict after 3 peer reviews
    let status = clip.status || 'pending';
    if (reviews.length >= 3) {
      const yes = reviews.filter(r => r.decision === 'yes').length;
      const no = reviews.filter(r => r.decision === 'no').length;
      status = yes > no ? 'approved' : 'flagged';
    }
    await supabase.from('contributions').update({ reviews, status }).eq('id', clipId);

    let user = null;
    if (phone) {
      user = (await getUser(phone)) || blankUser(normalizePhone(phone));
      user.reviews += 1;
      user.points += POINT_RULES.review;
      bumpDay(user);
      await saveUser(user);
    }
    res.json({ ok: true, earned: POINT_RULES.review, totalPoints: user ? user.points : POINT_RULES.review });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= PUBLIC DATA =================
app.get('/api/leaderboard', async (req, res) => {
  const { data } = await supabase.from('users').select('*').gt('points', 0).order('points', { ascending: false }).limit(10);
  res.json((data || []).map(u => {
    const user = toUser(u);
    return [user.nickname || 'Anonymous', topLanguage(user), totalSubs(user).toLocaleString()];
  }));
});

app.get('/api/states', async (req, res) => {
  const { data } = await supabase.from('users').select('*').not('state', 'is', null);
  const agg = {};
  for (const r of (data || [])) {
    const u = toUser(r);
    if (!u.state) continue;
    const s = agg[u.state] = agg[u.state] || { name: u.state, zone: STATE_ZONES[u.state] || '—', points: 0, contributors: 0, submissions: 0 };
    s.points += u.points; s.contributors += 1; s.submissions += totalSubs(u);
  }
  res.json(Object.values(agg));
});

// ================= COMMUNITY TOTALS =================
app.get('/api/stats', async (req, res) => {
  const { data } = await supabase.from('contributions').select('reviews');
  const rows = data || [];
  res.json({
    sentences: rows.length,
    reviews: rows.reduce((s, c) => s + (c.reviews || []).length, 0)
  });
});

// ================= ADMIN (token-protected) =================
// Credentials come from Render environment variables — never hardcode secrets.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nuji.ng';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nuji-admin-2026';
const SECRET = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_KEY || 'nuji-dev-secret';

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

app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  try {
    const [uRes, cRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('contributions').select('*').order('created_at', { ascending: false }).limit(500)
    ]);
    const U = uRes.data || [], C = cRes.data || [];
    const dayMs = 86400000, now = Date.now();

    const byLang = {}, byDay = {};
    for (const c of C) {
      byLang[c.language] = (byLang[c.language] || 0) + 1;
      const d = (c.created_at || '').slice(0, 10);
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
        profiles: U.filter(u => u.profile_kind === 'full').length,
        quick: U.filter(u => u.profile_kind === 'quick').length,
        contributions: C.length,
        audio: C.filter(c => c.audio_url).length,
        textOnly: C.filter(c => !c.audio_url && c.text).length,
        reviews: C.reduce((s, c) => s + (c.reviews || []).length, 0),
        pointsIssued: U.reduce((s, u) => s + (u.points || 0), 0),
        signups7: U.filter(u => u.created_at && now - new Date(u.created_at).getTime() < 7 * dayMs).length,
        audioHours: Math.round((C.reduce((s, c) => s + (c.duration || 0), 0) / 3600) * 100) / 100,
        approved: C.filter(c => (c.status || 'pending') === 'approved').length,
        pending: C.filter(c => (c.status || 'pending') === 'pending').length,
        flagged: C.filter(c => (c.status || 'pending') === 'flagged').length,
        rejected: C.filter(c => (c.status || 'pending') === 'rejected').length,
        needTranslation: C.filter(c => !c.translation).length
      },
      byLang,
      last14,
      topUsers: [...U].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10)
        .map(u => ({ name: u.nickname || 'Anonymous', phone: u.phone, state: u.state || '—', points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0 })),
      recentUsers: [...U].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10)
        .map(u => ({ phone: u.phone, nickname: u.nickname || '—', state: u.state || '—', kind: u.profile_kind || 'none', points: u.points || 0, createdAt: u.created_at })),
      recentContribs: C.slice(0, 200).map(c => ({
        id: c.id, phone: c.phone || 'guest', language: c.language, prompt: c.prompt || '',
        text: (c.text || '').slice(0, 120), fullText: c.text || '', hasAudio: !!c.audio_url, audioUrl: c.audio_url || null,
        points: c.points || 0, duration: c.duration || 0, status: c.status || 'pending',
        hasTranslation: !!c.translation, translation: c.translation || '', annotation: c.annotation || '',
        annotation_status: c.annotation_status || 'pending',
        speaker: c.speaker || {}, langs: c.langs || [], formality: c.formality || '',
        reviews: (c.reviews || []).length, maxReviews: 3, createdAt: c.created_at
      })),
      topStates: Object.values(statesAgg).sort((a, b) => b.points - a.points).slice(0, 10),
      allUsers: [...U].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 200).map(u => ({
        phone: u.phone, nickname: u.nickname || '', state: u.state || '', lga: u.lga || '', age: u.age || '',
        gender: u.gender || '', languages: u.languages || [], contributionLang: u.contribution_lang || 'Igbo',
        kind: u.profile_kind || 'none', refCode: u.ref_code || '', referredBy: u.referred_by || '',
        points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0, streak: u.streak || 0,
        bestStreak: u.best_streak || 0, badgesEarned: earnedBadges(toUser(u)).length, createdAt: u.created_at || ''
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// admin: approve / flag / reject a submission
app.post('/api/admin/status', requireAdmin, async (req, res) => {
  const { id, status } = req.body || {};
  if (!['approved', 'flagged', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  const { error } = await supabase.from('contributions').update({ status }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// admin: save translation / annotation from the review console
app.post('/api/admin/meta', requireAdmin, async (req, res) => {
  const { id, translation, annotation, annotationStatus } = req.body || {};
  const patch = {};
  if (typeof translation === 'string') patch.translation = translation;
  if (typeof annotation === 'string') patch.annotation = annotation;
  if (typeof annotationStatus === 'string') patch.annotation_status = annotationStatus;
  if (typeof (req.body || {}).text === 'string') patch.text = req.body.text;
  const { error } = await supabase.from('contributions').update(patch).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// admin: attach a missing voice recording to a submission
app.post('/api/admin/audio', requireAdmin, upload.single('audio'), async (req, res) => {
  try {
    const id = (req.body || {}).id;
    if (!id || !req.file) return res.status(400).json({ error: 'id and audio file required' });
    const path = `admin-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webm`;
    const { error } = await supabase.storage.from('recordings').upload(path, req.file.buffer, { contentType: req.file.mimetype || 'audio/webm' });
    if (error) throw error;
    const audioUrl = supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
    const patch = { audio_url: audioUrl };
    if (req.body.duration) patch.duration = Number(req.body.duration) || 0;
    const { error: e2 } = await supabase.from('contributions').update(patch).eq('id', id);
    if (e2) throw e2;
    res.json({ ok: true, audioUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= ADMIN: ANALYTICS =================
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const [uRes, cRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('contributions').select('*').limit(1000)
    ]);
    const U = uRes.data || [], C = cRes.data || [];
    const langCounts = {}, stateCounts = {}, genderDist = {}, byDay = {};
    let codeSwitch = 0, approved = 0, pending = 0, flagged = 0, audio = 0;
    const dayMs = 86400000, now = Date.now();
    for (const c of C) {
      langCounts[c.language] = (langCounts[c.language] || 0) + 1;
      if ((c.langs || []).length > 1) codeSwitch++;
      if (c.audio_url) audio++;
      const st = c.status || 'pending';
      if (st === 'approved') approved++; else if (st === 'flagged') flagged++; else pending++;
      const d = (c.created_at || '').slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + 1;
    }
    const lastByUser = {};
    for (const c of C) if (c.phone) { const d = c.created_at || ''; if (!lastByUser[c.phone] || d > lastByUser[c.phone]) lastByUser[c.phone] = d; }
    for (const u of U) {
      if (u.state) stateCounts[u.state] = (stateCounts[u.state] || 0) + 1;
      genderDist[u.gender || 'Unknown'] = (genderDist[u.gender || 'Unknown'] || 0) + 1;
    }
    const growthByDay = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * dayMs).toISOString().slice(0, 10);
      return { date: d, count: byDay[d] || 0 };
    });
    const oldUsers = U.filter(u => u.created_at && now - new Date(u.created_at).getTime() >= 7 * dayMs);
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= ADMIN: PROMPTS MANAGER =================
app.get('/api/admin/prompts', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('prompts').select('*').order('id', { ascending: false }).limit(300);
  res.json(data || []);
});
app.post('/api/admin/prompts', requireAdmin, async (req, res) => {
  const { text, language, category } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  const { error } = await supabase.from('prompts').insert({ text: text.trim(), language: language || 'Igbo', category: category || 'Greetings', is_active: true });
  res.json({ ok: !error, error });
});
app.post('/api/admin/prompts/bulk', requireAdmin, async (req, res) => {
  const { lines = [], language = 'Igbo', category = 'Greetings' } = req.body || {};
  const rows = lines.map(l => String(l || '').trim()).filter(l => l.length > 3).map(t => ({ text: t, language, category, is_active: true }));
  if (!rows.length) return res.status(400).json({ error: 'No valid lines' });
  const { error } = await supabase.from('prompts').insert(rows);
  res.json({ ok: !error, count: rows.length, error });
});
app.post('/api/admin/prompts/delete', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('prompts').delete().eq('id', (req.body || {}).id);
  res.json({ ok: !error });
});
app.post('/api/admin/prompts/toggle', requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  const { data } = await supabase.from('prompts').select('is_active').eq('id', id).maybeSingle();
  if (!data) return res.status(404).json({ error: 'Not found' });
  const { error } = await supabase.from('prompts').update({ is_active: !data.is_active }).eq('id', id);
  res.json({ ok: !error });
});

// ================= ADMIN: ANNOTATION QUEUE =================
app.get('/api/admin/annotate-queue', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('contributions').select('*').order('created_at', { ascending: false }).limit(500);
  const q = (data || []).filter(c => (c.text || '').trim() && (c.annotation_status || 'pending') === 'pending');
  res.json(q.slice(0, 50));
});

// ---------------- start (prompts come only from the database / admin panel) ----------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Nuji API (Supabase) on port ${PORT}`);
});
