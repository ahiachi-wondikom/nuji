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
import {
  POINT_RULES, levelInfo, totalSubs, BADGES, earnedBadges,
  activityPayload, bumpDay, topLanguage, STATE_ZONES
} from './db.js';
import { getPrompt, allPrompts } from './prompts.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
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
  const { count } = await supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('language', language);
  if (count) {
    const { data } = await supabase.from('prompts').select('text').eq('language', language).order('id').range(seed % count, seed % count);
    if (data && data[0]) return res.json({ text: data[0].text, language });
  }
  res.json({ text: getPrompt(language, seed), language });
});

// ================= CONTRIBUTIONS =================
app.post('/api/contributions', upload.single('audio'), async (req, res) => {
  try {
    const body = { ...req.body, ...(req.body.data ? JSON.parse(req.body.data) : {}) };
    const { phone, language, text, translation, langs = [], formality, prompt } = body;
    const hasText = !!String(text || '').trim();
    const hasVoice = !!req.file;
    if (!hasText && !hasVoice) return res.status(400).json({ error: 'Nothing to submit' });

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

    const { data, error } = await supabase.from('contributions').insert({
      phone: phone ? normalizePhone(phone) : null, language, prompt: prompt || '', text: text || '',
      translation: translation || '', langs, formality: formality || 'Normal', audio_url: audioUrl, points: earned
    }).select().single();
    if (error) throw error;

    res.json({ ok: true, earned, totalPoints: user ? user.points : earned, contributionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= LISTEN / REVIEWS =================
app.get('/api/clips', async (req, res) => {
  const language = req.query.language;
  const { data } = await supabase.from('contributions')
    .select('*').not('audio_url', 'is', null).eq('language', language)
    .order('created_at', { ascending: false }).limit(50);
  const clip = (data || []).find(c => (c.reviews || []).length < 3 && c.phone !== normalizePhone(req.query.phone));
  if (!clip) return res.json(null);
  res.json({ id: clip.id, audioUrl: clip.audio_url, prompt: clip.prompt || clip.text });
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { phone, clipId, decision } = req.body;
    const { data: clip } = await supabase.from('contributions').select('*').eq('id', clipId).maybeSingle();
    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    const reviews = [...(clip.reviews || []), { phone: phone ? normalizePhone(phone) : null, decision, at: new Date().toISOString() }];
    await supabase.from('contributions').update({ reviews }).eq('id', clipId);

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
        signups7: U.filter(u => u.created_at && now - new Date(u.created_at).getTime() < 7 * dayMs).length
      },
      byLang,
      last14,
      topUsers: [...U].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10)
        .map(u => ({ name: u.nickname || 'Anonymous', phone: u.phone, state: u.state || '—', points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0 })),
      recentUsers: [...U].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10)
        .map(u => ({ phone: u.phone, nickname: u.nickname || '—', state: u.state || '—', kind: u.profile_kind || 'none', points: u.points || 0, createdAt: u.created_at })),
      recentContribs: C.slice(0, 20).map(c => ({
        id: c.id, phone: c.phone || 'guest', language: c.language, prompt: c.prompt || '',
        text: (c.text || '').slice(0, 90), hasAudio: !!c.audio_url, audioUrl: c.audio_url || null,
        points: c.points || 0,
        reviews: (c.reviews || []).length, createdAt: c.created_at
      })),
      topStates: Object.values(statesAgg).sort((a, b) => b.points - a.points).slice(0, 10),
      allUsers: [...U].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 200).map(u => ({
        phone: u.phone, nickname: u.nickname || '', state: u.state || '', lga: u.lga || '', age: u.age || '',
        gender: u.gender || '', languages: u.languages || [], contributionLang: u.contribution_lang || 'Igbo',
        kind: u.profile_kind || 'none', refCode: u.ref_code || '', referredBy: u.referred_by || '',
        points: u.points || 0, subs: subsOf(u), reviews: u.reviews || 0, streak: u.streak || 0,
        bestStreak: u.best_streak || 0, createdAt: u.created_at || ''
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------- start + auto-seed prompts ----------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Nuji API (Supabase) on port ${PORT}`);
  try {
    const { count } = await supabase.from('prompts').select('*', { count: 'exact', head: true });
    if (!count) {
      const { error } = await supabase.from('prompts').insert(allPrompts());
      if (error) console.log('prompt seed skipped:', error.message);
      else console.log('🌱 Seeded prompt library');
    }
  } catch (e) { console.log('seed check failed:', e.message); }
});
