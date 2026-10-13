import React, { useState, useRef } from 'react';
import { Pause, Play, Download } from 'lucide-react';

export default function AudioCell({ url }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef(null);
  if (!url) return <span className="admin-muted">—</span>;
  const toggle = (e) => {
    e && e.stopPropagation();
    if (!ref.current) { ref.current = new Audio(url); ref.current.onended = () => setPlaying(false); }
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play(); setPlaying(true); }
  };
  return (
    <div className="admin-audio" onClick={e => e.stopPropagation()}>
      <button className="admin-mini-btn play" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
      <a className="admin-mini-btn" href={url} download="nuji-recording.webm" title="Download audio"><Download size={13} /></a>
    </div>
  );
}

export { AudioCell };

