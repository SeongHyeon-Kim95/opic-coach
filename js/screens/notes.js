import { state, save, newCard, audioGet } from '../store.js';
import { $, esc, icon, toast, uid, today, modal, confirmBox, fmtDur } from '../util.js';
import { TOPICS, CATEGORIES } from '../data/topics.js';
import { practiceTopics } from '../plan.js';
import { polishSentence, LEVELS } from '../prompts.js';
import { friendlyError } from '../gemini.js';
import { renderFeedback, bindFeedback } from '../feedback-view.js';
import * as tts from '../tts.js';

let el;
let tab = 'notes';
let topicFilter = '';

export function mount(root, params) {
  el = root;
  if (params[0] === 'history') {
    tab = 'history';
    history.replaceState(null, '', '#/notes');
  }
  render();
  return () => tts.stop();
}

function render() {
  el.onclick = onClick;
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">내 노트</div><h1 class="title">${tab === 'notes' ? '문장 노트' : '답변 기록'}</h1></div></div>
  <div class="seg" style="margin-bottom:16px">
    <button class="${tab === 'notes' ? 'on' : ''}" data-tab="notes">내 문장 ${state.notes.length}</button>
    <button class="${tab === 'history' ? 'on' : ''}" data-tab="history">답변 기록 ${state.history.length}</button>
  </div>
  ${tab === 'notes' ? notesView() : historyView()}`;
}

// ---------------- 문장 노트 ----------------
function notesView() {
  const topics = [...new Set(state.notes.map((n) => n.topicId).filter((t) => TOPICS[t]))];
  if (topicFilter && !topics.includes(topicFilter)) topicFilter = '';
  const list = state.notes.filter((n) => !topicFilter || n.topicId === topicFilter);
  const inCards = new Set(state.cards.map((c) => c.en.trim().toLowerCase()));
  return `
  <button class="btn primary block" data-act="add">${icon('sparkle')} 하고 싶은 말 → 자연스러운 영어로</button>
  ${state.notes.length ? `
  <div class="chips scroll" style="margin-top:14px">
    <button class="chip sm ${!topicFilter ? 'on' : ''}" data-filter="">전체</button>
    ${topics.map((t) => `<button class="chip sm ${topicFilter === t ? 'on' : ''}" data-filter="${t}">${esc(TOPICS[t].ko)}</button>`).join('')}
  </div>
  <div class="row between" style="margin:8px 2px">
    <span class="small muted">${list.length}문장 · 소리 내어 따라 읽기</span>
    <button class="btn xs soft" data-act="play-all">${icon('play')} 모두 듣기</button>
  </div>
  <div class="card tight" id="note-list">
    ${list.map((n) => `<div class="list-item" data-note="${n.id}">
      <div class="grow"><div class="en">${esc(n.en)}</div><div class="ko">${esc(n.ko)}</div>
        <div class="tiny muted">${esc(TOPICS[n.topicId]?.ko || '')}${n.src === 'feedback' ? ' · AI 피드백' : ''} · ${esc(n.created)}</div></div>
      <button class="icon-btn" data-say="${esc(n.en)}" aria-label="듣기">${icon('volume')}</button>
      ${inCards.has(n.en.trim().toLowerCase()) ? '' : `<button class="icon-btn" data-card="${n.id}" aria-label="카드로 복습">${icon('cards')}</button>`}
      <button class="icon-btn" data-delnote="${n.id}" aria-label="삭제">${icon('trash')}</button>
    </div>`).join('')}
  </div>
  <p class="tiny muted" style="margin:10px 2px">${icon('cards', 'style="width:14px;height:14px;vertical-align:-2px"')} 버튼을 누르면 단어 카드에 들어가서 "한국어 보고 영어로 말하기"로 복습돼요.</p>`
  : `<div class="empty">아직 저장한 문장이 없어요.<br>말하기 피드백의 <b>업그레이드 답변</b>에서 저장하거나<br>위 버튼으로 직접 만들어 보세요.</div>`}`;
}

function openAddModal() {
  const topics = practiceTopics();
  const keyless = !state.settings.apiKey;
  let result = null;
  modal({
    title: keyless ? '문장 직접 추가' : '하고 싶은 말 → 영어 문장',
    body: `
      ${keyless ? `
        <label class="field"><span>영어 문장</span><input type="text" id="m-en" placeholder="I usually unwind by watching Netflix."></label>
        <label class="field"><span>한국어 뜻</span><input type="text" id="m-ko" placeholder="나는 보통 넷플릭스 보면서 쉬어요."></label>`
      : `<label class="field"><span>한국어·영어·섞어서 아무렇게나</span>
          <textarea id="m-in" rows="3" placeholder="예) 퇴근하고 소파에 누워서 넷플릭스 보는 게 하루 중 제일 행복한 시간이야"></textarea></label>`}
      <label class="field"><span>주제</span><select id="m-topic">${topics.map((t) => `<option value="${t}">${esc(TOPICS[t].ko)}</option>`).join('')}</select></label>
      ${keyless ? '' : `<button class="btn soft block" id="m-go" style="margin-top:14px">${icon('sparkle')} AI로 다듬기</button>`}
      <div id="m-res" style="margin-top:12px"></div>`,
    actions: [
      { label: '닫기' },
      {
        label: '저장', kind: 'primary',
        onClick: (close, root) => {
          const topicId = $('#m-topic', root).value;
          let picks = [];
          if (keyless) {
            const en = $('#m-en', root).value.trim();
            if (!en) { toast('영어 문장을 입력해 주세요'); return false; }
            picks = [{ en, ko: $('#m-ko', root).value.trim() }];
          } else {
            if (!result) { toast('먼저 AI로 다듬어 주세요'); return false; }
            picks = [...root.querySelectorAll('[data-pick]:checked')].map((c) => result.options[+c.dataset.pick]);
            if (!picks.length) { toast('저장할 문장을 골라 주세요'); return false; }
          }
          for (const p of picks) state.notes.unshift({ id: uid(), en: p.en, ko: p.ko, topicId, src: 'manual', created: today() });
          save('notes');
          toast(`${picks.length}문장을 저장했어요`);
          render();
        },
      },
    ],
    onMount: (root) => {
      $('#m-go', root)?.addEventListener('click', async (e) => {
        const input = $('#m-in', root).value.trim();
        if (!input) return toast('하고 싶은 말을 적어 주세요');
        e.target.disabled = true;
        e.target.textContent = '다듬는 중…';
        const box = $('#m-res', root);
        try {
          const r = await polishSentence({ input });
          result = { ...r, options: [{ en: r.en, ko: r.ko }, ...(r.alternatives || [])] };
          box.innerHTML = `<div class="card tight">
            ${result.options.map((o, i) => `<label class="list-item" style="cursor:pointer">
              <input type="checkbox" data-pick="${i}" ${i === 0 ? 'checked' : ''} style="margin-top:5px;width:20px;height:20px">
              <div class="grow"><div class="en">${esc(o.en)}</div><div class="ko">${esc(o.ko)}</div></div>
              <button type="button" class="icon-btn" data-msay="${esc(o.en)}">${icon('volume')}</button></label>`).join('')}
          </div><p class="small muted" style="margin:8px 2px">${esc(r.note_ko)}</p>`;
        } catch (err) {
          box.innerHTML = `<p class="small" style="color:var(--bad)">${esc(friendlyError(err))}</p>`;
        }
        e.target.disabled = false;
        e.target.innerHTML = `${icon('sparkle')} 다시 다듬기`;
      });
      root.addEventListener('click', (e) => {
        const s = e.target.closest('[data-msay]');
        if (s) { e.preventDefault(); tts.speak(s.dataset.msay); }
      });
    },
  });
}

// ---------------- 답변 기록 ----------------
function trendChart(items) {
  if (items.length < 2) return '';
  const h = (lv) => 12 + (LEVELS.indexOf(lv) / (LEVELS.length - 1)) * 64;
  return `<div class="card" style="margin-bottom:12px">
    <div class="row between"><b class="small">예상 레벨 추이</b><span class="tiny muted">최근 ${items.length}개</span></div>
    <div style="display:flex;align-items:flex-end;gap:5px;height:90px;margin-top:10px">
      ${items.map((x) => `<div title="${esc(x.feedback.level)}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <span class="tiny muted" style="font-size:10px">${esc(x.feedback.level)}</span>
        <i class="lv" data-lv="${esc(x.feedback.level)}" style="display:block;width:100%;min-width:0;padding:0;height:${h(x.feedback.level)}px;border-radius:6px"></i></div>`).join('')}
    </div></div>`;
}

function historyView() {
  if (!state.history.length) return '<div class="empty">아직 기록이 없어요.<br><a href="#/speak">말하기 연습</a>을 하면 여기에 쌓여요.</div>';
  const withLv = state.history.filter((h) => h.feedback?.level).slice(0, 20).reverse();
  return `${trendChart(withLv)}
  <div class="card tight">
    ${state.history.map((h) => `<div class="list-item" data-hist="${h.id}" style="cursor:pointer">
      <span class="lv" data-lv="${esc(h.feedback?.level || '')}">${esc(h.feedback?.level || '—')}</span>
      <div class="grow">
        <div class="row wrap" style="gap:6px"><span class="tag accent">${esc(CATEGORIES[h.question?.category]?.ko || '')}</span>
          <span class="tiny muted">${esc(TOPICS[h.topicId]?.ko || '')} · ${esc(h.date)}${h.durationSec ? ' · ' + fmtDur(h.durationSec) : ''}</span></div>
        <div class="small en" style="margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(h.question?.q)}</div>
      </div></div>`).join('')}
  </div>`;
}

async function openHistory(id) {
  const h = state.history.find((x) => x.id === id);
  if (!h) return;
  let url = null;
  const close = modal({
    title: `${h.date} · ${CATEGORIES[h.question?.category]?.ko || ''}`,
    body: `
      <div class="card tight soft"><div class="small en">${esc(h.question?.q)}</div>${h.question?.ko ? `<div class="ko small">${esc(h.question.ko)}</div>` : ''}</div>
      <div id="h-audio" style="margin-top:10px"></div>
      ${h.feedback ? `<div id="h-fb" style="margin-top:10px">${renderFeedback(h.feedback, { durationSec: h.durationSec, inputType: h.inputType })}</div>`
        : `<div class="card" style="margin-top:10px"><p class="small muted">AI 피드백 없이 저장된 답변이에요.</p>${h.text ? `<p class="en">${esc(h.text)}</p>` : ''}</div>`}
      <button class="btn danger block" id="h-del" style="margin-top:16px">${icon('trash')} 이 기록 삭제</button>`,
    actions: [{ label: '닫기', onClick: () => { if (url) URL.revokeObjectURL(url); tts.stop(); } }],
    onMount: async (root) => {
      if (h.feedback) bindFeedback($('#h-fb', root), h.feedback, { topicId: h.topicId, question: h.question });
      $('#h-del', root).addEventListener('click', async () => {
        if (!(await confirmBox('이 답변 기록을 삭제할까요?', '삭제', 'danger'))) return;
        state.history = state.history.filter((x) => x.id !== id);
        save('history');
        close();
        render();
      });
      if (h.audioId) {
        const blob = await audioGet(h.audioId).catch(() => null);
        if (blob) {
          url = URL.createObjectURL(blob);
          $('#h-audio', root).innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
        }
      }
    },
  });
}

// ---------------- 이벤트 ----------------
async function onClick(e) {
  const say = e.target.closest('[data-say]');
  if (say) return tts.speak(say.dataset.say);
  const t = e.target.closest('[data-tab],[data-act],[data-filter],[data-card],[data-delnote],[data-hist]');
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { tab = d.tab; return render(); }
  if (d.filter !== undefined) { topicFilter = d.filter; return render(); }
  if (d.hist) return openHistory(d.hist);
  if (d.card) {
    const n = state.notes.find((x) => x.id === d.card);
    const topic = TOPICS[n.topicId];
    state.cards.push(newCard({ t: 'mine', g: topic ? `내 문장 · ${topic.ko}` : '내 문장', en: n.en, ko: n.ko, kind: 'sentence', src: 'note' }));
    save('cards');
    toast('카드에 추가했어요. 단어 탭에서 복습돼요');
    return render();
  }
  if (d.delnote) {
    if (!(await confirmBox('이 문장을 노트에서 지울까요?', '삭제', 'danger'))) return;
    state.notes = state.notes.filter((x) => x.id !== d.delnote);
    save('notes');
    return render();
  }
  if (d.act === 'add') return openAddModal();
  if (d.act === 'play-all') {
    const rows = [...el.querySelectorAll('#note-list .list-item')];
    const ids = rows.map((r) => r.dataset.note);
    const lines = ids.map((id) => state.notes.find((n) => n.id === id).en);
    tts.speak(lines, {
      onLine: (k) => rows.forEach((r, j) => r.style.background = j === k ? 'var(--accent-soft)' : ''),
      onEnd: () => rows.forEach((r) => (r.style.background = '')),
    });
  }
}

