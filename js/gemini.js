// Gemini API 를 브라우저에서 직접 호출한다. 키는 이 기기에만 저장됨.
// 모델 하나가 과부하(503)·한도초과(429)·시간초과면 설정의 다음 모델로 자동으로 넘어간다.
import { state, bump } from './store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// 바쁘거나 한도가 찬 모델은 10분 동안 순서를 뒤로 미룬다 (매번 기다리지 않도록)
const COOLDOWN_MS = 10 * 60 * 1000;
const cooling = new Map();
function modelOrder(models) {
  const now = Date.now();
  const ok = models.filter((m) => !(cooling.get(m) > now));
  return [...ok, ...models.filter((m) => !ok.includes(m))];
}

function thinkingFor(model, level) {
  if (/gemini-2\.5/.test(model)) {
    if (/lite/.test(model)) return {};
    return { thinkingConfig: { thinkingBudget: level === 'low' ? 512 : -1 } };
  }
  if (/gemini-3/.test(model)) return { thinkingConfig: { thinkingLevel: level } };
  return {};
}

/**
 * JSON 스키마로 구조화된 응답을 받는다.
 * parts: [{text}] 또는 [{inlineData:{mimeType,data}}, {text}]
 */
export async function generate({ system, parts, schema, thinking = 'low', temperature, timeoutMs = 60000, onModel }) {
  const { apiKey, models } = state.settings;
  if (!apiKey) throw new AiError('NO_KEY', 'Gemini API 키가 없어요. 설정에서 키를 입력해 주세요.');
  let lastErr = new AiError('NO_MODEL', '사용할 모델이 설정되어 있지 않아요.');
  for (const model of modelOrder(models)) {
    onModel?.(model);
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        ...(temperature != null ? { temperature } : {}),
        ...thinkingFor(model, thinking),
      },
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || res.statusText;
        if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|unregistered callers/i.test(msg + (data?.error?.status || ''))) {
          throw new AiError('BAD_KEY', 'API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.');
        }
        lastErr = new AiError(res.status === 429 ? 'QUOTA' : 'HTTP', `${model}: ${res.status} ${msg}`);
        if (res.status === 429 || res.status >= 500) cooling.set(model, Date.now() + COOLDOWN_MS);
        continue;
      }
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (!text) {
        lastErr = new AiError('EMPTY', `${model}: 빈 응답 (${cand?.finishReason || data.promptFeedback?.blockReason || '이유 불명'})`);
        continue;
      }
      const parsed = JSON.parse(text);
      cooling.delete(model);
      bump('ai');
      return { data: parsed, model: data.modelVersion || model };
    } catch (e) {
      if (e instanceof AiError && e.code === 'BAD_KEY') throw e;
      if (e.name === 'AbortError') {
        lastErr = new AiError('TIMEOUT', `${model}: 응답 시간 초과`);
        cooling.set(model, Date.now() + COOLDOWN_MS);
      } else if (e instanceof SyntaxError) lastErr = new AiError('PARSE', `${model}: 응답 형식 오류`);
      else lastErr = new AiError('NET', navigator.onLine ? `${model}: ${e.message}` : '인터넷 연결을 확인해 주세요.');
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export function friendlyError(e) {
  if (!(e instanceof AiError)) return `오류: ${e.message}`;
  if (e.code === 'QUOTA') return '오늘 무료 사용량을 다 쓴 것 같아요. 잠시 후 다시 시도하거나 내일 이용해 주세요.';
  if (e.code === 'TIMEOUT' || e.code === 'HTTP') return `AI 서버가 바빠요. 잠시 후 다시 시도해 주세요. (${e.message})`;
  return e.message;
}

/** 설정 화면의 "키 테스트" — 가장 싼 호출로 키와 모델 응답 여부를 확인 */
export async function testKey() {
  const r = await generate({
    system: 'Reply in JSON.',
    parts: [{ text: 'Say OK.' }],
    schema: { type: 'OBJECT', properties: { ok: { type: 'STRING' } }, required: ['ok'] },
    timeoutMs: 30000,
  });
  return r.model;
}
