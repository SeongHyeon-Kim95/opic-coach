// 실전 모의고사: 실제 시험처럼 문항마다 피드백 없이 진행하고, 답하는 동안 뒤에서 채점해 끝나면 종합 등급을 보여준다
import { state, save, bump, addHistory, audioGet } from '../store.js';
import { $, esc, icon, uid, today, fmtDur, pick, shuffle, confirmBox, modal, toast } from '../util.js';
import { TOPICS, CATEGORIES, COMBO_PATTERNS, SURPRISE_TOPICS } from '../data/topics.js';
import { practiceTopics, recentQuestions, offlineQuestions } from '../plan.js';
import { generateMockTest, evaluateAnswer, summarizeMock } from '../prompts.js';
import { friendlyError } from '../gemini.js';
import { canRecord, audioForAI } from '../audio.js';
import * as voice from '../aivoice.js';
import { renderFeedback, bindFeedback, areaBars } from '../feedback-view.js';
import { recordingHTML, startRecording, micErrorMessage } from '../recui.js';

const KINDS = {
  full: { ko: '실전 모의고사', n: 15, minutes: 40 },
  mini: { ko: '미니 모의고사', n: 7, minutes: 20 },
};

let M = null;
let el;
let rec = null;
let stopUi = null;
let clock = null;
let unbind = null;

export function mount(root, params) {
  el = root;
  const kind = KINDS[params[0]] ? params[0] : 'full';
  if (!M || M.phase === 'result') M = { kind, phase: 'intro' };
  render();
  return () => {
    clearInterval(clock);
    unbind?.();
    voice.stopAll();
    if (M?.phase === 'recording') { stopUi?.(); rec?.cancel(); M.phase = 'question'; }
    document.body.classList.remove('focus-mode');
  };
}

function render() {
  clearInterval(clock);
  unbind?.();
  unbind = null;
  el.onclick = onClick;
  document.body.classList.toggle('focus-mode', !['intro', 'result'].includes(M.phase));
  ({ intro: renderIntro, loading: renderLoading, question: renderQuestion, recording: renderRecording, stopping: renderRecording,
    answered: renderAnswered, adjust: renderAdjust, grading: renderGrading, result: renderResult })[M.phase]();
  if (M.startedAt && !['intro', 'result', 'grading'].includes(M.phase)) {
    clock = setInterval(() => {
      const c = $('.clock');
      if (!c) return;
      const sec = (Date.now() - M.startedAt) / 1000;
      c.textContent = `${fmtDur(sec)} / ${KINDS[M.kind].minutes}:00`;
      c.style.color = sec > KINDS[M.kind].minutes * 60 ? 'var(--bad)' : '';
    }, 1000);
  }
}

// ---------------- 시작 ----------------
function plan(kind) {
  const survey = shuffle(practiceTopics().filter((t) => !['home', 'neighborhood', 'work'].includes(t)));
  const base = shuffle(['home', 'neighborhood']);
  const a = survey[0] || base[0];
  const b = survey[1] || base[1];
  const c = survey[2] || base[0];
  const surprise = pick(SURPRISE_TOPICS)[0];
  if (kind === 'mini') {
    return [
      { topicId: 'work', categories: ['intro'] },
      { topicId: a, categories: pick(COMBO_PATTERNS) },
      { topicId: b, categories: ['rp11', 'rp12'] },
      { topicId: surprise, categories: ['ihu14'] },
    ];
  }
  return [
    { topicId: 'work', categories: ['intro'] },
    { topicId: a, categories: pick(COMBO_PATTERNS) },
    { topicId: b, categories: pick(COMBO_PATTERNS) },
    { topicId: surprise, categories: pick(COMBO_PATTERNS) },
    { topicId: c, categories: ['rp11', 'rp12', 'rp13'] },
    { topicId: pick([a, surprise]), categories: ['ihu14', 'ihu15'] },
  ];
}

async function start() {
  const kind = M.kind;
  const sets = plan(kind);
  const my = { id: uid(), kind, phase: 'loading', items: [], idx: 0, plays: 0 };
  M = my;
  render();
  let qs;
  try {
    qs = await generateMockTest({ sets, recent: recentQuestions() });
  } catch (e) {
    my.notice = e.code === 'NO_KEY' ? '' : `AI 문제 생성 실패 → 기본 문제로 진행해요 (${friendlyError(e)})`;
    qs = sets.map(() => []);
  }
  if (M !== my) return;
  my.items = sets.flatMap((st, i) => {
    const fallback = offlineQuestions(st.topicId, st.categories);
    return st.categories.map((_, k) => ({ question: qs[i]?.[k] || fallback[k] }));
  });
  my.startedAt = Date.now();
  enterQuestion();
  for (const it of my.items) { // 문제 음성을 순서대로 미리 만든다
    if (M !== my) return;
    await voice.synthesize(it.question.q);
  }
}

function enterQuestion() {
  Object.assign(M, { phase: 'question', plays: 0, voiceLoading: false, showText: false, error: '' });
  render();
  window.scrollTo(0, 0);
  listen();
}

function listen() {
  const set = M;
  const idx = M.idx;
  M.voiceLoading = true;
  if (M.phase === 'question') renderQuestion();
  voice.say(M.items[idx].question.q, {
    onStart: (kind) => {
      if (M !== set || M.idx !== idx) return;
      M.voiceLoading = false;
      if (kind !== 'none') M.plays++;
      if (M.phase === 'question') renderQuestion();
      if (kind !== 'none') $('#ava')?.classList.add('talking');
    },
    onEnd: () => $('#ava')?.classList.remove('talking'),
  });
}

// ---------------- 화면 ----------------
function head() {
  const n = M.items.length;
  return `<div class="mock-head">
      <button class="icon-btn" data-act="quit" aria-label="그만하기">${icon('x')}</button>
      <span class="tag primary">${KINDS[M.kind].ko} ${n ? `${M.idx + 1}/${n}` : ''}</span>
      <span class="clock"></span>
    </div>
    ${n ? `<div class="qdots">${M.items.map((it, i) => `<i class="${i === M.idx ? 'now' : it.skipped ? 'skip' : it.answer ? 'done' : ''}"></i>`).join('')}</div>` : ''}`;
}

function renderIntro() {
  const k = KINDS[M.kind];
  const last = state.mocks[0];
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">모의고사</div><h1 class="title">${k.ko}</h1></div></div>
  <div class="card">
    <p style="margin-top:0"><b>${k.n}문항</b> · 실제 시험처럼 진행해요.</p>
    <ul class="bullets small">
      <li>질문은 <b>귀로만</b> 들어요. 다시 듣기 1번 가능</li>
      <li>문항마다 피드백 없이 바로 다음 문제로 (실제 시험과 동일)</li>
      <li>모르는 질문은 <b>건너뛰기</b> — 5개까지는 AL도 가능</li>
      <li>답하는 동안 AI가 뒤에서 채점해서, 끝나면 바로 <b>최종 예상 등급 + 문항별 피드백</b></li>
      ${M.kind === 'full' ? '<li>구성: 자기소개 → 서베이 콤보 2세트 → 돌발 콤보 → 롤플레이 3문항 → 고난도 2문항</li>' : '<li>구성: 자기소개 → 서베이 콤보 → 롤플레이 2문항 → 고난도 1문항</li>'}
    </ul>
    <p class="small muted" style="margin-bottom:0">조용한 곳에서, 이어폰 끼고 하는 걸 추천해요. 도중에 앱을 나가면 진행이 끊길 수 있어요.</p>
  </div>
  ${!state.settings.apiKey ? `<div class="banner small">${icon('bulb')}<div>API 키가 없어 채점은 안 돼요. <a href="#/welcome">키 설정하기</a></div></div>` : ''}
  <div class="card soft" style="margin-top:12px">
    <div class="eyebrow" style="margin-bottom:6px">시작 전 설정 (실제 시험 화면)</div>
    <p class="small" style="margin:0">Self Assessment 난이도: <b>6단계</b> 선택 · 서베이는 설정 탭에 고른 주제로 출제돼요.</p>
  </div>
  <button class="btn primary block" style="margin-top:18px" data-act="start">${icon('play')} 시작하기</button>
  ${last ? `<p class="small muted center" style="margin-top:12px">지난 모의고사: ${esc(last.date)} · <span class="lv" data-lv="${esc(last.grade)}">${esc(last.grade)}</span> <a href="#" data-act="last">결과 보기</a></p>` : ''}
  ${state.mocks.length > 1 ? `<div class="card tight" style="margin-top:14px">${state.mocks.slice(0, 8).map((x) => `<div class="list-item" data-mock="${x.id}" style="cursor:pointer;align-items:center"><span class="lv" data-lv="${esc(x.grade)}">${esc(x.grade || '—')}</span><div class="grow small">${esc(x.date)} · ${esc(KINDS[x.kind]?.ko || '')}</div>${icon('chevron')}</div>`).join('')}</div>` : ''}`;
}

function renderLoading() {
  el.innerHTML = `${head()}<div class="loading"><div class="spinner"></div><b>시험 문제를 준비하는 중…</b><div class="small muted">서베이 주제로 ${KINDS[M.kind].n}문항을 만들고 있어요 (10~20초)</div></div>`;
}

function renderQuestion() {
  const q = M.items[M.idx].question;
  el.innerHTML = `${head()}
  ${M.notice && M.idx === 0 ? `<div class="banner small">${icon('bulb')}<div>${esc(M.notice)}</div></div>` : ''}
  <div class="card center">
    <div class="ava" id="ava">Ava</div>
    <button class="btn primary" data-act="listen" ${M.plays >= 2 || M.voiceLoading ? 'disabled' : ''}>${M.voiceLoading ? '음성 준비 중…' : `${icon(M.plays ? 'replay' : 'play')} ${M.plays ? `다시 듣기 (${Math.max(0, 2 - M.plays)}회 남음)` : '질문 듣기'}`}</button>
    ${M.showText ? `<div class="q-text en" style="margin-top:14px;text-align:left;font-size:16px">${esc(q.q)}</div>` : `<div style="margin-top:12px"><button class="btn xs ghost" data-act="showtext">${icon('eye')} 글로 보기 (실제 시험엔 없음)</button></div>`}
  </div>
  ${M.error ? `<div class="banner small" style="margin-top:12px">${icon('bulb')}<div>${esc(M.error)}</div></div>` : ''}
  <div class="rec-wrap">
    <button class="rec-btn" data-act="rec" aria-label="녹음 시작" ${canRecord() ? '' : 'disabled'}>${icon('mic')}</button>
    <div class="small muted">답변 녹음 시작</div>
  </div>
  <button class="btn ghost block" data-act="skip">건너뛰기 (스킵 ${M.items.filter((i) => i.skipped).length}/5)</button>`;
}

function renderRecording() {
  el.innerHTML = `${head()}${recordingHTML()}`;
}

function renderAnswered() {
  const it = M.items[M.idx];
  const last = M.idx >= M.items.length - 1;
  el.innerHTML = `${head()}
  <div class="loading" style="padding-top:36px">
    <div class="step-num done" style="width:56px;height:56px;border-radius:18px">${icon('check')}</div>
    <b>${it.skipped ? '건너뛰었어요' : `답변 저장됨 · ${fmtDur(it.durationSec)}`}</b>
    <div class="small muted">${it.skipped ? '실제 시험에서도 5개까지는 괜찮아요.' : 'AI가 뒤에서 채점하고 있어요. 다음 문제에 집중하세요.'}</div>
  </div>
  <button class="btn primary block" data-act="next">${last ? '시험 끝내기' : '다음 문제'} ${icon('chevron')}</button>`;
}

function renderAdjust() {
  el.innerHTML = `${head()}
  <div class="card">
    <div class="eyebrow">난이도 재조정 (실제 시험 10번 뒤)</div>
    <p style="font-weight:700">남은 문제의 난이도를 고르세요.</p>
    <div class="stack">
      <button class="btn block" data-adj="easy">쉬운 질문</button>
      <button class="btn block primary" data-adj="same">비슷한 질문</button>
      <button class="btn block" data-adj="hard">어려운 질문</button>
    </div>
    <p class="small muted" style="margin-bottom:0">오픽노잼 팁: <b>"비슷한 질문"</b>을 골라 6-6을 유지하세요. 어려운 질문은 부담만 커지고, 쉬운 질문은 AL 기회를 줄여요.</p>
  </div>`;
}

function renderGrading() {
  const answered = M.items.filter((i) => i.answer);
  const done = answered.filter((i) => i.feedback || i.evalError).length;
  el.innerHTML = `
  <div class="loading" style="padding-top:60px">
    <div class="spinner"></div>
    <b>${M.summarizing ? '최종 등급을 매기는 중…' : `채점 중 ${done}/${answered.length}`}</b>
    <div class="bar" style="width:220px"><i style="width:${answered.length ? Math.round((done / answered.length) * 100) : 100}%"></i></div>
    <div class="small muted">문항별 피드백을 모아 실제 채점자처럼 종합 판단해요</div>
  </div>
  ${M.error ? `<div class="banner small">${icon('bulb')}<div>${esc(M.error)}</div></div><button class="btn primary block" data-act="regrade">다시 시도</button>` : ''}`;
}

function renderResult() {
  const r = M.result;
  const s = r.summary;
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">${esc(r.date)} · ${esc(KINDS[r.kind].ko)}</div><h1 class="title">모의고사 결과</h1></div></div>
  ${s ? `
  <div class="card grade-hero">
    <div class="eyebrow">예상 최종 등급</div>
    <div style="margin:10px 0"><span class="lv big" data-lv="${esc(s.grade)}">${esc(s.grade)}</span></div>
    <div style="font-weight:700">${esc(s.one_line_ko)}</div>
    <p class="small muted" style="text-align:left">${esc(s.grade_reason_ko)}</p>
    <div style="text-align:left;margin-top:8px">${areaBars(s.scores)}</div>
  </div>
  <h2 class="sec">강점 · 약점</h2>
  <div class="card">
    <ul class="bullets">${s.strengths_ko.map((x) => `<li>👍 ${esc(x)}</li>`).join('')}${s.weaknesses_ko.map((x) => `<li>🎯 ${esc(x)}</li>`).join('')}</ul>
  </div>
  <h2 class="sec">다음 주 계획</h2>
  <div class="card"><ol style="margin:0;padding-left:20px">${s.plan_ko.map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ol></div>`
  : `<div class="banner small">${icon('bulb')}<div>종합 등급을 만들지 못했어요 (${esc(r.error || 'API 키 없음')}). 문항별 결과는 아래에서 볼 수 있어요.</div></div>`}

  <h2 class="sec">문항별 결과 <span class="sub">눌러서 자세히</span></h2>
  <div class="card tight">
    ${r.items.map((x, i) => `<div class="list-item" ${x.historyId ? `data-hist="${x.historyId}" style="cursor:pointer"` : ''}>
      <span class="lv" data-lv="${esc(x.level || '')}">${x.skipped ? '스킵' : esc(x.level || '—')}</span>
      <div class="grow"><div class="row wrap" style="gap:6px"><b class="small">Q${i + 1}</b><span class="tag accent">${esc(CATEGORIES[x.category].ko)}</span>
        ${x.durationSec ? `<span class="tiny muted">${fmtDur(x.durationSec)}</span>` : ''}</div>
        <div class="small en" style="margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(x.q)}</div></div>
    </div>`).join('')}
  </div>
  <div class="btn-row" style="margin-top:18px"><a class="btn" href="#/home">홈으로</a><button class="btn primary" data-act="again">다시 응시</button></div>`;
}

// ---------------- 진행 ----------------
async function startRec() {
  voice.stopAll();
  M.phase = 'recording';
  M.error = '';
  render();
  try {
    ({ rec, stopUi } = await startRecording(el, { onLimit: stopRec }));
  } catch (e) {
    if (M?.phase !== 'recording') return;
    M.phase = 'question';
    M.error = micErrorMessage(e);
    return render();
  }
  if (M?.phase !== 'recording') { stopUi(); rec.cancel(); }
}

async function stopRec() {
  stopUi?.();
  if (M?.phase !== 'recording') return;
  M.phase = 'stopping';
  const { blob, duration } = await rec.stop();
  const it = M.items[M.idx];
  if (duration < 2 || blob.size < 800) {
    M.phase = 'question';
    M.error = '녹음이 너무 짧아요. 다시 녹음하거나 건너뛰세요.';
    return render();
  }
  it.answer = { blob };
  it.durationSec = duration;
  bump('speak');
  queueEval(it);
  M.phase = 'answered';
  render();
}

// 채점은 동시에 2개까지만 (무료 한도 보호)
let running = 0;
const waiting = [];
function queueEval(it) {
  it.evalPromise = new Promise((resolve) => waiting.push({ it, resolve }));
  pump();
}
function pump() {
  while (running < 2 && waiting.length) {
    const { it, resolve } = waiting.shift();
    running++;
    evalOne(it).finally(() => { running--; resolve(); pump(); });
  }
}
async function evalOne(it, tries = 2) {
  const set = M;
  for (let t = 0; t < tries; t++) {
    try {
      it.feedback = await evaluateAnswer({ question: it.question, audio: await audioForAI(it.answer.blob), durationSec: it.durationSec });
      it.evalError = null;
      break;
    } catch (e) {
      it.evalError = friendlyError(e);
      if (e.code === 'NO_KEY' || e.code === 'BAD_KEY') break;
    }
  }
  const entry = { id: uid(), ts: Date.now(), date: today(), mode: 'mock', mockId: set.id, topicId: it.question.topicId, question: it.question, durationSec: it.durationSec, inputType: 'audio', text: '', feedback: it.feedback || null };
  it.historyId = entry.id;
  await addHistory(entry, it.answer.blob);
  if (M === set && M.phase === 'grading') renderGrading();
}

function next() {
  voice.stopAll();
  if (M.idx >= M.items.length - 1) return finish();
  M.idx++;
  if (M.kind === 'full' && M.idx === 10 && !M.adjusted) {
    M.adjusted = true;
    M.phase = 'adjust';
    return render();
  }
  enterQuestion();
}

async function finish() {
  const set = M;
  set.phase = 'grading';
  set.error = '';
  render();
  await Promise.all(set.items.filter((i) => i.evalPromise).map((i) => i.evalPromise));
  if (M !== set) return;
  let summary = null;
  let error = '';
  if (state.settings.apiKey && set.items.some((i) => i.feedback)) {
    set.summarizing = true;
    renderGrading();
    try {
      summary = await summarizeMock({ items: set.items.map((i) => ({ question: i.question, skipped: i.skipped, feedback: i.feedback, durationSec: i.durationSec })) });
    } catch (e) {
      error = friendlyError(e);
    }
    set.summarizing = false;
  } else {
    error = state.settings.apiKey ? '채점된 답변이 없어요' : 'API 키 없음';
  }
  if (M !== set) return;
  const result = {
    id: set.id, date: today(), kind: set.kind, grade: summary?.grade || '', summary, error,
    items: set.items.map((i) => ({ q: i.question.q, category: i.question.category, skipped: !!i.skipped, level: i.feedback?.level || '', durationSec: i.durationSec || null, historyId: i.historyId || null })),
  };
  state.mocks.unshift(result);
  save('mocks');
  M = { kind: set.kind, phase: 'result', result };
  render();
  window.scrollTo(0, 0);
}

async function openItem(historyId) {
  const h = state.history.find((x) => x.id === historyId);
  if (!h) return toast('기록을 찾을 수 없어요');
  let url = null;
  modal({
    title: `${CATEGORIES[h.question.category].ko}`,
    body: `<div class="card tight soft"><div class="small en">${esc(h.question.q)}</div>${h.question.ko ? `<div class="ko small">${esc(h.question.ko)}</div>` : ''}</div>
      <div id="mi-audio" style="margin-top:10px"></div>
      ${h.feedback ? `<div id="mi-fb" style="margin-top:10px">${renderFeedback(h.feedback, { durationSec: h.durationSec, inputType: 'audio' })}</div>` : '<p class="small muted">채점하지 못한 답변이에요.</p>'}`,
    actions: [{ label: '닫기' }],
    onClose: () => { if (url) URL.revokeObjectURL(url); voice.stopAll(); },
    onMount: async (m) => {
      if (h.feedback) bindFeedback($('#mi-fb', m), h.feedback, { topicId: h.topicId, question: h.question });
      const blob = h.audioId && await audioGet(h.audioId).catch(() => null);
      if (blob) {
        url = URL.createObjectURL(blob);
        $('#mi-audio', m).innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
      }
    },
  });
}

async function onClick(e) {
  const t = e.target.closest('[data-act],[data-adj],[data-hist],[data-mock]');
  if (!t) return;
  const d = t.dataset;
  if (d.hist) return openItem(d.hist);
  if (d.mock) {
    const r = state.mocks.find((x) => x.id === d.mock);
    M = { kind: r.kind, phase: 'result', result: r };
    return render();
  }
  if (d.adj) {
    if (d.adj !== 'same') toast(d.adj === 'easy' ? '쉬운 질문은 AL 기회가 줄어요. 실전에선 "비슷한 질문"!' : '어려운 질문은 부담만 커져요. 실전에선 "비슷한 질문"!', 3000);
    return enterQuestion();
  }
  switch (d.act) {
    case 'start': return start();
    case 'last': e.preventDefault(); M = { kind: state.mocks[0].kind, phase: 'result', result: state.mocks[0] }; return render();
    case 'listen': return listen();
    case 'showtext': M.showText = true; return renderQuestion();
    case 'rec': return startRec();
    case 'stop': return stopRec();
    case 'skip':
      if (M.items.filter((i) => i.skipped).length >= 5 && !(await confirmBox('스킵이 6개 이상이면 AL은 어려워요. 그래도 건너뛸까요?', '건너뛰기'))) return;
      M.items[M.idx].skipped = true;
      M.phase = 'answered';
      return render();
    case 'next': return next();
    case 'regrade': return finish();
    case 'again': M = { kind: M.result.kind, phase: 'intro' }; return render();
    case 'quit': {
      if (!(await confirmBox('모의고사를 그만할까요? 지금까지 답한 문항은 답변 기록에 남아요.', '그만하기', 'danger'))) return;
      stopUi?.();
      rec?.cancel();
      voice.stopAll();
      M = { kind: M.kind, phase: 'intro' };
      return render();
    }
  }
}
