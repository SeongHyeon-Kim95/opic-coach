// 받아쓰기(transcript)에서 바로 계산하는 객관 지표 — AI 판단과 별개로 늘 같은 기준
const FILLERS = /\b(um+|uh+|erm*|hmm+|you know|i mean|like,)/gi;
const CONNECTORS = /\b(and so|so|but|because|'cause|cause|and then|then|anyway|actually|also|that's why|you know what|plus|still|after that|in the end|by the way|on top of that)\b/gi;

// 고득점(IH 이상) 답변 기준: 오픽업 분석 — 답변당 평균 184단어, 접속어 3~4개 이상
export const BENCH = { words: 150, wpmLow: 100, wpmHigh: 160, connectors: 4 };

export function answerMetrics(transcript, durationSec) {
  const text = String(transcript || '');
  const words = (text.match(/[A-Za-z']+/g) || []).length;
  const fillers = (text.match(FILLERS) || []).length;
  const connectors = (text.match(CONNECTORS) || []).length;
  const wpm = durationSec ? Math.round(words / (durationSec / 60)) : null;
  return { words, fillers, connectors, wpm };
}
