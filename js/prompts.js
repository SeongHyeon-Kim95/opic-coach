// AI 에게 보내는 프롬프트와 응답 스키마. 코칭 기준은 오픽노잼 방식 (OPIC_Complete_Guide 정리 내용).
import { state } from './store.js';
import { TOPICS, CATEGORIES, JOB_OPTIONS, LIVING_OPTIONS } from './data/topics.js';
import { generate } from './gemini.js';

// ---------- 스키마 헬퍼 (Gemini responseSchema 형식) ----------
const S = { type: 'STRING' };
const B = { type: 'BOOLEAN' };
const I = { type: 'INTEGER' };
const arr = (items) => ({ type: 'ARRAY', items });
const obj = (properties, required = Object.keys(properties)) => ({
  type: 'OBJECT', properties, required, propertyOrdering: Object.keys(properties),
});
const enumS = (values) => ({ type: 'STRING', enum: values });
const EN_KO = obj({ en: S, ko: S });

// ---------- 공통 시스템 프롬프트 ----------
function learnerBlock() {
  const p = state.profile;
  const job = JOB_OPTIONS.find((o) => o.id === p.job)?.ko || '';
  const living = LIVING_OPTIONS.find((o) => o.id === p.living)?.ko || '';
  const survey = p.survey.map((id) => TOPICS[id]?.en).filter(Boolean).join(', ');
  return [
    `- English name: ${p.name || '(not set — do not invent a name)'}`,
    `- Current level: ${p.level}`,
    `- Target grade: ${p.target}`,
    `- Job (survey): ${job}${p.jobDesc ? ` — ${p.jobDesc}` : ''}`,
    `- Living (survey): ${living}${p.livingDesc ? ` — ${p.livingDesc}` : ''}`,
    `- Survey topics chosen: ${survey || '(not set)'}`,
    `- Facts about me: ${p.facts || '(none)'}`,
  ].join('\n');
}

const METHOD = `## Coaching method (오픽노잼 OPIc NoJam)
1. MP (Main Point) = What + Feeling + Why, said early (IH: within ~25s). Everything after supports the MP, and the story must match the MP.
2. Basic structure: MP → details/examples → conclusion that returns to the MP. IH flow: natural start → MP → 2+ examples ("also", "as well") → re-emphasize ("The one thing I love about ~ is...") → wrap-up ("So yeah, that's ~ in a nutshell." / "That's why..." / "Anyway, ...").
3. Category structures:
 - Description (max IH): "What I really love about ~ is..." + feeling + why → details → short conclusion.
 - Habit (max IH): action MP ("Whenever I..., I always...") → why it matters / feeling → quick comparison ("But in the past... / But now...") → conclusion. Frequency adverbs.
 - Past experience (AL possible): climax first ("I once... / I remember one time...") + feeling + why → background → event → result in CONSISTENT past tense → direct quotes ("I was like, '...'", "I thought to myself, '...'") → what I learned / how I feel now.
 - Comparison (AL possible): MP in pure present (do not mention the past in the MP) → past → back to present → conclusion. No bouncing back and forth.
 - Role-play 11: 1–2 sentence situation → question → RRF (Reaction "Oh, that cheap?!", Repeat "Only $10?", Feeling "That's great!") → 2 more questions ("Oh, I almost forgot!") → thanks. Under ~1 min.
 - Role-play 12: apologize + explain the problem briefly → exactly the number of alternatives asked (2–3): "One option is... / Another option would be... / Or you could also..." → wrap-up.
 - Role-play 13: past experience of a similar problem → what happened → how it was solved → feeling.
 - IHU14: comparison about PEOPLE/SOCIETY, not only me. IHU15: social issue/concern; a short clear opinion is enough (skipping is allowed in the real test).
4. Expansion tools: MP+2 (MP → something else → back to MP), 99/1 (99% one point, 1% small downside, back), SRR (Simple sentence → Repeat the feeling with "Like, / I mean, / Seriously," → Reason), Root-word variation (amazed/amazing), General→Singular question control ("As you may know, ... But you know what? Let's talk about ..."), quick comparison (now → past → now).
5. Natural spoken style: short, easy sentences are GOOD. Fillers attached to the next words: "you know", "I mean", "like", "You know what?", "And so", "Anyway". Vary openings. Use pronouns instead of repeating nouns. Emotion words stretched ("so~ good", "really").
   AVOID (sounds written or memorized): Moreover, Furthermore, In addition, frankly speaking, "As you know", "I want to tell you about", ending with "That's all.", stacking adjectives with "and" ("comfortable and cozy"), and anything that smells like a script.
6. Length: IH ≈ 10 sentences, about 1:00–1:30. Description/habit can be ~1:00. Over 2:00 is a minus. Short and clear beats long and empty.
7. Grammar priority: tense consistency > complete sentences (subject + verb, be-verb) > plurals/articles/modals > word order. Watch -ed vs -ing feelings (I was bored ≠ boring), "two weeks ago", "after dinner", "these days".`;

function systemPrompt() {
  return `You are "오픽 코치", an expert OPIc (ACTFL) speaking coach for a Korean adult learner.

## Learner
${learnerBlock()}
Keep stories consistent with these facts. You may add small believable details, but never contradict the facts.

${METHOD}

## Output rules
- Korean text: natural, friendly, concise 해요체. Explain like a good tutor, no fluff.
- English: natural spoken American English the learner can actually say — easy words, short sentences, not textbook-like.
- Return only JSON that matches the schema.`;
}

// ---------- 1) 질문 생성 ----------
const QUESTION_SCHEMA = obj({
  questions: arr(obj({
    q: S,
    ko: S,
    hint: obj({
      mp_en: S,
      mp_ko: S,
      plan_ko: arr(S),
      expressions: arr(EN_KO),
    }),
  })),
});

export async function generateQuestions({ topicId, categories, recent = [], onModel }) {
  const topic = TOPICS[topicId];
  const isRp = categories[0]?.startsWith('rp');
  const plan = categories.map((c, i) => `${i + 1}. ${CATEGORIES[c].en}`).join('\n');
  const text = `Create ${categories.length} OPIc question(s) for a 6-6 difficulty test.
Topic: ${topic.en} (${topic.ko}) — ${topic.kind === 'surprise' ? 'unexpected topic (not from the survey)' : 'from the learner\'s background survey'}
Question types in order:
${plan}
${isRp ? 'This is one role-play set: questions 2 and 3 continue the situation of question 1 (same place/thing).' : categories.length > 1 ? 'This is one combo set on the same topic, like the real test.' : ''}

Rules for questions:
- Authentic OPIc wording, as the AI interviewer "Ava" says it. 2–4 sentences. Survey topics may start with "You indicated in the survey that...". Include the typical sub-questions (when, where, who, what happened, why...).
- Natural for this learner's life. Do not repeat these recent questions:
${recent.slice(0, 15).map((q) => `  - ${q}`).join('\n') || '  (none)'}
- ko: faithful Korean translation.

Hint for each question (shown only if the learner asks):
- mp_en: one sample MP (1–2 easy sentences) the learner could actually say, based on their profile.
- mp_ko: Korean meaning of mp_en.
- plan_ko: 3–4 short Korean steps following the structure for this question type.
- expressions: 4 easy, useful expressions for this answer (en + ko).`;
  const { data, model } = await generate({ system: systemPrompt(), parts: [{ text }], schema: QUESTION_SCHEMA, thinking: 'low', temperature: 1, onModel });
  return { questions: data.questions.slice(0, categories.length).map((q, i) => ({ ...q, category: categories[i], topicId })), model };
}

// ---------- 2) 답변 평가 ----------
export const LEVELS = ['NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'];
const CHECK_LABELS = ['질문 의도에 맞는 답', '구조 (시작·MP·디테일·마무리)', '시제 일관성', '필러·연결어', '감정 표현', '자연스러움 (스크립트 티 X)', '분량·시간'];

const EVAL_SCHEMA = obj({
  transcript: S,
  level: enumS(LEVELS),
  level_reason_ko: S,
  summary_ko: S,
  mp: obj({ what: B, feeling: B, why: B, found_en: S, comment_ko: S }),
  checks: arr(obj({ label_ko: S, ok: B, comment_ko: S })),
  sentence_count: I,
  strengths_ko: arr(S),
  improvements_ko: arr(S),
  corrections: arr(obj({ original: S, corrected: S, reason_ko: S })),
  pronunciation: arr(obj({ word: S, tip_ko: S })),
  upgraded: arr(EN_KO),
  expressions: arr(obj({ en: S, ko: S, example_en: S, example_ko: S })),
  next_tip_ko: S,
});

export async function evaluateAnswer({ question, audio, text, durationSec, onModel }) {
  const cat = CATEGORIES[question.category];
  const isAudio = !!audio;
  const dur = durationSec ? `${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, '0')}` : 'unknown';
  const prompt = `Evaluate the learner's OPIc answer.

Question type: ${cat.en}
Question: "${question.q}"
Answer length: ${dur}
Answer input: ${isAudio ? 'the attached audio recording' : `typed or dictated text (no audio, so skip pronunciation): """${text}"""`}

Do this:
1. transcript: ${isAudio ? 'transcribe the audio VERBATIM. Keep fillers (um, uh, like), repetitions, false starts and every grammar mistake exactly as spoken. Do NOT fix anything.' : 'copy the text as is.'}
2. Judge with ACTFL/OPIc criteria (Function, Accuracy, Content/Context, Text type) and the 오픽노잼 structure for this question type. Be honest and realistic, not flattering. Description/habit answers cannot be above IH.
3. level: realistic estimate for THIS answer. level_reason_ko: why, in 1–2 sentences. summary_ko: one-line overall comment.
4. mp: did the answer state What / Feeling / Why early? found_en = the learner's MP sentence(s) quoted (empty if none). comment_ko = how to make the MP clearer. For role-play questions read it as What = clear situation/purpose, Feeling = natural reactions (RRF), Why = reason for calling/asking.
5. checks: exactly these ${CHECK_LABELS.length} items in this order: ${CHECK_LABELS.join(' / ')}. ok=true only if it is good enough for ${state.profile.target}. comment_ko: one short concrete sentence.
6. sentence_count: number of sentences spoken.
7. strengths_ko: 1–3 items. improvements_ko: the 2–3 most important fixes to reach ${state.profile.target}, concrete and actionable.
8. corrections: up to 8 of the most important errors (grammar, wrong word, Konglish, unnatural phrasing). original = exact fragment from the transcript, corrected = natural version, reason_ko = short reason.
9. pronunciation: ${isAudio ? 'up to 5 words that were unclear or had Korean-style pronunciation, with a Korean tip. Empty array if pronunciation was fine.' : 'empty array.'}
10. upgraded: rewrite the answer at ${state.profile.target} level. KEEP the learner's own story, facts and MP — fix and enrich it, do not swap in a different story. 9–11 short spoken sentences, 오픽노잼 structure for this type, easy words, 2–3 natural fillers, consistent tense, none of the AVOID items. One sentence per item with Korean translation.
11. expressions: 3–5 expressions from the upgraded answer that are worth memorizing (with a new example sentence and Korean).
12. next_tip_ko: ONE specific thing to try in the next attempt.`;
  const parts = isAudio ? [{ inlineData: audio }, { text: prompt }] : [{ text: prompt }];
  const { data, model } = await generate({ system: systemPrompt(), parts, schema: EVAL_SCHEMA, thinking: 'low', temperature: 0.4, timeoutMs: 120000, onModel });
  return { ...data, model };
}

// ---------- 3) 새 표현 생성 ----------
const EXPR_SCHEMA = obj({ items: arr(obj({ en: S, ko: S, ex: S, exKo: S })) });

export async function generateExpressions({ topicLabel, count = 10, known = [], onModel }) {
  const text = `Create ${count} useful expressions for OPIc answers about: ${topicLabel}.
- Level: things a ${state.profile.target} learner can actually say — easy words, natural collocations, feeling lines, phrases that help build an MP or a story. Mix single words, phrases and short sentence patterns.
- ex: a first-person example sentence that fits the learner's life (natural spoken English). exKo: its Korean.
- ko: short Korean meaning.
- Do not include these (already known): ${known.slice(0, 150).join(' | ') || '(none)'}`;
  const { data } = await generate({ system: systemPrompt(), parts: [{ text }], schema: EXPR_SCHEMA, thinking: 'low', temperature: 0.9, onModel });
  return data.items;
}

// ---------- 4) 내 문장 다듬기 ----------
const POLISH_SCHEMA = obj({ en: S, ko: S, alternatives: arr(EN_KO), note_ko: S });

export async function polishSentence({ input, onModel }) {
  const text = `The learner wants to say this in an OPIc answer (it may be Korean, English or mixed):
"""${input}"""
Give the most natural spoken English version that the learner can say easily (keep the meaning; fix grammar), its Korean meaning, 2 alternative ways to say it, and note_ko: what changed or a usage tip in 1–2 short sentences.`;
  const { data } = await generate({ system: systemPrompt(), parts: [{ text }], schema: POLISH_SCHEMA, thinking: 'low', temperature: 0.5, onModel });
  return data;
}
