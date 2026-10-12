import { state, dayStat, streak, isActive } from '../store.js';
import { esc, icon, today, addDays, fmtDateKo, daysBetween } from '../util.js';
import { TOPICS } from '../data/topics.js';
import { todayTopic } from '../plan.js';
import { dueCards, newRemainingToday } from '../srs.js';
import { installPrompt, promptInstall, isIOS, isStandalone, IOS_INSTALL_TIP } from '../install.js';

export function mount(el) {
  const { settings, profile } = state;
  const st = dayStat();
  const goals = settings.goals;
  const due = dueCards().length;
  const newLeft = newRemainingToday();
  const topic = TOPICS[todayTopic()];
  const days = streak();

  const cardsDone = st.review >= goals.review || (due === 0 && newLeft === 0 && st.review > 0);
  const speakDone = st.speak >= goals.speak;
  const pct = (a, b) => `${Math.min(100, Math.round((a / Math.max(1, b)) * 100))}%`;

  // 이번 주 (월~일)
  const t = today();
  const dow = (new Date().getDay() + 6) % 7;
  const monday = addDays(t, -dow);
  const week = [...Array(7)].map((_, i) => addDays(monday, i));

  const levels = state.history.filter((h) => h.feedback?.level).slice(0, 6).reverse();
  const setupNeeded = [];
  if (!settings.apiKey) setupNeeded.push('Gemini API 키 입력');
  if (profile.survey.length < 4) setupNeeded.push('서베이 주제 선택');
  if (!profile.living) setupNeeded.push('거주 형태·내 정보');

  el.innerHTML = `
  <div class="head">
    <div>
      <div class="eyebrow">${fmtDateKo(t)}</div>
      <h1 class="title">오늘의 오픽</h1>
    </div>
    <span class="streak">${icon('fire')} ${days}일</span>
  </div>

  ${setupNeeded.length ? `<a class="banner" href="#/welcome" style="text-decoration:none">${icon('sparkle')}<div class="grow"><b>시작 전 1분 설정</b><br><span class="small">${setupNeeded.join(' · ')} — AI가 내 상황에 맞는 질문과 피드백을 만들어요.</span></div>${icon('chevron')}</a>` : ''}
  ${isIOS() && !isStandalone() ? `<div class="banner">${icon('download')}<div>${IOS_INSTALL_TIP}</div></div>` : ''}
  ${installPrompt() ? `<button class="banner" data-act="install" style="width:100%;border:none;text-align:left;cursor:pointer">${icon('download')}<div class="grow"><b>홈 화면에 앱으로 설치</b><br><span class="small">아이콘 한 번으로 바로 열려요.</span></div></button>` : ''}

  <div class="card primary">
    <div class="row between" style="margin-bottom:12px"><b>오늘 목표</b><span class="small muted">${isActive(t) ? '오늘 공부 완료 🔥' : '말하기 1문항 또는 카드 10장이면 연속 기록!'}</span></div>
    <div class="goal-row"><span>말하기</span><div class="bar"><i style="width:${pct(st.speak, goals.speak)}"></i></div><b>${st.speak}/${goals.speak}</b></div>
    <div class="goal-row"><span>카드 복습</span><div class="bar"><i style="width:${pct(st.review, goals.review)}"></i></div><b>${st.review}/${goals.review}</b></div>
    <div class="goal-row"><span>새 표현</span><div class="bar"><i style="width:${pct(st.newCards, goals.newCards)}"></i></div><b>${st.newCards}/${goals.newCards}</b></div>
  </div>

  <h2 class="sec">오늘의 루틴 <span class="sub">10~15분</span></h2>
  <a class="card link" href="#/review/start">
    <span class="step-num ${cardsDone ? 'done' : ''}">${cardsDone ? icon('check') : '1'}</span>
    <div class="grow"><b>단어·표현 카드</b><div class="small muted">복습 ${due}장 · 새 표현 ${newLeft}장 — 한국어 보고 영어로 말하기</div></div>
    ${icon('chevron')}
  </a>
  <a class="card link" href="#/speak/today">
    <span class="step-num ${speakDone ? 'done' : ''}">${speakDone ? icon('check') : '2'}</span>
    <div class="grow"><b>오늘의 콤보 말하기</b><div class="small muted">${esc(topic.ko)} · 3문항 녹음 → AI 피드백</div></div>
    ${icon('chevron')}
  </a>
  <a class="card link" href="#/notes">
    <span class="step-num">3</span>
    <div class="grow"><b>내 문장 정리</b><div class="small muted">피드백에서 저장한 문장 소리 내어 읽기 · ${state.notes.length}문장</div></div>
    ${icon('chevron')}
  </a>

  <a class="card link" href="#/mock">
    <span class="step-num" style="background:var(--accent-soft);color:var(--accent)">${icon('sparkle')}</span>
    <div class="grow"><b>실전 모의고사</b><div class="small muted">${state.mocks[0]
      ? `지난번 ${esc(state.mocks[0].grade || '—')} · ${daysBetween(state.mocks[0].date, t) === 0 ? '오늘' : `${daysBetween(state.mocks[0].date, t)}일 전`} · 주 1회 추천`
      : '15문항 · 끝나면 바로 예상 등급 · 주 1회 추천'}</div></div>
    ${icon('chevron')}
  </a>

  <h2 class="sec">이번 주</h2>
  <div class="card">
    <div class="week">
      ${week.map((d, i) => `<div>${'월화수목금토일'[i]}<div class="dot ${isActive(d) ? 'on' : ''} ${d === t ? 'today' : ''}">${icon('check')}</div></div>`).join('')}
    </div>
  </div>

  ${levels.length ? `
  <h2 class="sec">최근 예상 레벨 <a class="sub" href="#/notes/history">기록 보기</a></h2>
  <div class="card">
    <div class="row wrap">${levels.map((h) => `<span class="lv" data-lv="${esc(h.feedback.level)}">${esc(h.feedback.level)}</span>`).join(`<span class="muted">›</span>`)}</div>
  </div>` : ''}
  `;

  el.querySelector('[data-act=install]')?.addEventListener('click', promptInstall);
}
