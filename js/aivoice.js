// Gemini 음성 합성으로 실제 시험의 Ava 처럼 자연스러운 목소리 만들기.
// 실패하면(한도·과부하·오프라인) 폰 기본 음성(tts.js)으로 자동 대체한다.
import { state, audioPut, audioGet, audioDel, bump } from './store.js';
import { hashStr } from './util.js';
import * as tts from './tts.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
export const AI_VOICES = [
  ['Aoede', '여성 · 밝고 부드러운'],
  ['Kore', '여성 · 또렷한'],
  ['Leda', '여성 · 젊은'],
  ['Puck', '남성 · 경쾌한'],
  ['Charon', '남성 · 차분한'],
];
const cooling = new Map();
const memo = new Map(); // key → Promise<Blob|null>

export const aiVoiceOn = () => !!state.settings.apiKey && state.settings.aiVoice !== false;

function pcmToWav(bytes, rate) {
  const out = new DataView(new ArrayBuffer(44 + bytes.length));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + bytes.length, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, bytes.length, true);
  new Uint8Array(out.buffer, 44).set(bytes);
  return new Blob([out], { type: 'audio/wav' });
}

async function synthOnce(model, text, voice) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.settings.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read this aloud like a friendly, calm English-speaking interviewer, at a natural pace:\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) cooling.set(model, Date.now() + 10 * 60 * 1000);
      return null;
    }
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) return null;
    const bin = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
    const mime = part.inlineData.mimeType.toLowerCase();
    bump('ai');
    if (mime.includes('wav')) return new Blob([bin], { type: 'audio/wav' });
    const rate = +(mime.match(/rate=(\d+)/)?.[1] || 24000);
    return pcmToWav(bin, rate);
  } catch {
    cooling.set(model, Date.now() + 3 * 60 * 1000);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 합성한 음성은 최근 80개만 기기에 보관
const CACHE_LIST = 'opic-tts-cache';
function remember(key, blob) {
  audioPut(key, blob).catch(() => {});
  const list = JSON.parse(localStorage.getItem(CACHE_LIST) || '[]').filter((k) => k !== key);
  list.push(key);
  for (const old of list.splice(0, Math.max(0, list.length - 80))) audioDel(old).catch(() => {});
  localStorage.setItem(CACHE_LIST, JSON.stringify(list));
}

const cacheKey = (text) => `tts-${state.settings.aiVoiceName || 'Aoede'}-${hashStr(text)}`;

/** 이미 만들어 둔 음성만 꺼낸다 (새로 만들지 않음) */
async function cached(text) {
  const key = cacheKey(text);
  if (memo.has(key)) return memo.get(key);
  return audioGet(key).catch(() => null);
}

/** 텍스트 → 음성 Blob. 같은 문장은 기기에 저장해 두고 다시 쓴다 */
export function synthesize(text) {
  if (!aiVoiceOn()) return Promise.resolve(null);
  const voice = state.settings.aiVoiceName || 'Aoede';
  const key = cacheKey(text);
  if (memo.has(key)) return memo.get(key);
  const p = (async () => {
    const cached = await audioGet(key).catch(() => null);
    if (cached) return cached;
    const now = Date.now();
    const order = [...MODELS.filter((m) => !(cooling.get(m) > now)), ...MODELS.filter((m) => cooling.get(m) > now)];
    for (const m of order) {
      const blob = await synthOnce(m, text, voice);
      if (blob) {
        remember(key, blob);
        return blob;
      }
    }
    return null;
  })();
  memo.set(key, p);
  p.then((b) => { if (!b) memo.delete(key); });
  return p;
}

// 아이폰 사파리는 사용자가 화면을 터치한 순간에 한 번 재생해 둔 오디오만 나중에 자동 재생할 수 있다.
// 그래서 하나의 audio 요소를 첫 터치 때 무음으로 "잠금 해제"해 두고 계속 재사용한다.
const player = new Audio();
const SILENT = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  player.src = SILENT;
  player.play().then(() => player.pause()).catch(() => { unlocked = false; });
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch { /* 음성 합성 미지원 */ }
}
addEventListener('touchend', unlock, { capture: true, passive: true });
addEventListener('click', unlock, { capture: true });

let current = null;
let sayToken = 0;
export function stopAll() {
  sayToken++;
  if (current) { player.pause(); current = null; }
  tts.stop();
}

/**
 * AI 음성으로 읽고, 준비가 안 되면 폰 음성으로 읽는다.
 * waitMs: AI 음성을 기다리는 최대 시간. cachedOnly: 이미 만든 음성만 쓰고 새로 만들지 않음 (카드처럼 자주 읽는 곳)
 * onStart(kind): 'ai' | 'device' | 'none'(재생 못 함 — 사용자가 다시 눌러야 함)
 */
export async function say(text, { waitMs = 9000, cachedOnly = false, onStart, onEnd } = {}) {
  stopAll();
  const my = sayToken;
  let started = false;
  const start = (kind) => { if (!started && my === sayToken) { started = true; onStart?.(kind); } };
  let blob = null;
  if (aiVoiceOn()) {
    blob = cachedOnly
      ? await cached(text)
      : await Promise.race([synthesize(text), new Promise((r) => setTimeout(() => r(null), waitMs))]);
  }
  if (my !== sayToken) return; // 기다리는 사이 다른 재생이나 화면 이동이 있었음
  if (blob) {
    const url = URL.createObjectURL(blob);
    const token = {};
    current = token;
    player.onended = () => { URL.revokeObjectURL(url); if (current === token) { current = null; onEnd?.(); } };
    player.src = url;
    try {
      await player.play();
      start('ai');
      return;
    } catch {
      current = null;
      URL.revokeObjectURL(url);
    }
  }
  tts.speak(text, { onStart: () => start('device'), onEnd });
  setTimeout(() => start('none'), 4000); // 폰 음성도 시작 못 하면 (자동 재생 차단 등) 알려 준다
}
