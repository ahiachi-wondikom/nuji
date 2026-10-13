import React, { useState } from 'react';
import { TAGS } from './constants.js';

export function parseAnnotation(str) {
  const segs = []; const re = /\[([A-Z]+)\]([\s\S]*?)\[\/\1\]/g; let m;
  while ((m = re.exec(str || ''))) { m[2].trim().split(/\s+/).filter(Boolean).forEach(w => segs.push({ word: w, tag: m[1] })); }
  return segs;
}

export function buildAnn(segments) {
  const out = []; let cur = null;
  segments.forEach(({ word, tag }) => {
    const t = tag || 'UNK';
    if (cur && cur.tag === t) cur.text += ' ' + word; else { if (cur) out.push(cur); cur = { tag: t, text: word }; }
  });
  if (cur) out.push(cur);
  return out;
}

export default function WordTagger({ words, initial, readOnly, onSave }) {
  const [segments, setSegments] = useState(() => (initial ? parseAnnotation(initial) : words.map(w => ({ word: w, tag: null }))));
  const [selectedTag, setSelectedTag] = useState(null);
  const [saving, setSaving] = useState(false);
  const tagColor = (t) => TAGS.find(x => x.tag === t);
  const preview = buildAnn(segments).map(s => `[${s.tag}]${s.text}[/${s.tag}]`).join(' ');
  const switchPoints = Math.max(0, buildAnn(segments).length - 1);
  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, lineHeight: 2 }}>
        {segments.map((s, i) => {
          const st = tagColor(s.tag);
          return (
            <span key={i} style={{ padding: '4px 10px', borderRadius: 6, border: st ? `2px solid ${st.color}` : '2px solid #e5e7eb', background: st ? st.bg : '#fff', color: st ? st.color : '#374151', fontSize: 14, fontWeight: st ? 700 : 400 }}>
              {s.word}{s.tag && <span style={{ fontSize: 9, marginLeft: 4, opacity: .8 }}>{s.tag}</span>}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, lineHeight: 2, marginBottom: 12 }}>
        {segments.map((s, i) => {
          const st = tagColor(s.tag);
          return (
            <button key={i} onClick={() => { if (!selectedTag) return; setSegments(p => p.map((x, k) => k === i ? { ...x, tag: x.tag === selectedTag ? null : selectedTag } : x)); }}
              style={{ padding: '4px 10px', borderRadius: 6, border: st ? `2px solid ${st.color}` : '2px solid #e5e7eb', background: st ? st.bg : '#fff', color: st ? st.color : '#374151', fontSize: 14, fontWeight: st ? 700 : 400, cursor: selectedTag ? 'pointer' : 'default' }}>
              {s.word}{s.tag && <span style={{ fontSize: 9, marginLeft: 4, opacity: .8 }}>{s.tag}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>Select language tag:</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedTag && <button className="admin-export-btn" onClick={() => setSegments(p => p.map(x => ({ ...x, tag: selectedTag })))}>Tag all as {selectedTag}</button>}
          <button className="admin-export-btn" onClick={() => setSegments(p => p.map(x => ({ ...x, tag: null })))}>Clear all</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {TAGS.map(t => (
          <button key={t.tag} onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
            className="admin-chip"
            style={{ padding: '8px 16px', borderRadius: 999, border: selectedTag === t.tag ? `2px solid ${t.color}` : '2px solid #e5e7eb', background: selectedTag === t.tag ? t.bg : '#fff', color: selectedTag === t.tag ? t.color : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            [{t.tag}] {t.label}
          </button>
        ))}
      </div>
      {segments.some(s => s.tag) && (
        <div className="admin-modal-section" style={{ marginBottom: 12 }}>
          <h5>Annotation preview · {switchPoints} switch point{switchPoints !== 1 ? 's' : ''}</h5>
          <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{preview}</p>
        </div>
      )}
      <button className="btn btn-primary" disabled={saving || !segments.some(s => s.tag)} onClick={async () => { setSaving(true); await onSave(preview); setSaving(false); }}>
        {saving ? 'Saving…' : 'Save annotation'}
      </button>
    </div>
  );
}

export { WordTagger };

