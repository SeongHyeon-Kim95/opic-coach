// 마이크 녹음 + Gemini 로 보낼 16kHz 모노 WAV 변환
const AC = window.AudioContext || window.webkitAudioContext;

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export class Recorder {
  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
      .find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.t0 = performance.now();

    this.ctx = new AC();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      onLevel?.(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  elapsed() {
    return this.t0 ? (performance.now() - this.t0) / 1000 : 0;
  }

  stop() {
    return new Promise((resolve) => {
      const duration = this.elapsed();
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
        this.cleanup();
        resolve({ blob, duration });
      };
      this.rec.state === 'inactive' ? this.rec.onstop() : this.rec.stop();
    });
  }

  cancel() {
    try { this.rec?.state !== 'inactive' && this.rec?.stop(); } catch { /* 이미 멈춤 */ }
    this.cleanup();
  }

  cleanup() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

/** 녹음(webm/mp4)을 16kHz 모노 WAV 로 바꾼다 — Gemini 가 확실히 읽는 형식 */
export async function toWav16k(blob) {
  const buf = await blob.arrayBuffer();
  const ctx = new AC();
  const decoded = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej));
  ctx.close().catch(() => {});
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);

  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return { blob: new Blob([out], { type: 'audio/wav' }), duration: decoded.duration };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Gemini 로 보낼 오디오: 크롬(webm/ogg)은 그대로(용량 작음), 그 외(아이폰 mp4 등)는 WAV 로 변환 */
export async function audioForAI(blob) {
  const type = (blob.type || '').split(';')[0];
  if (/webm|ogg/.test(type)) return { mimeType: type, data: await blobToBase64(blob) };
  try {
    const wav = await toWav16k(blob);
    return { mimeType: 'audio/wav', data: await blobToBase64(wav.blob) };
  } catch {
    return { mimeType: type || 'audio/mp4', data: await blobToBase64(blob) };
  }
}
