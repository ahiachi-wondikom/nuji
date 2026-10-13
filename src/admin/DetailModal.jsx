import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Save, Check, Flag } from 'lucide-react';
import { api } from '../api.js';
import { analyzeAudio, audioProblems } from '../utils/audio.js';
import { STATUS, fmtDate, fmtTime, fmtDur, AUDIO_ERROR_MSG } from './constants.js';
import AudioCell from './AudioCell.jsx';
import WordTagger from './WordTagger.jsx';

export default function DetailModal({ item, onClose, onChanged }) {
  const [translation, setTranslation] = useState(item.translation || '');
  const [annotation, setAnnotation] = useState(item.annotation || '');
  const [savedAnn, setSavedAnn] = useState(null);
  const words = (item.fullText || item.text || '').split(/\s+/).filter(Boolean);
  const effStatus = savedAnn ? savedAnn.status : (item.annotation_status || 'pending');
  const effAnn = savedAnn ? savedAnn.annotation : (item.annotation || '');
  const isAnnotated = effStatus === 'annotated' && !!effAnn;
  const [status, setStatus] = useState(item.status || 'pending');
  const [msg, setMsg] = useState('');
  const [extraAudio, setExtraAudio] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [recState, setRecState] = useState('idle');
  const [recBlob, setRecBlob] = useState(null);
  const [recUrl, setRecUrl] = useState(null);
  const [recTime, setRecTime] = useState(0);
  const recRef = useRef(null);
  const recTimer = useRef(null);

  useEffect(() => { if (recBlob) setRecUrl(URL.createObjectURL(recBlob)); }, [recBlob]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recTimer.current);
        setRecBlob(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        setRecState('idle');
      };
      recRef.current = rec;
      setRecBlob(null); setRecUrl(null); setRecTime(0);
      recTimer.current = setInterval(() => setRecTime(t => t + 1), 1000);
      setRecState('recording');
      rec.start();
    } catch { setMsg('Microphone unavailable on this device'); setTimeout(() => setMsg(''), 1800); }
  };
  const stopRec = () => { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); };

  const attachBlob = async (blob) => {
    setUploading(true);
    const meta = await analyzeAudio(blob);
    if (!meta) {
      setUploading(false);
      setMsg(AUDIO_ERROR_MSG.bad_audio);
      setTimeout(() => setMsg(''), 2500);
      return;
    }
    const probs = audioProblems(meta);
    if (probs.length) {
      setUploading(false);
      setMsg(AUDIO_ERROR_MSG[probs[0]]);
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    const fd = new FormData();
    fd.append('id', item.id);
    fd.append('audio', blob, 'recording.webm');
    fd.append('duration', String(meta.duration));
    const r = await api.adminUploadAudio(fd);
    setUploading(false);
    if (r && r.ok) { setExtraAudio(r.audioUrl); setMsg('Voice attached ✓ — you can now approve'); onChanged(); setTimeout(() => setMsg(''), 2200); }
    else { setMsg('Upload failed — try again'); setTimeout(() => setMsg(''), 1800); }
  };

  const uploadFile = async () => {
    const f = fileRef.current && fileRef.current.files[0];
    if (!f) { setMsg('Choose an audio file first'); setTimeout(() => setMsg(''), 1500); return; }
    attachBlob(f);
  };

  const [text, setText] = useState(item.fullText || item.text || '');

  const saveMeta = async () => {
    await api.adminUpdateMeta({ id: item.id, translation, text });
    setMsg('Saved ✓'); onChanged(); setTimeout(() => setMsg(''), 1500);
  };
  const setStatusAnd = async (st) => { await api.adminSetStatus(item.id, st); setStatus(st); onChanged(); };

  const sp = item.speaker || {};
  const ready = [
    { label: 'Has text', ok: !!(item.fullText || item.text) },
    { label: 'Has voice', ok: !!item.hasAudio },
    { label: 'Has translation', ok: !!translation },
    { label: 'Annotated', ok: !!isAnnotated },
    { label: 'Peer approved', ok: status === 'approved' }
  ];

  return (
    <div className="admin-modal" onClick={onClose}>
      <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="admin-chip">{item.language}</span>
            <span className={`admin-chip ${STATUS[status].cls}`}>{STATUS[status].label}</span>
            {sp.state && <span className="admin-chip">📍 {sp.state}{sp.lga ? ` · ${sp.lga}` : ''}</span>}
            {(item.langs || []).length > 1 && <span className="admin-chip">🔀 {item.langs.join(' + ')}</span>}
          </div>
          <button className="admin-icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-ready" style={{ marginBottom: 12 }}>
            {ready.map(r => <span key={r.label} className={r.ok ? 'ok' : 'no'}>{r.ok ? '✓' : '✗'} {r.label}</span>)}
          </div>

          <div className="admin-modal-section"><h5>📝 Daily prompt</h5><p>{item.prompt}</p></div>
          <div className="admin-modal-section"><h5>💬 Contributor response {item.formality && <em style={{ textTransform: 'none' }}>· {item.formality}</em>}</h5><p>{item.fullText || item.text || '—'}</p></div>

          <div style={{ marginBottom: 10 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>💬 Contributor response (editable)</h5>
            <textarea className="admin-textarea" value={text} onChange={e => setText(e.target.value)} />
          </div>

          {(item.hasAudio || extraAudio) ? (
            <div className="admin-modal-section">
              <h5>🎙 Voice recording · {fmtDur(item.duration)}</h5>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AudioCell url={item.audioUrl || extraAudio} />
                <span className="admin-muted" style={{ fontSize: 12 }}>Current recording — re-record or replace below</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {recState === 'idle' ? (
                  <button className="btn btn-secondary" onClick={startRec}><Mic size={15} /> Re-record voice</button>
                ) : (
                  <button className="btn" style={{ background: '#fee2e2', color: '#991b1b' }} onClick={stopRec}>
                    <span style={{ width: 11, height: 11, background: '#991b1b', borderRadius: 2, display: 'inline-block' }} /> Stop · {fmtDur(recTime)}
                  </button>
                )}
                {recBlob && (
                  <>
                    <AudioCell url={recUrl} />
                    <button className="btn btn-primary" disabled={uploading} onClick={() => attachBlob(recBlob)}>{uploading ? 'Saving…' : 'Attach recording'}</button>
                  </>
                )}
              </div>
              <div style={{ marginTop: 12, borderTop: '1px dashed #e5e7eb', paddingTop: 10 }}>
                <input type="file" accept="audio/*" ref={fileRef} style={{ fontSize: 12 }} />
                <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={uploading} onClick={uploadFile}>{uploading ? 'Uploading…' : 'Upload replacement audio'}</button>
              </div>
            </div>
          ) : (
            <div className="admin-modal-section">
              <h5>⚠️ Missing voice recording</h5>
              <p>Record the voice yourself right now, or upload the contributor's file (e.g. from WhatsApp) — then approve the submission.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                {recState === 'idle' ? (
                  <button className="btn btn-secondary" onClick={startRec}><Mic size={15} /> Record voice</button>
                ) : (
                  <button className="btn" style={{ background: '#fee2e2', color: '#991b1b' }} onClick={stopRec}>
                    <span style={{ width: 11, height: 11, background: '#991b1b', borderRadius: 2, display: 'inline-block' }} /> Stop · {fmtDur(recTime)}
                  </button>
                )}
                {recBlob && (
                  <>
                    <AudioCell url={recUrl} />
                    <button className="btn btn-primary" disabled={uploading} onClick={() => attachBlob(recBlob)}>{uploading ? 'Saving…' : 'Attach recording'}</button>
                  </>
                )}
              </div>
              <div style={{ marginTop: 12, borderTop: '1px dashed #e5e7eb', paddingTop: 10 }}>
                <input type="file" accept="audio/*" ref={fileRef} style={{ fontSize: 12 }} />
                <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={uploading} onClick={uploadFile}>{uploading ? 'Uploading…' : 'Upload audio file'}</button>
              </div>
            </div>
          )}

          <div className="admin-modal-section">
            <h5>🗣 Speaker metadata (for voice training)</h5>
            <p>{sp.age ? `Age ${sp.age} · ` : ''}{sp.gender ? `${sp.gender} · ` : ''}{sp.state ? `Region: ${sp.state}${sp.lga ? ` (${sp.lga})` : ''}` : 'Region: not provided'}{(item.langs || []).length > 0 && <> · Languages: {item.langs.join(', ')}</>}</p>
          </div>

          <div style={{ marginBottom: 10 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>🌍 English translation {!item.translation && <span style={{ color: '#c0392b', textTransform: 'none' }}>— missing</span>}</h5>
            <textarea className="admin-textarea" value={translation} onChange={e => setTranslation(e.target.value)} placeholder="What does this mean in English? Be literal and natural." />
          </div>

          <div className="admin-modal-section" style={{ marginBottom: 10 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: '#77817a' }}>
              🔀 Code-switch annotation {isAnnotated ? <span style={{ color: '#16a34a' }}>— saved ✅</span> : <span style={{ color: '#7c3aed' }}>— needs labelling</span>}
            </h5>
            <WordTagger
              words={words}
              initial={isAnnotated ? effAnn : ''}
              readOnly={isAnnotated}
              onSave={async (preview) => {
                await api.adminUpdateMeta({ id: item.id, annotation: preview, annotationStatus: 'annotated' });
                setSavedAnn({ status: 'annotated', annotation: preview });
                setMsg('Annotation saved ✓'); onChanged(); setTimeout(() => setMsg(''), 1800);
              }}
            />
          </div>

          {msg && <p style={{ color: '#166534', fontWeight: 700, fontSize: 13, margin: '6px 0' }}>{msg}</p>}

          <div className="admin-modal-actions">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMeta}><Save size={15} /> Save edits</button>
            <button className="btn" style={{ flex: 1, background: '#dcfce7', color: '#166534' }} onClick={() => setStatusAnd('approved')}><Check size={15} /> Approve</button>
            <button className="btn" style={{ flex: 1, background: '#fef3c7', color: '#92400e' }} onClick={() => setStatusAnd('flagged')}><Flag size={15} /> Flag</button>
            <button className="btn" style={{ flex: 1, background: '#fee2e2', color: '#991b1b' }} onClick={() => setStatusAnd('rejected')}><X size={15} /> Reject</button>
          </div>
          <p className="admin-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            Reviews: {item.reviews}/{item.maxReviews} · +{item.points} pts · {fmtDate(item.createdAt)} {fmtTime(item.createdAt)} · {item.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

export { DetailModal };

