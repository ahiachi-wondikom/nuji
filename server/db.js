// ============================================================
// Nuji shared scoring/badge/activity helpers.
//
// This file used to also provide a JSON-file-backed local database
// (with hardcoded demo/seed users) for a JSON-store server mode.
// That mode has been removed — Nuji is Supabase-only now, so this
// file exports only the pure, stateless helpers that both the
// (retired) legacy server and the Supabase server relied on. There
// is no local storage, no seed data, and no way for demo users to
// leak into real leaderboard/state data.
// ============================================================

const today = () => new Date().toISOString().slice(0, 10);

// ---------------- scoring / levels ----------------
export const POINT_RULES = { text: 3, voice: 5, both: 8, mix: 3, review: 1, referral: 10 };

const LEVELS = [
  [0, 'New Voice'],
  [50, 'Contributor'],
  [150, 'Expert Contributor'],
  [400, 'Community Leader'],
  [900, 'Language Champion']
];

export function levelInfo(points) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k][0]) i = k;
  const current = LEVELS[i][0];
  const target = LEVELS[i + 1] ? LEVELS[i + 1][0] : LEVELS[i][0] + 500;
  return { level: LEVELS[i][1], levelProgress: points - current, levelTarget: target - current };
}

export const totalSubs = (u) => u.subs.text + u.subs.voice + u.subs.both;

// ---------------- badges ----------------
export const BADGES = [
  { category: 'Getting Started', icon: '🎙️', name: 'First Voice', desc: 'Made your first contribution', test: u => totalSubs(u) >= 1 },
  { category: 'Volume', icon: '🔥', name: 'On Fire', desc: '10 contributions submitted', test: u => totalSubs(u) >= 10 },
  { category: 'Volume', icon: '💪', name: 'Dedicated', desc: '50 contributions submitted', test: u => totalSubs(u) >= 50 },
  { category: 'Volume', icon: '🏆', name: 'Champion', desc: '100 contributions submitted', test: u => totalSubs(u) >= 100 },
  { category: 'Voice', icon: '🎤', name: 'Voice Hero', desc: '20 voice recordings submitted', test: u => (u.subs.voice + u.subs.both) >= 20 },
  { category: 'Language', icon: '🦅', name: 'Igbo Pride', desc: '20 Igbo contributions', test: u => (u.langCounts['Igbo'] || 0) >= 20 },
  { category: 'Language', icon: '⭐', name: 'Yoruba Star', desc: '20 Yoruba contributions', test: u => (u.langCounts['Yoruba'] || 0) >= 20 },
  { category: 'Language', icon: '🌙', name: 'Arewa Champion', desc: '20 Hausa contributions', test: u => (u.langCounts['Hausa'] || 0) >= 20 },
  { category: 'Language', icon: '👑', name: 'Pidgin King', desc: '20 Pidgin contributions', test: u => (u.langCounts['Pidgin'] || 0) >= 20 },
  { category: 'Code Switch', icon: '🔀', name: 'Language Mixer', desc: 'First code-switched submission', test: u => u.subs.mix >= 1 },
  { category: 'Code Switch', icon: '🌍', name: 'Multilingual Master', desc: 'Code-switched in 3+ languages', test: u => Object.keys(u.langCounts).length >= 3 },
  { category: 'Streaks', icon: '📅', name: '7 Day Streak', desc: 'Contributed 7 days in a row', test: u => u.bestStreak >= 7 },
  { category: 'Streaks', icon: '⚔️', name: 'Two Week Warrior', desc: '14 day streak', test: u => u.bestStreak >= 14 },
  { category: 'Streaks', icon: '🌟', name: 'Monthly Legend', desc: 'Contributed 30 days in a row', test: u => u.bestStreak >= 30 },
  { category: 'Community', icon: '👥', name: 'Reviewer', desc: 'Reviewed 10 submissions', test: u => u.reviews >= 10 },
  { category: 'Community', icon: '🧓', name: 'Elder', desc: 'Reviewed 50 submissions', test: u => u.reviews >= 50 },
  { category: 'Community', icon: '🤝', name: 'Village Champion', desc: 'Referred 5 contributors', test: u => u.referrals >= 5 },
  { category: 'Points', icon: '⭐', name: 'Top Scorer', desc: 'Earned 100 points', test: u => u.points >= 100 },
  { category: 'Special', icon: '🐦', name: 'Early Bird', desc: 'One of the first 100 contributors', test: u => !!u.earlyBird }
];

export const earnedBadges = (u) => BADGES.filter(b => b.test(u)).map(b => b.name);

// ---------------- activity grid (GitHub style) ----------------
const dayLevel = (count) => (count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4);

export function activityPayload(u) {
  const cells = [];
  const months = [];
  const now = new Date();
  // LEFT = today, scrolling right goes back in time (matches the scroll direction)
  for (let i = 0; i <= 370; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (i % 7 === 0) months.push(d.toLocaleString('en', { month: 'narrow' }));
    cells.push(dayLevel(u.days[key] || 0));
  }
  return { cells, months: months.slice(0, 12) };
}

// ---------------- streaks ----------------
export function bumpDay(u) {
  const t = today();
  u.days[t] = (u.days[t] || 0) + 1;
  if (u.lastDay === t) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  u.streak = u.lastDay === yesterday.toISOString().slice(0, 10) ? u.streak + 1 : 1;
  u.bestStreak = Math.max(u.bestStreak, u.streak);
  u.lastDay = t;
}

export function topLanguage(u) {
  const entries = Object.entries(u.langCounts);
  if (!entries.length) return u.contributionLang || 'Igbo';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// ---------------- state zones ----------------
export const STATE_ZONES = {
  'Abia': 'South East', 'Anambra': 'South East', 'Ebonyi': 'South East', 'Enugu': 'South East', 'Imo': 'South East',
  'Ekiti': 'South West', 'Lagos': 'South West', 'Ogun': 'South West', 'Ondo': 'South West', 'Osun': 'South West', 'Oyo': 'South West',
  'Akwa Ibom': 'South South', 'Bayelsa': 'South South', 'Cross River': 'South South', 'Delta': 'South South', 'Edo': 'South South', 'Rivers': 'South South',
  'Benue': 'North Central', 'FCT': 'North Central', 'Kogi': 'North Central', 'Kwara': 'North Central', 'Nasarawa': 'North Central', 'Niger': 'North Central', 'Plateau': 'North Central',
  'Adamawa': 'North East', 'Bauchi': 'North East', 'Borno': 'North East', 'Gombe': 'North East', 'Taraba': 'North East', 'Yobe': 'North East',
  'Jigawa': 'North West', 'Kaduna': 'North West', 'Kano': 'North West', 'Katsina': 'North West', 'Kebbi': 'North West', 'Sokoto': 'North West', 'Zamfara': 'North West'
};
