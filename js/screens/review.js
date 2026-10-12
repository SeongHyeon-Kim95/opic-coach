import { state, save, newCard } from '../store.js';
import { $, esc, icon, toast, confirmBox, modal, uid, today } from '../util.js';
import { TOPICS, SEED_TOPIC_LABELS } from '../data/topics.js';
import { buildSession, deckStats, newRemainingToday, GRADES, nextInterval, intervalLabel, grade } from '../srs.js';
import { practiceTopics } from '../plan.js';
import { generateExpressions, checkMySentence } from '../prompts.js';
import { friendlyError } from '../gemini.js';
import * as voice from '../aivoice.js';

let el;
let R = null; // 진행 중인 복습 { queue, idx, revealed, count, finished }
const gen = { topic: '', count: 10, loading: false, items: null, error: '' };
let query = '';

// AI 표현 생성에서 고를 수 있는 주제: 공통 표현 + 내 서베이 주제
const GEN_SPECIAL = [
  ['@feeling', '감정 표현 (Feeling)', 'feeling'],
  ['@starter', '답변 시작·연결·마무리', 'starter'],
  ['@past', '과거경험 스토리 표현', 'cat_past'],
  ['@comp', '비교 (과거 vs 현재)', 'cat_comp'],
  ['@roleplay', '롤플레이 질문·대안 제시', 'roleplay'],
];

export function mount(root, params) {
  el = root;
  if (R?.finished) R = null;
  if (params[0] === 'start') {
    history.replaceState(null, '', '#/review');
    if (!R) startSession({});
  }
  if (params[0] === 'topic' && params[1]) {
    history.replaceState(null, '', '#/review');
    R = null;
    startSession({ topic: params[1] });
  }
  render();
  return () => {
    voice.stopAll();
    document.body.classList.remove('focus-mode');
  };
}

function render() {
  document.body.classList.toggle('focus-mode', !!R && !R.finished);
  el.onclick = onClick;
  el.oninput = onInput;
  if (!R) return renderOverview();
  if (R.finished) return renderFinished();
  renderCard();
}

function startSession(opts) {
  const queue = buildSession(opts);
  if (!queue.length) {
    toast(opts.topic ? '이 주제는 오늘 공부할 카드가 없어요' : '오늘 복습할 카드가 없어요. 새 카드를 더 해볼까요?');
    return false;
  }
  R = { queue, idx: 0, revealed: false, count: 0, finished: false, opts };
  return true;
}

// ---------------- 개요 ----------------
function topicRows() {
  const by = {};
  for (const c of state.cards) {
    const b = (by[c.t] ||= { total: 0, fresh: 0, learned: 0 });
    b.total++;
    if (c.state === 'new') b.fresh++;
    else if (c.ivl >= 7) b.learned++;
  }
  return Object.entries(by).sort((a, b) => b[1].total - a[1].total);
}

function genTopicOptions() {
  return [...GEN_SPECIAL.map(([id, ko]) => [id, ko]), ...practiceTopics().map((id) => [id, TOPICS[id].ko])];
}

function renderOverview() {
  const s = deckStats();
  const newLeft = newRemainingToday();
  const total = s.due + Math.min(newLeft, s.new);
  const opts = genTopicOptions();
  if (!gen.topic) gen.topic = opts[0][0];
  const found = query.trim() ? state.cards.filter((c) => (c.en + ' ' + c.ko).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 40) : [];

  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">단어·표현</div><h1 class="title">카드 복습</h1></div></div>
  <div class="stat-grid">
    <div class="stat"><b>${s.due}</b><span>복습 대기</span></div>
    <div class="stat"><b>${Math.min(newLeft, s.new)}</b><span>오늘 새 표현</span></div>
    <div class="stat"><b>${s.mature}</b><span>장기 기억</span></div>
  </div>
  <div style="margin-top:14px">
    ${total
      ? `<button class="btn primary block" data-act="start">${icon('cards')} 시작하기 (${total}장)</button>`
      : `<button class="btn soft block" data-act="more">🎉 오늘 몫 완료 · 새 카드 10장 더</button>`}
  </div>
  <div class="seg" style="margin-top:12px">
    <button class="${state.settings.cardDir === 'ko2en' ? 'on' : ''}" data-dir="ko2en">한국어 → 영어로 말하기</button>
    <button class="${state.settings.cardDir === 'en2ko' ? 'on' : ''}" data-dir="en2ko">영어 → 뜻</button>
  </div>

  <h2 class="sec">${icon('sparkle')} AI로 새 표현 만들기</h2>
  <div class="card">
    <div class="chips scroll">${opts.map(([id, ko]) => `<button class="chip sm ${gen.topic === id ? 'on' : ''}" data-gtopic="${id}">${esc(ko)}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px">
      <select id="gcount" style="width:auto;min-height:44px">${[5, 10, 15].map((n) => `<option ${gen.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <span class="small muted grow">개 · 내 상황에 맞는 예문으로</span>
      <button class="btn primary sm" data-act="gen" ${gen.loading ? 'disabled' : ''}>${gen.loading ? '만드는 중…' : '만들기'}</button>
    </div>
    ${gen.error ? `<p class="small" style="color:var(--bad)">${esc(gen.error)}</p>` : ''}
    ${gen.items ? `<div style="margin-top:10px">
      ${gen.items.map((x, i) => `<label class="list-item" style="cursor:pointer"><input type="checkbox" data-gi="${i}" ${x.pick ? 'checked' : ''} style="margin-top:5px;width:20px;height:20px">
        <div class="grow"><div class="en">${esc(x.en)}</div><div class="ko">${esc(x.ko)}</div>
        <div class="small" style="margin-top:3px">${esc(x.ex)}<br><span class="muted">${esc(x.exKo)}</span></div></div></label>`).join('')}
      <button class="btn primary block" data-act="gen-add" style="margin-top:10px">${icon('plus')} 선택한 표현 카드에 추가</button></div>` : ''}
  </div>

  <details class="card tight hint-box" style="margin-top:22px">
    <summary style="padding:4px 2px">${icon('list')} 주제별로 골라 공부하기 <span class="small muted" style="margin-left:auto;font-weight:600">${s.total}장</span></summary>
    ${topicRows().map(([t, b]) => `<div class="list-item" style="align-items:center">
      <div class="grow"><b>${esc(SEED_TOPIC_LABELS[t] || t)}</b>
        <div class="tiny muted">${b.total}장 · 새 ${b.fresh} · 익힌 ${b.learned}</div>
        <div class="bar" style="margin-top:6px;height:5px"><i style="width:${Math.round((b.learned / b.total) * 100)}%"></i></div></div>
      <button class="btn xs" data-topic="${esc(t)}">공부</button></div>`).join('')}
  </details>

  <h2 class="sec">카드 찾기</h2>
  <input type="text" id="q" placeholder="영어나 한국어로 검색" value="${esc(query)}">
  <div class="card tight ${found.length ? '' : 'hidden'}" id="found" style="margin-top:10px">${foundList(found)}</div>`;
}

function foundList(found) {
  return found.map((c) => `<div class="list-item">
    <div class="grow"><div class="en">${esc(c.en)}</div><div class="ko">${esc(c.ko)}</div>
      <div class="tiny muted">${esc(SEED_TOPIC_LABELS[c.t] || c.t)} · ${c.state === 'new' ? '새 카드' : `다음 복습 ${esc(c.due)}`}</div></div>
    <button class="icon-btn" data-say="${esc(c.en)}" aria-label="듣기">${icon('volume')}</button>
    <button class="icon-btn" data-del="${esc(c.id)}" aria-label="삭제">${icon('trash')}</button></div>`).join('');
}

// ---------------- 카드 ----------------
function fixFaces(c) {
  return {
    front: `<div class="hint"><span class="tag accent">내 실수 고쳐 말하기</span></div>
      <div class="hint">내가 이렇게 말했어요</div><div class="fix-wrong en">${esc(c.wrong)}</div>
      <div class="hint">자연스럽게 고쳐서 소리 내어 말해 보세요</div>`,
    back: `<hr><div class="answer en">${esc(c.en)}</div><div class="ex">${esc(c.ko)}</div>
      <button class="btn xs soft" data-say="${esc(c.en)}">${icon('volume')} 듣기</button>`,
  };
}

function renderCard() {
  const c = R.queue[R.idx];
  const ko2en = state.settings.cardDir === 'ko2en';
  const fix = c.kind === 'fix' ? fixFaces(c) : null;
  const front = fix ? fix.front : ko2en
    ? `<div class="hint">${c.state === 'new' ? '<span class="tag accent">새 표현</span>' : ''}</div>
       <div class="front">${esc(c.ko)}</div>${c.exKo ? `<div class="hint">${esc(c.exKo)}</div>` : ''}`
    : `<div class="hint">${c.state === 'new' ? '<span class="tag accent">새 표현</span>' : ''}</div>
       <div class="front en">${esc(c.en)}</div>${c.ex ? `<div class="hint en">${esc(c.ex)}</div>` : ''}
       <button class="btn xs soft" data-say="${esc(c.en)}">${icon('volume')} 듣기</button>`;
  const back = fix ? fix.back : ko2en
    ? `<hr><div class="answer en">${esc(c.en)}</div>${c.ex ? `<div class="ex en">${esc(c.ex)}</div>` : ''}
       <div class="row" style="justify-content:center"><button class="btn xs soft" data-say="${esc(c.en)}">${icon('volume')} 표현</button>
       ${c.ex ? `<button class="btn xs soft" data-say="${esc(c.ex)}">${icon('volume')} 예문</button>` : ''}</div>`
    : `<hr><div class="answer">${esc(c.ko)}</div>${c.exKo ? `<div class="ex">${esc(c.exKo)}</div>` : ''}`;
  el.innerHTML = `
  <div class="q-top">
    <button class="icon-btn" data-act="quit" aria-label="그만하기">${icon('x')}</button>
    <span class="tag primary">${R.idx + 1} / ${R.queue.length}</span>
    <span class="tag">${esc(c.g || SEED_TOPIC_LABELS[c.t] || '')}</span>
  </div>
  <div class="bar" style="margin-bottom:14px"><i style="width:${Math.round((R.idx / R.queue.length) * 100)}%"></i></div>
  <div class="card fc" data-act="flip">${front}${R.revealed ? back : ''}</div>
  ${R.revealed
    ? `<div class="grades">${GRADES.map((g) => `<button class="btn ${g.cls}" data-grade="${g.key}">${g.label}<small>${intervalLabel(nextInterval(c, g.key))}</small></button>`).join('')}</div>
       ${c.kind === 'vocab' ? `<button class="btn ghost block sm" data-act="mine" style="margin-top:8px">${icon('edit')} 이 표현으로 내 얘기 한 문장 만들기</button>` : ''}`
    : `<button class="btn primary block" data-act="flip" style="margin-top:14px">정답 보기</button>
       <p class="tiny muted center">${ko2en ? '먼저 소리 내어 영어로 말해 본 뒤 확인하세요' : '뜻을 떠올려 본 뒤 확인하세요'}</p>`}`;
}

function flip() {
  if (R.revealed) return;
  R.revealed = true;
  renderCard();
  const c = R.queue[R.idx];
  if (state.settings.cardDir === 'ko2en' || c.kind === 'fix') voice.say(c.en, { cachedOnly: true });
}

/** 단어장 공부법 2단계 "내 문장으로 바꾸기" — 표현을 내 얘기로 써 보고 AI가 확인 */
function openMine(c) {
  const keyless = !state.settings.apiKey;
  let result = null;
  modal({
    title: '내 얘기로 문장 만들기',
    body: `<div class="card tight soft"><b class="en">${esc(c.en)}</b> <span class="ko">${esc(c.ko)}</span>${c.ex ? `<div class="small muted" style="margin-top:4px">예) ${esc(c.ex)}</div>` : ''}</div>
      <label class="field"><span>이 표현을 넣어 내 얘기 한 문장 (영어 · 음성 입력 가능)</span>
        <textarea id="mine-in" rows="3" placeholder="예문을 그대로 쓰지 말고 진짜 내 상황으로!"></textarea></label>
      <div id="mine-res" style="margin-top:10px"></div>`,
    actions: [
      { label: '닫기' },
      ...(keyless ? [] : [{ label: 'AI 확인', kind: 'soft', onClick: async (close, back) => {
        const sentence = $('#mine-in', back).value.trim();
        if (!sentence) { toast('문장을 먼저 써 주세요'); return false; }
        const box = $('#mine-res', back);
        box.innerHTML = '<p class="small muted">확인 중…</p>';
        try {
          result = await checkMySentence({ expression: c.en, sentence });
          box.innerHTML = `<div class="card tight"><div class="small" style="color:var(${result.ok ? '--good' : '--warn'});font-weight:700">${result.ok ? '👍 자연스러워요' : '✏️ 이렇게 고쳐 보세요'}</div>
            <div class="en" style="font-weight:700;margin-top:4px">${esc(result.corrected)}</div><div class="ko">${esc(result.ko)}</div>
            <p class="small" style="margin-bottom:0">${esc(result.comment_ko)}</p></div>`;
        } catch (err) {
          box.innerHTML = `<p class="small" style="color:var(--bad)">${esc(friendlyError(err))}</p>`;
        }
        return false;
      } }]),
      { label: '노트에 저장', kind: 'primary', onClick: (close, back) => {
        const en = result?.corrected || $('#mine-in', back).value.trim();
        if (!en) { toast('문장을 먼저 써 주세요'); return false; }
        state.notes.unshift({ id: uid(), en, ko: result?.ko || '', topicId: '', src: 'mine', created: today() });
        save('notes');
        toast('노트에 저장했어요');
      } },
    ],
  });
}

function answer(g) {
  const c = R.queue[R.idx];
  grade(c, g);
  R.count++;
  if (g === 0) R.queue.splice(Math.min(R.queue.length, R.idx + 4), 0, c);
  R.idx++;
  R.revealed = false;
  if (R.idx >= R.queue.length) R.finished = true;
  voice.stopAll();
  render();
}

function renderFinished() {
  el.innerHTML = `
  <div class="center" style="padding:36px 0 18px">
    <div style="font-size:56px">🎉</div>
    <h1 class="title">${R.count}장 복습 완료!</h1>
    <p class="muted">잊어버리기 직전에 다시 나오도록 간격을 맞춰 뒀어요.</p>
  </div>
  <div class="btn-row"><a class="btn" href="#/home">홈으로</a><button class="btn primary" data-act="more">새 카드 10장 더</button></div>`;
}

// ---------------- 이벤트 ----------------
async function onClick(e) {
  const say = e.target.closest('[data-say]');
  if (say) { e.stopPropagation(); return voice.say(say.dataset.say, { cachedOnly: true }); }
  const t = e.target.closest('[data-act],[data-grade],[data-dir],[data-gtopic],[data-topic],[data-del]');
  if (!t) return;
  const d = t.dataset;
  if (d.grade !== undefined) return answer(+d.grade);
  if (d.dir) { state.settings.cardDir = d.dir; save('settings'); return render(); }
  if (d.gtopic) { gen.topic = d.gtopic; gen.items = null; return render(); }
  if (d.topic) { if (startSession({ topic: d.topic })) render(); return; }
  if (d.del) {
    if (!(await confirmBox('이 카드를 삭제할까요?', '삭제', 'danger'))) return;
    state.cards = state.cards.filter((c) => c.id !== d.del);
    save('cards');
    return render();
  }
  switch (d.act) {
    case 'start': if (startSession({})) render(); return;
    case 'more': R = null; startSession({ more: 10 }); return render();
    case 'flip': return flip();
    case 'mine': return openMine(R.queue[R.idx]);
    case 'quit': R = null; voice.stopAll(); return render();
    case 'gen': return runGenerate();
    case 'gen-add': return addGenerated();
  }
}

function onInput(e) {
  if (e.target.id === 'q') {
    query = e.target.value;
    const q = query.trim().toLowerCase();
    const found = q ? state.cards.filter((c) => (c.en + ' ' + c.ko).toLowerCase().includes(q)).slice(0, 40) : [];
    const box = $('#found');
    box.innerHTML = foundList(found);
    box.classList.toggle('hidden', !found.length);
  }
  if (e.target.id === 'gcount') gen.count = +e.target.value;
  if (e.target.dataset.gi !== undefined) gen.items[+e.target.dataset.gi].pick = e.target.checked;
}

function genTarget() {
  const special = GEN_SPECIAL.find(([id]) => id === gen.topic);
  if (special) return { label: special[1], seed: special[2] };
  const t = TOPICS[gen.topic];
  return { label: `${t.ko} (${t.en})`, seed: t.seed, ko: t.ko };
}

async function runGenerate() {
  gen.count = +($('#gcount')?.value || gen.count);
  gen.loading = true;
  gen.error = '';
  gen.items = null;
  render();
  try {
    const target = genTarget();
    const known = state.cards.filter((c) => c.t === target.seed).map((c) => c.en);
    const items = await generateExpressions({ topicLabel: target.label, count: gen.count, known });
    const have = new Set(state.cards.map((c) => c.en.trim().toLowerCase()));
    gen.items = items.filter((x) => !have.has(x.en.trim().toLowerCase())).map((x) => ({ ...x, pick: true }));
  } catch (e) {
    gen.error = friendlyError(e);
  }
  gen.loading = false;
  if (!R) render();
}

function addGenerated() {
  const target = genTarget();
  const picked = gen.items.filter((x) => x.pick);
  for (const x of picked) {
    state.cards.push(newCard({ t: target.seed, g: `${target.ko || target.label} · AI`, en: x.en, ko: x.ko, ex: x.ex, exKo: x.exKo, src: 'ai' }));
  }
  save('cards');
  gen.items = null;
  toast(`${picked.length}개 표현을 추가했어요. 오늘 새 카드에 먼저 나와요.`);
  render();
}
