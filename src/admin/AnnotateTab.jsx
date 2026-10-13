import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Check } from 'lucide-react';
import { api } from '../api.js';
import { TAGS, fmtDate, fmtDur } from './constants.js';
import AudioCell from './AudioCell.jsx';

export default function AnnotateTab({ onChanged }) {
  const [queue, setQueue] = useState(null);
  const [idx, setIdx] = useState(0);
  const [selectedTag, setSelectedTag] = useState(null);
  const [segments, setSegments] = useState([]);
  const [saved, setSaved] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [linguisticText, setLinguisticText] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const load = useCallback(() => (api.adminAnnotateQueue ? api.adminAnnotateQueue() : Promise.resolve([])).then(q => { setQueue(q || []); setIdx(0); }), []);
  useEffect(() => { load(); }, [load]);

  const current = (queue || [])[idx] || null;
  const remaining = (queue || []).length - idx;

  useEffect(() => {
    if (!current) return;
    const words = (current.fullText || current.text || '').split(/\s+/).filter(Boolean);
    setSegments(words.map(w => ({ word: w, tag: null })));
    setSelectedTag(null);
    setLinguisticText('');
    setIsVerified(false);
  }, [idx, current && current.id]);

  if (!queue) return <p className="admin-muted" style={{ textAlign: 'center', padding: 40 }}>Loading annotation queue…</p>;
  if (!current || remaining <= 0) return (
    <div className="admin-panel" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 44 }}>🎉</div>
      <h3 style={{ margin: '8px 0' }}>All caught up!</h3>
      <p className="admin-muted">You annotated {saved} submission{saved !== 1 ? 's' : ''} this session. No more code-switch submissions waiting.</p>
      <button className="btn btn-primary" onClick={load}><RefreshCcw size={15} /> Refresh queue</button>
    </div>
  );

  const tagWord = (i) => { if (!selectedTag) return; setSegments(p => p.map((s, k) => k === i ? { ...s, tag: s.tag === selectedTag ? null : selectedTag } : s)); };
  const tagAll = (t) => setSegments(p => p.map(s => ({ ...s, tag: t })));
  const clearAll = () => setSegments(p => p.map(s => ({ ...s, tag: null })));

  const build = () => {
    const out = []; let cur = null;
    segments.forEach(({ word, tag }) => {
      const t = tag || 'UNK';
      if (cur && cur.tag === t) cur.text += ' ' + word;
      else { if (cur) out.push(cur); cur = { tag: t, text: word }; }
    });
    if (cur) out.push(cur);
    return out;
  };
  const preview = build().map(s => `[${s.tag}]${s.text}[/${s.tag}]`).join(' ');
  const switchPoints = Math.max(0, build().length - 1);

  const save = async () => {
    await api.adminUpdateMeta({
      id: current.id,
      annotation: preview,
      annotationStatus: 'annotated',
      linguisticText: linguisticText.trim() || null,
      isVerified,
    });
    setSaved(s => s + 1); setIdx(i => i + 1); onChanged();
  };

  const skip = async () => {
    await api.adminUpdateMeta({ id: current.id, annotationStatus: 'skipped' });
    setIdx(i => i + 1);
  };

  return (
    <div className="admin-content">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div><h3>Code-Switch Annotation</h3><span className="admin-count">{remaining} remaining · tag each word with its language</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="admin-chip st-approved">✅ {saved} annotated</span>
            <button className="admin-export-btn" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Hide guide' : '📖 Guide'}</button>
          </div>
        </div>

        <div className="admin-prog" style={{ marginBottom: 14 }}><i style={{ flex: 1, height: 6 }}><b style={{ width: `${Math.round((idx / Math.max((queue || []).length, 1)) * 100)}%` }} /></i></div>

        {showGuide && (
          <div className="admin-modal-section">
            <h5>How to annotate</h5>
            <p>1) Select a language tag below · 2) click words to label them (click again to untag) · 3) "Tag all" sets one language for the whole text, then fix exceptions · 4) Add proper diacritics in the Linguistic Text field · 5) Check "Verified" if you are confident · 6) Save — or Skip if unclear. 💡 Tip: tag all with the dominant language first.</p>
          </div>
        )}

        <div className="admin-modal-section">
          <h5>Submission · {current.language} · {fmtDate(current.createdAt)}</h5>
          <p style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, fontStyle: 'italic' }}>"{current.fullText || current.text}"</p>
          {current.translation && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Translation: "{current.translation}"</p>}
          {current.hasAudio && <div style={{ marginTop: 8 }}><AudioCell url={current.audioUrl} /> <span className="admin-muted" style={{ fontSize: 12 }}>{fmtDur(current.duration)} — listen while annotating</span></div>}
        </div>

        {/* ── Linguistic Text Field ── */}  
        <div className="admin-modal-section">
          <h5>Linguistic text <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>(add proper diacritics — e.g. mò ń bọ̀)</span></h5>
          <textarea
            value={linguisticText}
            onChange={e => setLinguisticText(e.target.value)}
            placeholder="Type the properly diacritized version here e.g. Kedụ, ọ dị mma?"
            rows={2}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1.5px solid #e5e7eb',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Listen to the audio and type what the contributor said with correct tone marks and underdots. Leave blank if unsure.
          </p>
        </div>

        {/* ── Word Tagger ── */}
        {segments.length > 0 && (
          <div className="admin-modal-section">
            <h5>Click a tag, then click words to label language</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, lineHeight: 2 }}>
              {segments.map((s, i) => {
                const st = TAGS.find(t => t.tag === s.tag);
                return (
                  <button key={i} onClick={() => tagWord(i)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: st ? `2px solid ${st.color}` : '2px solid #e5e7eb', background: st ? st.bg : '#fff', color: st ? st.color : '#374151', fontSize: 14, fontWeight: st ? 700 : 400, cursor: 'pointer' }}>
                    {s.word}{s.tag && <span style={{ fontSize: 9, marginLeft: 4, opacity: .8 }}>{s.tag}</span>}
                  </button>
                );
              })}
            </div>
          </div>         
        )}

        <div className="admin-panel" style={{ marginBottom: 12 }}>
          <div className="admin-panel-head">
            <h5 style={{ margin: 0, fontSize: 12 }}>Select language tag</h5>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedTag && <button className="admin-export-btn" onClick={() => tagAll(selectedTag)}>Tag all as {selectedTag}</button>}
              <button className="admin-export-btn" onClick={clearAll}>Clear all</button>
            </div>      
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TAGS.map(t => (
              <button key={t.tag} onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
                className="admin-chip"
                style={{ padding: '8px 16px', borderRadius: 999, border: selectedTag === t.tag ? `2px solid ${t.color}` : '2px solid #e5e7eb', background: selectedTag === t.tag ? t.bg : '#fff', color: selectedTag === t.tag ? t.color : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                [{t.tag}] {t.label}
              </button>
            ))}
          </div>
        </div>

        {segments.some(s => s.tag) && (
          <div className="admin-modal-section">
            <h5>Annotation preview · {switchPoints} switch point{switchPoints !== 1 ? 's' : ''}</h5>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{preview}</p>
          </div>
        )}

        {/* ── Verified Checkbox ── */}
        <div className="admin-modal-section">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={isVerified}
              onChange={e => setIsVerified(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#16a34a', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Mark as verified</span>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Check this only if you are confident the linguistic text and annotation are correct</p>
            </div>
          </label>
        </div>

        <div className="admin-modal-actions">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={skip}>Skip →</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save}>
            <Check size={15} /> {isVerified ? '✅ Save & Verify' : 'Save annotation'}
          </button>
        </div>
        <p className="admin-muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 10 }}>You don't need to tag every word — focus on the language switches and diacritics.</p>
      </div>
    </div>
  );
}

export { AnnotateTab };

