import { state, bump, addHistory, streak } from '../store.js';
import { $, esc, icon, uid, today, fmtDur, pick, confirmBox } from '../util.js';
import { TOPICS, CATEGORIES, MODES, COMBO_PATTERNS, SURPRISE_TOPICS } from '../data/topics.js';
import { todayTopic, randomSurprise, practiceTopics, recentQuestions, offlineQuestions } from '../plan.js';
import { generateQuestions, evaluateAnswer } from '../prompts.js';
import { friendlyError } from '../gemini.js';
import { Recorder, canRecord, toWav16k, blobToBase64 } from '../audio.js';
import * as tts from '../tts.js';
import { renderFeedback, bindFeedback } from '../feedback-view.js';

const MAX_SEC = 180;
const SINGLE_CATS = ['random', 'desc', 'habit', 'past', 'comp', 'rp11', 'rp12', 'rp13', 'ihu14', 'ihu15', 'intro'];
const TIPS = [
  'MP = What + Feeling + Why. 첫 25초 안에!',
  '과거경험은 클라이맥스부터 말하고 과거시제를 끝까지 유지해요.',
  '비교 질문의 MP는 현재만. 과거 얘기는 그 다음에.',
  'Moreover, Furthermore 대신 And so, You know what? 처럼 말해요.',
  '"That\'s all."로 끝내지 말고 "So yeah, that\'s pretty much it."',
  '짧은 문장 + 감정 반복(SRR)만으로도 IH 가능해요.',
  '99/1 전략: 좋은 점 99%, 아쉬운 점 1% 살짝, 다시 좋은 점으로.',
];

let S = null; // 진행 중인 세트
const setup = { mode: 'combo', topicId: '', category: 'random' };
let el;
let timers = [];
let rec = null;
let unbindFb = null;

export function mount(root, params) {
  el = root;
  if (S?.phase === 'done') S = null;
  if (params[0] === 'today') {
    history.replaceState(null, '', '#/speak');
    if (!S) {
      start({ mode: 'combo', topicId: todayTopic() });
      return cleanup;
    }
  }
  render();
  return cleanup;
}

function cleanup() {
  clearTimers();
  tts.stop();
  unbindFb?.();
  unbindFb = null;
  if (S?.phase === 'recording') {
    rec?.cancel();
    S.phase = 'question';
  }
  document.body.classList.remove('focus-mode');
}

const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
const cur = () => S.items[S.idx];
const hasKey = () => !!state.settings.apiKey;
const zone = (t) => (t < 50 ? 'short' : t <= 100 ? 'good' : t <= 120 ? 'long' : 'over');
const ZONE_MSG = {
  short: '조금 짧아요. IH는 1분~1분 30초(약 10문장)가 적당해요.',
  good: '좋은 길이예요!',
  long: '살짝 길어요. MP 위주로 다듬으면 더 좋아요.',
  over: '2분이 넘으면 감점될 수 있어요. 핵심만 남겨 보세요.',
};

function render() {
  clearTimers();
  unbindFb?.();
  unbindFb = null;
  document.body.classList.toggle('focus-mode', !!S && S.phase !== 'done');
  el.onclick = onClick;
  if (!S) return renderSetup();
  ({
    loading: renderLoading, question: renderQuestion, recording: renderRecording, stopping: renderRecording, recorded: renderRecorded,
    typing: renderTyping, evaluating: renderEvaluating, feedback: renderFeedbackView, done: renderDone,
  })[S.phase]();
}

// ---------------- 설정 화면 ----------------
function renderSetup() {
  const todays = TOPICS[todayTopic()];
  const topics = setup.mode === 'surprise' ? SURPRISE_TOPICS.map((t) => t[0]) : practiceTopics();
  if (setup.topicId && !topics.includes(setup.topicId)) setup.topicId = '';
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">말하기 연습</div><h1 class="title">무엇을 연습할까요?</h1></div></div>
  <button class="card primary link" data-act="today" style="width:100%;text-align:left;font:inherit">
    ${icon('mic')}<div class="grow"><b>오늘의 콤보 바로 시작</b><div class="small muted">${esc(todays.ko)} · 3문항 · 실전 순서</div></div>${icon('chevron')}
  </button>

  <h2 class="sec">연습 방식</h2>
  <div class="chips">${Object.entries(MODES).map(([k, m]) => `<button class="chip ${setup.mode === k ? 'on' : ''}" data-mode="${k}">${m.ko}</button>`).join('')}</div>
  <p class="small muted" style="margin:8px 2px 0">${MODES[setup.mode].desc}</p>

  ${setup.mode === 'single' ? `<h2 class="sec">질문 유형</h2>
  <div class="chips">${SINGLE_CATS.map((c) => `<button class="chip ${setup.category === c ? 'on' : ''}" data-cat="${c}">${c === 'random' ? '🎲 랜덤' : CATEGORIES[c].ko}</button>`).join('')}</div>` : ''}

  ${setup.mode === 'single' && setup.category === 'intro' ? '' : `<h2 class="sec">주제</h2>
  <div class="chips">
    <button class="chip ${!setup.topicId ? 'on' : ''}" data-topic="">🎲 ${setup.mode === 'surprise' ? '랜덤 돌발' : '오늘의 주제'}</button>
    ${topics.map((id) => `<button class="chip ${setup.topicId === id ? 'on' : ''}" data-topic="${id}">${esc(TOPICS[id].ko)}</button>`).join('')}
  </div>`}

  <button class="btn primary block" style="margin-top:26px" data-act="start">${icon('sparkle')} 질문 받기</button>
  ${hasKey() ? '' : `<p class="small muted center" style="margin-top:10px">API 키가 없으면 기본 질문으로 녹음 연습만 할 수 있어요. <a href="#/settings">키 설정하기</a></p>`}`;
}

async function start({ mode, topicId, category = 'random' }) {
  let cats;
  if (mode === 'combo' || mode === 'surprise') cats = pick(COMBO_PATTERNS);
  else if (mode === 'roleplay') cats = ['rp11', 'rp12', 'rp13'];
  else if (mode === 'hard') cats = ['ihu14', 'ihu15'];
  else cats = [category === 'random' ? pick(['desc', 'habit', 'past', 'comp']) : category];
  topicId ||= mode === 'surprise' ? randomSurprise() : todayTopic();
  if (cats[0] === 'intro') topicId = 'work';
  const my = { id: uid(), mode, topicId, cats, items: [], idx: 0, phase: 'loading', model: '' };
  S = my;
  render();
  try {
    const { questions } = await generateQuestions({
      topicId, categories: cats, recent: recentQuestions(),
      onModel: (m) => { my.model = m; const l = $('#model-line'); if (l) l.textContent = `AI 모델: ${m}`; },
    });
    my.items = questions.map((q) => ({ question: q }));
  } catch (e) {
    my.items = offlineQuestions(topicId, cats).map((q) => ({ question: q }));
    my.notice = e.code === 'NO_KEY' ? 'API 키가 없어 기본 질문으로 진행해요. 녹음 후 스스로 체크해 보세요.' : `AI 질문 생성 실패 → 기본 질문으로 진행해요. (${friendlyError(e)})`;
  }
  if (S !== my) return;
  enterQuestion();
}

function enterQuestion(retry = false) {
  Object.assign(S, { phase: 'question', played: 0, showText: retry || !state.settings.examMode, error: '' });
  render();
  window.scrollTo(0, 0);
  if (!retry && (navigator.userActivation?.hasBeenActive ?? true)) listen();
}

function topBar() {
  const it = S.items[S.idx];
  const cat = it ? CATEGORIES[it.question.category] : null;
  const n = S.items.length || S.cats.length;
  return `<div class="q-top">
    <button class="icon-btn" data-act="quit" aria-label="그만하기">${icon('x')}</button>
    <span class="tag primary">${esc(MODES[S.mode].ko)}${n > 1 ? ` ${S.idx + 1}/${n}` : ''}</span>
    ${cat?.ko === '자기소개' ? '' : `<span class="tag">${esc(TOPICS[S.topicId].ko)}</span>`}
    ${cat ? `<span class="tag accent">${esc(cat.ko)}</span>` : ''}
  </div>`;
}

function renderLoading() {
  el.innerHTML = `${topBar()}
  <div class="loading"><div class="spinner"></div>
    <b>${esc(TOPICS[S.topicId].ko)} 질문을 만드는 중…</b>
    <div class="small muted">${esc(pick(TIPS))}</div>
    <div class="tiny muted" id="model-line">${S.model ? `AI 모델: ${esc(S.model)}` : ''}</div></div>`;
}

// ---------------- 질문 ----------------
function hintBox(h) {
  return `<details class="card hint-box">
    <summary>${icon('bulb')} 막막하면 힌트 보기</summary>
    <div class="eyebrow">MP 예시</div>
    <div class="row" style="align-items:flex-start"><p class="en grow" style="font-weight:600">${esc(h.mp_en)}</p>
      <button class="icon-btn" data-say="${esc(h.mp_en)}" aria-label="듣기">${icon('volume')}</button></div>
    <p class="ko">${esc(h.mp_ko)}</p>
    <div class="eyebrow" style="margin-top:12px">답변 순서</div>
    <ol>${(h.plan_ko || []).map((s) => `<li class="small">${esc(s)}</li>`).join('')}</ol>
    <div class="eyebrow" style="margin-top:12px">쓸 만한 표현</div>
    ${(h.expressions || []).map((x) => `<div class="row" style="padding:4px 0"><div class="grow"><span class="en" style="font-weight:600">${esc(x.en)}</span> <span class="ko">${esc(x.ko)}</span></div>
      <button class="icon-btn" data-say="${esc(x.en)}" aria-label="듣기">${icon('volume')}</button></div>`).join('')}
  </details>`;
}

function renderQuestion() {
  const q = cur().question;
  const exam = state.settings.examMode;
  const left = exam ? Math.max(0, 2 - S.played) : 9;
  el.innerHTML = `${topBar()}
  ${S.notice && S.idx === 0 ? `<div class="banner small">${icon('bulb')}<div>${esc(S.notice)}</div></div>` : ''}
  <div class="card center">
    <div class="ava" id="ava">Ava</div>
    <button class="btn primary" data-act="listen" ${left ? '' : 'disabled'}>
      ${icon(S.played ? 'replay' : 'play')} ${S.played ? (exam ? `다시 듣기 (${left}회 남음)` : '다시 듣기') : '질문 듣기'}
    </button>
    <div class="blur-box ${S.showText ? '' : 'blurred'}" style="margin-top:16px;text-align:left">
      <div class="q-text en">${esc(q.q)}${q.ko ? `<span class="ko">${esc(q.ko)}</span>` : ''}</div>
      <div class="reveal"><button class="btn sm" data-act="showtext">${icon('eye')} 질문 글로 보기</button></div>
    </div>
  </div>
  ${q.hint ? hintBox(q.hint) : ''}
  ${S.error ? `<div class="banner small" style="margin-top:12px">${icon('bulb')}<div>${esc(S.error)}</div></div>` : ''}
  <div class="rec-wrap">
    <button class="rec-btn" data-act="rec" aria-label="녹음 시작" ${canRecord() ? '' : 'disabled'}>${icon('mic')}</button>
    <div class="small muted">${canRecord() ? '누르면 녹음 시작 · 목표 1:00~1:30' : '이 브라우저는 녹음을 지원하지 않아요. 텍스트로 답해 주세요.'}</div>
  </div>
  <button class="btn ghost block" data-act="type">${icon('keyboard')} 텍스트(음성 입력)로 답하기</button>`;
}

function listen() {
  const q = cur().question;
  S.played++;
  if (S.phase === 'question') renderQuestion();
  $('#ava')?.classList.add('talking');
  tts.speak(q.q, { onEnd: () => $('#ava')?.classList.remove('talking') });
}

// ---------------- 녹음 ----------------
async function startRec() {
  tts.stop();
  rec = new Recorder();
  S.phase = 'recording';
  S.error = '';
  render();
  const bars = [...el.querySelectorAll('.meter i')];
  try {
    await rec.start((lv) => bars.forEach((b, i) => {
      b.style.height = `${6 + lv * 30 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + performance.now() / 160)))}px`;
    }));
  } catch (e) {
    rec.cleanup();
    if (S?.phase !== 'recording') return;
    S.phase = 'question';
    S.error = e.name === 'NotAllowedError' ? '마이크 권한이 필요해요. 브라우저(사이트) 설정에서 마이크를 허용해 주세요.' : `녹음을 시작할 수 없어요: ${e.message}`;
    return render();
  }
  if (S?.phase !== 'recording') return rec.cancel();
  const timerEl = $('#timer');
  const fill = $('.zone-bar .fill');
  timers.push(setInterval(() => {
    const t = rec.elapsed();
    timerEl.textContent = fmtDur(t);
    timerEl.dataset.zone = zone(t);
    fill.style.width = `${Math.min(100, (t / MAX_SEC) * 100)}%`;
    if (t >= MAX_SEC) stopRec();
  }, 200));
}

function renderRecording() {
  const q = cur().question;
  el.innerHTML = `${topBar()}
  ${S.showText ? `<div class="card tight"><div class="small en">${esc(q.q)}</div></div>` : ''}
  <div class="rec-wrap" style="margin-top:34px">
    <div class="eyebrow" style="color:var(--accent)">● 녹음 중</div>
    <div class="timer" id="timer" data-zone="short">0:00</div>
    <div class="zone-bar"><div class="zone"></div><div class="fill"></div></div>
    <div class="zone-legend"><span>0:00</span><span style="margin-left:18%">1:00~1:30 목표</span><span>3:00</span></div>
    <div class="meter">${'<i></i>'.repeat(14)}</div>
    <button class="rec-btn stop" data-act="stop" aria-label="녹음 끝내기">${icon('stop')}</button>
    <div class="small muted">다 말했으면 눌러서 끝내기</div>
  </div>
  <button class="btn ghost block" data-act="cancelrec">취소</button>`;
}

async function stopRec() {
  clearTimers();
  if (S?.phase !== 'recording') return;
  S.phase = 'stopping';
  const { blob, duration } = await rec.stop();
  const it = cur();
  if (duration < 2 || blob.size < 800) {
    S.phase = 'question';
    S.error = '녹음이 너무 짧아요. 다시 시도해 주세요.';
    return render();
  }
  if (it.answer?.url) URL.revokeObjectURL(it.answer.url);
  it.answer = { type: 'audio', blob, url: URL.createObjectURL(blob), duration };
  S.phase = 'recorded';
  render();
}

function selfCheck() {
  const items = ['첫 25초 안에 MP(What·Feeling·Why)를 말했다', '시제를 끝까지 지켰다 (과거경험은 과거형)', '감정 표현을 2번 이상 넣었다', '마무리 문장으로 깔끔하게 끝냈다', '10문장 정도, 1분~1분 30초'];
  return `<div class="card"><div class="eyebrow" style="margin-bottom:6px">스스로 체크</div>
    ${items.map((t) => `<label class="switch small"><span>${t}</span><input type="checkbox"></label>`).join('')}</div>`;
}

function renderRecorded() {
  const a = cur().answer;
  el.innerHTML = `${topBar()}
  <div class="card center">
    <div class="eyebrow">내 답변</div>
    <div class="timer" data-zone="${zone(a.duration)}" style="margin:8px 0 14px">${fmtDur(a.duration)}</div>
    <audio controls src="${a.url}" style="width:100%"></audio>
    <p class="small muted">${ZONE_MSG[zone(a.duration)]}</p>
  </div>
  ${S.error ? `<div class="banner small" style="margin-top:12px">${icon('bulb')}<div>${esc(S.error)}</div></div>` : ''}
  ${hasKey()
    ? `<div class="btn-row" style="margin-top:16px"><button class="btn" data-act="rerec">${icon('replay')} 다시 녹음</button>
       <button class="btn primary" data-act="eval">${icon('sparkle')} AI 피드백 받기</button></div>`
    : `<div style="margin-top:12px">${selfCheck()}</div>
       <div class="btn-row" style="margin-top:16px"><button class="btn" data-act="rerec">다시 녹음</button>
       <button class="btn primary" data-act="savenext">저장하고 다음</button></div>`}`;
}

function renderTyping() {
  const q = cur().question;
  el.innerHTML = `${topBar()}
  <div class="card tight"><div class="small en">${esc(q.q)}</div>${q.ko ? `<div class="ko small">${esc(q.ko)}</div>` : ''}</div>
  <label class="field"><span>내 답변 (영어)</span>
    <textarea id="ans" rows="9" placeholder="영어로 입력하세요. 키보드의 🎤 음성 입력으로 말해서 받아써도 돼요.">${esc(cur().answer?.text || '')}</textarea></label>
  ${S.error ? `<div class="banner small" style="margin-top:12px">${icon('bulb')}<div>${esc(S.error)}</div></div>` : ''}
  <div class="btn-row" style="margin-top:16px"><button class="btn" data-act="back">취소</button>
    <button class="btn primary" data-act="evaltext">${icon('sparkle')} ${hasKey() ? '피드백 받기' : '저장하고 다음'}</button></div>`;
}

// ---------------- 평가 ----------------
function renderEvaluating() {
  el.innerHTML = `${topBar()}
  <div class="loading"><div class="spinner"></div>
    <b>AI 코치가 답변을 듣고 있어요…</b>
    <div class="small muted" id="tip">${esc(pick(TIPS))}</div>
    <div class="tiny muted" id="model-line"></div></div>`;
  timers.push(setInterval(() => { const t = $('#tip'); if (t) t.textContent = pick(TIPS); }, 4000));
}

async function evaluate() {
  const my = S;
  const it = cur();
  S.phase = 'evaluating';
  S.error = '';
  render();
  try {
    let audio = null;
    if (it.answer.type === 'audio') {
      try {
        const wav = await toWav16k(it.answer.blob);
        audio = { mimeType: 'audio/wav', data: await blobToBase64(wav.blob) };
      } catch {
        audio = { mimeType: it.answer.blob.type.split(';')[0] || 'audio/webm', data: await blobToBase64(it.answer.blob) };
      }
    }
    const fb = await evaluateAnswer({
      question: it.question, audio, text: it.answer.text, durationSec: it.answer.duration,
      onModel: (m) => { const l = $('#model-line'); if (l) l.textContent = `AI 모델: ${m}`; },
    });
    if (S !== my) return;
    it.feedback = fb;
    await saveAttempt(it);
    S.phase = 'feedback';
  } catch (e) {
    if (S !== my) return;
    S.phase = it.answer.type === 'audio' ? 'recorded' : 'typing';
    S.error = friendlyError(e);
  }
  render();
  window.scrollTo(0, 0);
}

async function saveAttempt(it) {
  bump('speak');
  await addHistory({
    id: uid(), ts: Date.now(), date: today(), mode: S.mode, topicId: S.topicId, question: it.question,
    durationSec: it.answer.duration || null, inputType: it.answer.type, text: it.answer.text || '', feedback: it.feedback || null,
  }, it.answer.type === 'audio' ? it.answer.blob : null);
}

function renderFeedbackView() {
  const it = cur();
  const last = S.idx >= S.items.length - 1;
  el.innerHTML = `${topBar()}
  <div class="card tight soft"><div class="small en">${esc(it.question.q)}</div></div>
  <div id="fb" style="margin-top:12px">${renderFeedback(it.feedback, { durationSec: it.answer.duration, inputType: it.answer.type })}</div>
  <div class="btn-row" style="margin-top:20px">
    <button class="btn" data-act="retry">${icon('replay')} 같은 질문 다시</button>
    <button class="btn primary" data-act="next">${last ? '세트 완료' : '다음 질문'} ${icon('chevron')}</button>
  </div>`;
  unbindFb = bindFeedback($('#fb'), it.feedback, { topicId: S.topicId, question: it.question });
}

function next() {
  tts.stop();
  if (S.idx >= S.items.length - 1) {
    S.phase = 'done';
    render();
    return window.scrollTo(0, 0);
  }
  S.idx++;
  enterQuestion();
}

function renderDone() {
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">세트 완료</div><h1 class="title">수고했어요! 🎉</h1></div>
    <span class="streak">${icon('fire')} ${streak()}일</span></div>
  <div class="card tight">
    ${S.items.map((it) => `<div class="list-item">
      <span class="lv" data-lv="${esc(it.feedback?.level || '')}">${esc(it.feedback?.level || '—')}</span>
      <div class="grow"><span class="tag accent">${esc(CATEGORIES[it.question.category].ko)}</span>
        <div class="small en" style="margin-top:4px">${esc(it.question.q)}</div></div></div>`).join('')}
  </div>
  <p class="small muted" style="margin:14px 2px">저장한 문장은 <a href="#/notes">노트</a>에서, 추가한 표현은 <a href="#/review">단어 카드</a>에서 복습할 수 있어요.</p>
  <div class="btn-row"><a class="btn" href="#/home">홈으로</a><button class="btn primary" data-act="again">한 세트 더</button></div>`;
}

// ---------------- 이벤트 ----------------
async function onClick(e) {
  const say = e.target.closest('[data-say]');
  if (say) return tts.speak(say.dataset.say);
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (!S) {
    if (d.mode) { setup.mode = d.mode; return renderSetup(); }
    if (d.topic !== undefined) { setup.topicId = d.topic; return renderSetup(); }
    if (d.cat) { setup.category = d.cat; return renderSetup(); }
    if (d.act === 'today') return start({ mode: 'combo', topicId: todayTopic() });
    if (d.act === 'start') return start({ ...setup });
    return;
  }
  switch (d.act) {
    case 'quit': {
      const unsaved = ['recording', 'recorded', 'typing', 'evaluating'].includes(S.phase);
      if (unsaved && !(await confirmBox('지금 답변은 저장되지 않아요. 그만할까요?', '그만하기', 'danger'))) return;
      rec?.cancel();
      tts.stop();
      S = null;
      return render();
    }
    case 'listen': return listen();
    case 'showtext': S.showText = true; return renderQuestion();
    case 'rec': return startRec();
    case 'stop': return stopRec();
    case 'cancelrec': rec?.cancel(); S.phase = 'question'; return render();
    case 'rerec': return startRec();
    case 'type': tts.stop(); S.phase = 'typing'; S.error = ''; return render();
    case 'back': S.phase = 'question'; S.error = ''; return render();
    case 'eval': return evaluate();
    case 'evaltext': {
      const text = $('#ans').value.trim();
      if (text.split(/\s+/).length < 5) { S.error = '조금 더 길게 써 주세요 (최소 5단어).'; return renderTyping(); }
      cur().answer = { type: 'text', text, duration: null };
      if (hasKey()) return evaluate();
      await saveAttempt(cur());
      return next();
    }
    case 'savenext': await saveAttempt(cur()); return next();
    case 'retry': cur().answer = null; cur().feedback = null; return enterQuestion(true);
    case 'next': return next();
    case 'again': {
      const mode = S.mode;
      const others = practiceTopics().filter((t) => t !== S.topicId);
      S = null;
      return start({ mode, topicId: mode === 'surprise' ? '' : pick(others) });
    }
  }
}
