// Small in-place radix-2 FFT (size must be a power of 2) — used to detect human voice
export function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi;
        const vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nw = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nw;
      }
    }
  }
}

// Full analysis of the finished recording: level + frame-based HUMAN VOICE detection.
// Rejects empty recordings and background noise (fans, traffic, hiss, TV static) —
// only real speech has voiced frames, a peaky spectrum, voice-band energy and syllable dynamics.
export async function analyzeAudio(blob) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    ctx.close();

    // overall level (same metrics as before)
    let sum = 0, zc = 0, prev = 0, n = 0, active = 0;
    const step = Math.max(1, Math.floor(ch.length / 60000));
    for (let i = 0; i < ch.length; i += step) { const v = ch[i]; sum += v * v; if (Math.abs(v) > 0.01) active++; if ((v >= 0) !== (prev >= 0)) zc++; prev = v; n++; }
    const rms = Math.sqrt(sum / (n || 1));
    const zcr = zc / (n || 1);

    // frame-based voice detection (21 ms frames, 50% overlap)
    const N = 1024, hop = 512;
    const frameCount = Math.max(0, Math.floor((ch.length - N) / hop) + 1);
    const energies = [], flatArr = [], bandArr = [], zcrArr = [];
    const re = new Float64Array(N), im = new Float64Array(N);
    const binHz = sr / N;
    const loBin = Math.max(2, Math.round(80 / binHz)), hiBin = Math.min(N / 2 - 1, Math.round(3500 / binHz));
    for (let f = 0; f < frameCount; f++) {
      const off = f * hop;
      let e = 0, z = 0, pv = 0;
      for (let i = 0; i < N; i++) {
        const v = ch[off + i];
        re[i] = v * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)));
        im[i] = 0;
        e += v * v;
        if ((v >= 0) !== (pv >= 0)) z++;
        pv = v;
      }
      e = Math.sqrt(e / N);
      energies.push(e);
      zcrArr.push(z / N);
      fftInPlace(re, im);
      let total = 0, band = 0, logSum = 0, linSum = 0;
      for (let k = 1; k < N / 2; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        total += p;
        if (k >= loBin && k <= hiBin) band += p;
        const pp = p + 1e-12;
        logSum += Math.log(pp); linSum += pp;
      }
      const bins = N / 2 - 1;
      flatArr.push(Math.exp(logSum / bins) / ((linSum / bins) || 1e-12)); // 1 = flat noise, ~0 = peaky voice
      bandArr.push(total ? band / total : 0);
    }

    // adaptive noise floor (20th percentile of frame energy)
    const sorted = [...energies].sort((a, b) => a - b);
    const pct = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
    const floor = Math.max(pct(0.2), 0.0015);
    const thr = Math.max(floor * 3, 0.004);

    let activeFrames = 0, voicedFrames = 0, flatSum = 0, bandSum = 0;
    for (let f = 0; f < frameCount; f++) {
      if (energies[f] <= thr) continue;
      activeFrames++;
      if (zcrArr[f] < 0.2) voicedFrames++;          // voiced speech: low zero-crossing rate
      flatSum += flatArr[f];
      bandSum += bandArr[f];
    }
    const activeFracV = frameCount ? activeFrames / frameCount : 0;
    const voicedFrac = frameCount ? voicedFrames / frameCount : 0;
    const flatness = activeFrames ? flatSum / activeFrames : 1;
    const bandRatio = activeFrames ? bandSum / activeFrames : 0;
    const dynamics = pct(0.9) / Math.max(pct(0.1), floor * 0.5, 1e-4); // speech varies, steady noise doesn't

    const voice = {
      activeFrac: activeFracV, voicedFrac, flatness, bandRatio, dynamics,
      ok: activeFracV >= 0.18 && voicedFrac >= 0.12 && flatness <= 0.4 && bandRatio >= 0.45 && dynamics >= 2.2
    };
    return { duration: buf.duration, rms, zcr, activeFrac: n ? active / n : 0, n, voice };
  } catch { return null; }
}

// industry-style heuristics: too short / silent mic / extreme noise / no human voice
// (voice metrics come from analysing the FINISHED recording, so they can't be faked)
export function audioProblems(m) {
  if (!m) return [];
  const p = [];
  if (m.duration < 3) p.push('too_short');
  if (m.n > 0 && (m.activeFrac < 0.05 || m.rms < 0.005)) p.push('silent');
  if (m.n > 0 && (m.rms > 0.35 || (m.zcr > 0.4 && m.rms > 0.06))) p.push('noisy');
  if (m.voice && !m.voice.ok) p.push('no_voice');
  return p;
}

export const PROBLEMS = {
  too_short: 'Recording is under 1 seconds — speak a little longer and try again.',
  silent: 'No voice detected (silent recording). Check your microphone and try again.',
  noisy: 'Extreme background noise detected. Move to a quieter spot and try again.',
  no_voice: 'We could not detect a clear human voice in this recording. Please speak clearly into the microphone and try again — background noise alone is not accepted.',
  bad_audio: 'This audio file could not be accepted. Please record again in the app and try once more.'
};

export const AUDIO_ERROR_MSG = PROBLEMS;

export const fmtDur = (s) => `0:${String(Math.max(0, Math.round(s))).padStart(2, '0')}`;
