// ============================================================
// Nuji API helper — talks to the Express backend in /server
// Every method returns null on failure so the UI can fall back
// to demo data when the backend is not running.
// ============================================================

// Development: Vite proxy → localhost:4000. Production: your Render backend.
const BASE = (import.meta.env.VITE_API_URL || 'https://nuji.onrender.com) + '/api';

const adminToken = () => { try { return localStorage.getItem('nuji_admin_token') || ''; } catch { return ''; } };

async function request(path, options = {}) {
  try {
    const token = adminToken();
    const res = await fetch(BASE + path, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
      },
      ...options
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // backend offline -> UI uses fallback demo data
  }
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });

export const api = {
  // ---- auth / profile ----
  checkPhone: (phone) => post('/auth/phone', { phone }),
  saveProfile: (data) => post('/profile', data),
  getProfile: (phone) => get(`/profile/${encodeURIComponent(phone)}`),

  // ---- contributions ----
  submitContribution: (data) => post('/contributions', data),           // JSON (text only)
  submitContributionWithAudio: (formData) => post('/contributions', formData), // multipart (voice)
  // submission with real error messages (duplicate / quality rejection)
  trySubmit: async (data) => {
    try {
      const res = await fetch(BASE + '/contributions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const j = await res.json().catch(() => null);
      return { ok: res.ok, ...(j || {}) };
    } catch { return { ok: false }; }
  },
  trySubmitAudio: async (fd) => {
    try {
      const res = await fetch(BASE + '/contributions', { method: 'POST', body: fd });
      const j = await res.json().catch(() => null);
      return { ok: res.ok, ...(j || {}) };
    } catch { return { ok: false }; }
  },

  // ---- prompts (Speak page sentences) ----
  getPrompt: (language, seed) => get(`/prompts?language=${encodeURIComponent(language)}&seed=${seed || 0}`),

  // ---- listening / reviews ----
    pendingClip: (language, phone, skip, excludeId) => get(
    `/clips?language=${encodeURIComponent(language)}&phone=${encodeURIComponent(phone || '')}&skip=${skip || 0}&exclude=${encodeURIComponent(excludeId || '')}`
  ),
  submitReview: (data) => post('/reviews', data),

  // ---- public data ----
  leaderboard: () => get('/leaderboard'),
  states: () => get('/states'),
  stats: () => get('/stats'),

  // ---- admin (token-protected) ----
  adminLogin: (email, password) => post('/admin/login', { email, password }),
  adminOverview: () => get('/admin/overview'),
  adminAnalytics: () => get('/admin/analytics'),
  adminSetStatus: (id, status) => post('/admin/status', { id, status }),
  adminUpdateMeta: (data) => post('/admin/meta', data),
  adminPrompts: () => get('/admin/prompts'),
  adminAddPrompt: (data) => post('/admin/prompts', data),
  adminBulkPrompts: (data) => post('/admin/prompts/bulk', data),
  adminDeletePrompt: (id) => post('/admin/prompts/delete', { id }),
  adminTogglePrompt: (id) => post('/admin/prompts/toggle', { id }),
  adminAnnotateQueue: () => get('/admin/annotate-queue'),
  adminUploadAudio: (fd) => post('/admin/audio', fd)
};
