// 오늘의 주제 고르기, 오프라인 질문 만들기 등 말하기 연습 계획
import { state } from './store.js';
import { today, hashStr, pick } from './util.js';
import { TOPICS, SURPRISE_TOPICS, OFFLINE_TEMPLATES, OFFLINE_ROLEPLAY } from './data/topics.js';

const FALLBACK_SURVEY = ['home', 'music', 'movie', 'park', 'travel_domestic', 'cafe'];

/** 하루 동안 고정되는 오늘의 콤보 주제. 4일에 한 번은 돌발 주제 */
export function todayTopic(date = today()) {
  const h = hashStr(date);
  if (h % 4 === 3) return SURPRISE_TOPICS[(h >>> 3) % SURPRISE_TOPICS.length][0];
  const survey = state.profile.survey.length ? state.profile.survey : FALLBACK_SURVEY;
  const pool = [...new Set([...survey, 'home', 'neighborhood'])];
  return pool[(h >>> 3) % pool.length];
}

export const randomSurprise = () => pick(SURPRISE_TOPICS)[0];

export function practiceTopics() {
  const survey = state.profile.survey.length ? state.profile.survey : FALLBACK_SURVEY;
  return [...new Set(['home', 'neighborhood', 'work', ...survey])].filter((id) => TOPICS[id]);
}

export function recentQuestions() {
  return state.history.slice(0, 30).map((h) => h.question?.q).filter(Boolean);
}

export function offlineQuestions(topicId, categories) {
  const t = TOPICS[topicId];
  if (categories[0]?.startsWith('rp')) {
    const set = pick(OFFLINE_ROLEPLAY);
    return categories.map((c) => ({ q: set[c], ko: '', category: c, topicId, offline: true }));
  }
  const used = new Set();
  return categories.map((c) => {
    const options = OFFLINE_TEMPLATES[c] || OFFLINE_TEMPLATES.desc;
    let tpl = options.find((f) => !used.has(f)) || options[0];
    used.add(tpl);
    return { q: tpl(t), ko: '', category: c, topicId, offline: true };
  });
}
