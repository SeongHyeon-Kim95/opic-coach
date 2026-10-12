// 폰에 내장된 영어 음성(TTS)으로 질문·예문 읽기 — 무료, 오프라인 동작
import { state } from './store.js';

const synth = window.speechSynthesis;
let voices = [];
const listeners = new Set();
function loadVoices() {
  voices = (synth?.getVoices() || []).filter((v) => /^en[-_]/i.test(v.lang));
  listeners.forEach((fn) => fn(voices));
}
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);

/** 음성 목록이 늦게 로드될 때 알림. 반환값: 구독 해제 함수 */
export function onVoices(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const ttsAvailable = () => !!synth;
export const englishVoices = () => voices;

const PREFERRED = [/Google US English/i, /Samantha/i, /Ava/i, /Allison/i, /Natural/i, /Enhanced|Premium/i, /en-us-x-/i];
function bestVoice() {
  const chosen = voices.find((v) => v.voiceURI === state.settings.tts.voice);
  if (chosen) return chosen;
  const us = voices.filter((v) => /en[-_]US/i.test(v.lang));
  for (const re of PREFERRED) {
    const v = us.find((x) => re.test(x.name) || re.test(x.voiceURI));
    if (v) return v;
  }
  return us[0] || voices[0] || null;
}

export function splitSentences(text) {
  return String(text).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [];
}

let session = 0;
export function stop() {
  session++;
  synth?.cancel();
}

/**
 * 문장 단위로 끊어 읽는다 (안드로이드 크롬의 긴 문장 끊김 방지).
 * lines: 문자열 또는 문자열 배열. onLine(i): 읽기 시작한 줄 번호.
 */
export function speak(lines, { rate, onLine, onEnd } = {}) {
  if (!synth) return onEnd?.();
  stop();
  const my = session;
  const list = (Array.isArray(lines) ? lines : [lines]).map((line, i) => ({ i, parts: splitSentences(line) }));
  const queue = list.flatMap(({ i, parts }) => parts.map((text, k) => ({ i, text, first: k === 0 })));
  const voice = bestVoice();
  let n = 0;
  const next = () => {
    if (my !== session) return;
    if (n >= queue.length) return onEnd?.();
    const { i, text, first } = queue[n++];
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = rate ?? state.settings.tts.rate;
    u.onend = next;
    u.onerror = next;
    if (first) onLine?.(i);
    synth.speak(u);
  };
  next();
}
