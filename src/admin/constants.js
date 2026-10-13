export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
export const fmtDur = (s) => s ? `${Number(s).toFixed(1)}s` : '—';

export const STATUS = {
  pending: { label: 'Pending', cls: 'st-pending' },
  approved: { label: 'Approved', cls: 'st-approved' },
  flagged: { label: 'Flagged', cls: 'st-flagged' },
  rejected: { label: 'Rejected', cls: 'st-rejected' }
};

export const PROMPT_LANGS = ['Igbo', 'Yoruba', 'Hausa', 'Pidgin', 'English'];
export const LANGS = PROMPT_LANGS;

export const PROMPT_CATS = ['Greetings', 'Hospitality', 'Health', 'Business', 'Money', 'Family', 'Work', 'Travels', 'Transportation'];

export const TAGS = [
  { tag: 'IGBO', label: 'Igbo', color: '#059669', bg: '#f0fdf4' },
  { tag: 'YOR', label: 'Yoruba', color: '#d97706', bg: '#fff7ed' },
  { tag: 'HAU', label: 'Hausa', color: '#0284c7', bg: '#eff6ff' },
  { tag: 'PID', label: 'Pidgin', color: '#7c3aed', bg: '#f5f3ff' },
  { tag: 'ENG', label: 'English', color: '#6b7280', bg: '#f3f4f6' }
];

export const AUDIO_ERROR_MSG = {
  too_short: 'Recording is under 3 seconds — record a little longer and try again.',
  silent: 'No voice detected (silent recording). Check the microphone and try again.',
  noisy: 'Extreme background noise detected. Try recording in a quieter spot.',
  no_voice: 'No clear human voice detected in this recording. Background noise alone cannot be accepted — please re-record or upload a file with a real voice.',
  bad_audio: 'This audio file could not be analyzed. Please try a different file or re-record.'
};

export const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export const downloadCSV = (name, rows) => {
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

