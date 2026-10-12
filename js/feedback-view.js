// AI 피드백 화면 (말하기 직후 + 노트의 답변 기록에서 공용)
import { state, save, newCard } from './store.js';
import { esc, icon, toast, uid, today, fmtDur } from './util.js';
import { TOPICS } from './data/topics.js';
import * as tts from './tts.js';

export function renderFeedback(fb, { durationSec, inputType } = {}) {
  const mpCell = (ok, label, sub) => `<div class="mp-cell ${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${label}<small>${sub}</small></div>`;
  const list = (items) => items?.length ? `<ul class="bullets">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  return `
  <div class="card">
    <div class="fb-head">
      <span class="lv big" data-lv="${esc(fb.level)}">${esc(fb.level)}</span>
      <div class="grow">
        <div class="eyebrow">예상 레벨 · ${durationSec ? fmtDur(durationSec) + ' · ' : ''}${fb.sentence_count ?? '?'}문장${inputType === 'text' ? ' · 텍스트' : ''}</div>
        <div style="font-weight:700;margin-top:2px">${esc(fb.summary_ko)}</div>
      </div>
    </div>
    <p class="small muted" style="margin-top:10px">${esc(fb.level_reason_ko)}</p>
  </div>

  <h2 class="sec">MP 체크 <span class="sub">What · Feeling · Why</span></h2>
  <div class="card">
    <div class="mp-grid">
      ${mpCell(fb.mp?.what, 'What', '무엇')}${mpCell(fb.mp?.feeling, 'Feeling', '감정')}${mpCell(fb.mp?.why, 'Why', '이유')}
    </div>
    ${fb.mp?.found_en ? `<p class="small"><span class="muted">내 MP:</span> <span class="en">"${esc(fb.mp.found_en)}"</span></p>` : ''}
    <p class="small">${esc(fb.mp?.comment_ko)}</p>
  </div>

  <h2 class="sec">체크리스트</h2>
  <div class="card tight">
    <ul class="check-list">
      ${(fb.checks || []).map((c) => `<li><span class="${c.ok ? 'ok' : 'no'}">${icon(c.ok ? 'check' : 'x')}</span><div><b>${esc(c.label_ko)}</b><p>${esc(c.comment_ko)}</p></div></li>`).join('')}
    </ul>
  </div>

  <h2 class="sec">잘한 점 · 고칠 점</h2>
  <div class="card">
    ${list(fb.strengths_ko?.map((s) => '👍 ' + s))}
    ${list(fb.improvements_ko?.map((s) => '🎯 ' + s))}
  </div>

  ${fb.corrections?.length ? `
  <h2 class="sec">문장 교정 <span class="sub">${fb.corrections.length}개</span></h2>
  <div class="card tight">
    ${fb.corrections.map((c) => `<div class="corr">
      <div><span class="from">${esc(c.original)}</span></div>
      <div class="row" style="align-items:flex-start;gap:6px"><span class="to grow">→ ${esc(c.corrected)}</span>
        <button class="icon-btn" style="width:32px;height:32px" data-fb="say" data-text="${esc(c.corrected)}" aria-label="듣기">${icon('volume')}</button></div>
      <div class="small muted">${esc(c.reason_ko)}</div>
    </div>`).join('')}
  </div>` : ''}

  ${fb.pronunciation?.length ? `
  <h2 class="sec">발음 체크</h2>
  <div class="card tight">
    ${fb.pronunciation.map((p) => `<div class="corr row"><button class="btn xs soft" data-fb="say" data-text="${esc(p.word)}">${icon('volume')} ${esc(p.word)}</button><span class="small grow">${esc(p.tip_ko)}</span></div>`).join('')}
  </div>` : ''}

  <h2 class="sec">${esc(state.profile.target)} 업그레이드 답변 <span class="sub">내 이야기 그대로</span></h2>
  <div class="card">
    <div class="btn-row" style="margin-bottom:6px">
      <button class="btn sm soft" data-fb="play-all">${icon('play')} 전체 듣기</button>
      <button class="btn sm" data-fb="save-all">${icon('note')} 노트에 저장</button>
    </div>
    <div class="upgraded">
      ${(fb.upgraded || []).map((s, i) => `<div class="sent" data-i="${i}">
        <div class="en">${esc(s.en)}</div><div class="ko">${esc(s.ko)}</div>
        <div class="acts">
          <button class="icon-btn" data-fb="say-line" data-i="${i}" aria-label="듣기">${icon('volume')}</button>
          <button class="icon-btn" data-fb="save-line" data-i="${i}" aria-label="노트에 저장">${icon('plus')}</button>
        </div></div>`).join('')}
    </div>
    <p class="tiny muted" style="margin-top:8px">쉐도잉: 전체 듣기를 틀고 0.5초 늦게 따라 말해 보세요. 통째로 외우지 말고 내 말투로 바꿔 말하기!</p>
  </div>

  ${fb.expressions?.length ? `
  <h2 class="sec">외울 표현 <button class="btn xs soft" style="margin-left:auto" data-fb="card-all">${icon('cards')} 모두 카드로</button></h2>
  <div class="card tight">
    ${fb.expressions.map((x, i) => `<div class="list-item">
      <div class="grow"><div class="en">${esc(x.en)}</div><div class="ko">${esc(x.ko)}</div>
      <div class="small" style="margin-top:4px">${esc(x.example_en)}<br><span class="muted">${esc(x.example_ko)}</span></div></div>
      <button class="btn xs" data-fb="card" data-i="${i}">${icon('plus')} 카드</button>
    </div>`).join('')}
  </div>` : ''}

  <div class="banner" style="margin-top:18px">${icon('bulb')}<div><b>다음 번엔</b><br>${esc(fb.next_tip_ko)}</div></div>

  <details class="card hint-box">
    <summary>${icon('list')} 내가 말한 내용 (받아쓰기)</summary>
    <div class="transcript en">${esc(fb.transcript)}</div>
  </details>`;
}

function addNote(s, ctx) {
  if (state.notes.some((n) => n.en.trim().toLowerCase() === s.en.trim().toLowerCase())) return false;
  state.notes.unshift({ id: uid(), en: s.en, ko: s.ko, topicId: ctx.topicId, src: 'feedback', created: today(), q: ctx.question?.q });
  return true;
}

export function addExpressionCard(x, topicId) {
  if (state.cards.some((c) => c.en.trim().toLowerCase() === x.en.trim().toLowerCase())) return false;
  const t = TOPICS[topicId];
  state.cards.push(newCard({ t: t?.seed || 'mine', g: t ? `${t.ko} · AI 피드백` : 'AI 피드백', en: x.en, ko: x.ko, ex: x.example_en || x.ex, exKo: x.example_ko || x.exKo, src: 'ai' }));
  return true;
}

/** 피드백 영역의 버튼 처리. ctx: {topicId, question} */
export function bindFeedback(root, fb, ctx) {
  const onClick = (e) => {
    const b = e.target.closest('[data-fb]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.fb;
    const i = +b.dataset.i;
    if (act === 'say') tts.speak(b.dataset.text);
    if (act === 'say-line') tts.speak(fb.upgraded[i].en);
    if (act === 'play-all') {
      const lines = fb.upgraded.map((s) => s.en);
      const rows = [...root.querySelectorAll('.upgraded .sent')];
      tts.speak(lines, {
        onLine: (k) => rows.forEach((r, j) => r.classList.toggle('playing', j === k)),
        onEnd: () => rows.forEach((r) => r.classList.remove('playing')),
      });
    }
    if (act === 'save-line') {
      toast(addNote(fb.upgraded[i], ctx) ? '노트에 저장했어요' : '이미 노트에 있어요');
      save('notes');
    }
    if (act === 'save-all') {
      const n = fb.upgraded.filter((s) => addNote(s, ctx)).length;
      save('notes');
      toast(n ? `${n}문장을 노트에 저장했어요` : '이미 모두 저장돼 있어요');
    }
    if (act === 'card') {
      toast(addExpressionCard(fb.expressions[i], ctx.topicId) ? '단어 카드에 추가했어요 (다음 복습에 나와요)' : '이미 카드에 있어요');
      save('cards');
    }
    if (act === 'card-all') {
      const n = fb.expressions.filter((x) => addExpressionCard(x, ctx.topicId)).length;
      save('cards');
      toast(n ? `${n}개 표현을 카드에 추가했어요` : '이미 모두 카드에 있어요');
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
