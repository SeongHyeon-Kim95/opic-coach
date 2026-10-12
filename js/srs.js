// 간격 반복(SRS) — Anki 의 SM-2 를 하루 단위로 단순화
import { state, save, bump } from './store.js';
import { today, addDays, shuffle } from './util.js';
import { TOPICS, CORE_SEED_TOPICS } from './data/topics.js';

export const GRADES = [
  { key: 0, label: '다시', cls: 'g0' },
  { key: 1, label: '어려움', cls: 'g1' },
  { key: 2, label: '알맞음', cls: 'g2' },
  { key: 3, label: '쉬움', cls: 'g3' },
];

/** 채점 결과로 다음 간격(일)을 계산. 0 = 오늘 다시 */
export function nextInterval(card, grade) {
  if (grade === 0) return 0;
  const learned = card.state === 'review' && card.ivl > 0;
  if (grade === 1) return learned ? Math.max(1, Math.round(card.ivl * 1.2)) : 1;
  if (grade === 2) return learned ? Math.max(card.ivl + 1, Math.round(card.ivl * card.ease)) : card.reps >= 1 ? 3 : 1;
  return learned ? Math.max(card.ivl + 2, Math.round(card.ivl * card.ease * 1.3)) : 4;
}

export function intervalLabel(days) {
  if (days === 0) return '곧 다시';
  if (days < 30) return `${days}일`;
  if (days < 365) return `${Math.round(days / 30)}개월`;
  return `${(days / 365).toFixed(1)}년`;
}

export function grade(card, g) {
  const t = today();
  if (card.state === 'new') {
    card.first = t;
    bump('newCards');
  }
  const ivl = nextInterval(card, g);
  if (g === 0) {
    if (card.state === 'review' && card.ivl > 0) card.lapses++;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.state = 'learn';
  } else {
    if (g === 1) card.ease = Math.max(1.3, card.ease - 0.15);
    if (g === 3) card.ease = Math.min(3.2, card.ease + 0.15);
    card.state = 'review';
    card.reps++;
  }
  card.ivl = ivl;
  card.due = addDays(t, ivl);
  card.last = t;
  bump('review');
  save('cards');
}

const isDue = (c) => (c.state === 'review' || c.state === 'learn') && c.due && c.due <= today();
export const dueCards = () => state.cards.filter(isDue);
export const newLearnedToday = () => state.cards.filter((c) => c.first === today()).length;

/** 서베이 주제에 연결된 단어장 주제 */
function surveySeedTopics() {
  const ids = [...state.profile.survey, 'home', 'work', 'neighborhood'];
  return new Set(ids.map((id) => TOPICS[id]?.seed).filter(Boolean));
}

/** 새 카드 우선순위: 직접 추가한 카드 → 공통 표현 → 내 서베이 주제 → 나머지 */
export function newCardQueue() {
  const mine = surveySeedTopics();
  const rank = (c) => {
    if (c.src !== 'seed') return 0;
    if (CORE_SEED_TOPICS.includes(c.t)) return 1;
    if (mine.has(c.t)) return 2;
    if (c.t === 'collocation' || c.t === 'roleplay') return 3;
    return 4;
  };
  return state.cards
    .filter((c) => c.state === 'new')
    .map((c, idx) => ({ c, r: rank(c), idx }))
    .sort((a, b) => a.r - b.r || a.idx - b.idx)
    .map((x) => x.c);
}

export function newRemainingToday() {
  return Math.max(0, state.settings.goals.newCards - newLearnedToday());
}

/** 오늘의 복습 묶음: 복습 카드 + 오늘 몫의 새 카드. more: 오늘 몫과 별개로 새 카드 n장 더 */
export function buildSession({ topic, more } = {}) {
  const inTopic = (c) => !topic || c.t === topic;
  const due = more ? [] : shuffle(dueCards().filter(inTopic));
  const fresh = newCardQueue().filter(inTopic).slice(0, more || (topic ? 20 : newRemainingToday()));
  // 새 카드를 복습 사이사이에 섞는다
  const out = [...due];
  fresh.forEach((c, i) => out.splice(Math.min(out.length, i * 3 + 2), 0, c));
  return out;
}

export function deckStats() {
  const s = { total: 0, new: 0, learning: 0, mature: 0, due: 0 };
  for (const c of state.cards) {
    s.total++;
    if (c.state === 'new') s.new++;
    else if (c.ivl >= 21) s.mature++;
    else s.learning++;
    if (isDue(c)) s.due++;
  }
  return s;
}
