// ============================================================
// Legacy entry point.
//
// Nuji no longer supports a JSON/local-database backend — all data
// (users, contributions, prompts) lives in Supabase. This file is kept
// only so that a deploy target still configured to run `server.js`
// directly (an old Render/Procfile start command, a stale cached
// build, etc.) boots the real Supabase-backed API instead of ever
// falling back to local file storage.
//
// The actual server implementation lives in server.supabase.js —
// see package.json's "start" script, which points there directly.
// ============================================================
import './server.supabase.js';
