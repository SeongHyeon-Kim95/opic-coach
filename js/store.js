// 모든 데이터는 이 기기의 IndexedDB 에만 저장된다 (서버 없음).
import seed from './data/seed-vocab.js';
import { today, addDays, uid } from './util.js';

export const DEFAULT_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
const SEED_VERSION = 1;
const MAX_AUDIO = 60; // 녹음 파일은 최근 60개만 보관

const DEFAULTS = {
  settings: () => ({
    apiKey: '',
    models: [...DEFAULT_MODELS],
    goals: { speak: 3, review: 20, newCards: 10 },
    tts: { voice: '', rate: 0.95 },
    examMode: true,
    keepAudio: true,
    cardDir: 'ko2en',
    seedVersion: 0,
  }),
  profile: () => ({
    name: '',
    level: '토익스피킹 Level 7 · 오픽은 처음',
    target: 'IH',
    job: 'office',
    jobDesc: '',
    living: '',
    livingDesc: '',
    survey: [],
    facts: '',
  }),
  cards: () => [],
  notes: () => [],
  history: () => [],
  mocks: () => [],
  stats: () => ({ days: {} }),
};
export const state = {};

let dbp;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('opic-daily', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('audio');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const audioPut = (id, blob) => tx('audio', 'readwrite', (s) => s.put(blob, id));
export const audioGet = (id) => tx('audio', 'readonly', (s) => s.get(id));
export const audioDel = (id) => tx('audio', 'readwrite', (s) => s.delete(id));

export async function loadState() {
  for (const k of Object.keys(DEFAULTS)) {
    const v = await kvGet(k);
    state[k] = v === undefined ? DEFAULTS[k]() : v;
  }
  const ds = DEFAULTS.settings();
  state.settings = {
    ...ds, ...state.settings,
    goals: { ...ds.goals, ...state.settings.goals },
    tts: { ...ds.tts, ...state.settings.tts },
  };
  if (!state.settings.models?.length) state.settings.models = [...DEFAULT_MODELS];
  state.profile = { ...DEFAULTS.profile(), ...state.profile };
  mergeSeed();
  navigator.storage?.persist?.().catch(() => {});
}

function mergeSeed() {
  if (state.settings.seedVersion >= SEED_VERSION) return;
  const have = new Set(state.cards.map((c) => c.id));
  for (const s of seed) if (!have.has(s.id)) state.cards.push(newCard({ ...s, src: 'seed' }));
  state.settings.seedVersion = SEED_VERSION;
  save('cards');
  save('settings');
}

export function newCard(fields) {
  return {
    kind: 'vocab', state: 'new', due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0, created: today(),
    ...fields,
    id: fields.id || uid(),
  };
}

const pending = new Map();
export function save(key) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    kvSet(key, state[key]).catch((e) => console.error('save failed', key, e));
  }, 250));
}
export function flush() {
  for (const [k, t] of pending) {
    clearTimeout(t);
    kvSet(k, state[k]).catch((e) => console.error('save failed', k, e));
  }
  pending.clear();
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.hidden && flush());

// ---------- 하루 기록 / 연속 학습일 ----------
const EMPTY_DAY = { speak: 0, review: 0, newCards: 0, ai: 0 };
export const dayStat = (d = today()) => ({ ...EMPTY_DAY, ...state.stats.days[d] });
export function bump(field, n = 1) {
  const d = today();
  state.stats.days[d] = { ...EMPTY_DAY, ...state.stats.days[d] };
  state.stats.days[d][field] += n;
  save('stats');
}
/** 말하기 1문항 이상 또는 카드 10장 이상이면 그날 공부한 것으로 친다 */
export function isActive(d) {
  const s = state.stats.days[d];
  return !!s && (s.speak > 0 || s.review >= 10);
}
export function streak() {
  let d = today();
  if (!isActive(d)) d = addDays(d, -1);
  let n = 0;
  while (isActive(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- 답변 기록 ----------
export async function addHistory(entry, audioBlob) {
  if (audioBlob && state.settings.keepAudio) {
    entry.audioId = entry.id;
    await audioPut(entry.id, audioBlob).catch(() => { entry.audioId = null; });
  }
  state.history.unshift(entry);
  state.history.sort((a, b) => b.ts - a.ts);
  const withAudio = state.history.filter((h) => h.audioId);
  for (const old of withAudio.slice(MAX_AUDIO)) {
    audioDel(old.audioId).catch(() => {});
    old.audioId = null;
  }
  save('history');
}

// ---------- 백업 ----------
const BACKUP_KEYS = ['settings', 'profile', 'cards', 'notes', 'history', 'mocks', 'stats'];
export function exportJSON(includeKey = false) {
  const out = { app: 'opic-daily', version: 1, exportedAt: new Date().toISOString() };
  for (const k of BACKUP_KEYS) out[k] = state[k];
  if (!includeKey) out.settings = { ...state.settings, apiKey: '' };
  return JSON.stringify(out);
}
export function importJSON(text) {
  const d = JSON.parse(text);
  if (d.app !== 'opic-daily') throw new Error('오픽 데일리 백업 파일이 아니에요');
  const key = state.settings.apiKey;
  for (const k of BACKUP_KEYS) if (d[k]) state[k] = d[k];
  if (!state.settings.apiKey) state.settings.apiKey = key;
  for (const k of BACKUP_KEYS) save(k);
  flush();
}
export async function resetAll() {
  const d = await db();
  d.close();
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase('opic-daily');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}
