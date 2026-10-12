// 첫 실행 안내: ① AI 연결(키 붙여넣기) ② 서베이 주제 ③ 내 정보 → 홈
import { state, save } from '../store.js';
import { esc, icon } from '../util.js';
import { keyBlockHTML, bindKeyBlock } from '../keysetup.js';
import { profileFieldsHTML, surveyHTML, toggleSurvey } from './settings.js';

const STEPS = [
  { title: 'AI 연결', sub: '질문을 만들고 내 답변을 채점할 AI (무료)' },
  { title: '서베이 주제', sub: '실제 시험에서 고를 항목 그대로 · 12개 이상' },
  { title: '나에 대해', sub: 'AI가 내 얘기로 질문과 예문을 만들어요' },
];
let step = 0;
let el;
let unbindKey = null;

export function mount(root) {
  el = root;
  step = state.settings.apiKey ? (state.profile.survey.length >= 4 ? 2 : 1) : 0;
  render();
  return () => unbindKey?.();
}

function setPath(path, value) {
  const keys = path.split('.');
  let o = state;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = value;
  save(keys[0]);
}

function render() {
  unbindKey?.();
  unbindKey = null;
  const st = STEPS[step];
  el.onclick = onClick;
  el.oninput = (e) => {
    const t = e.target;
    if (t.dataset.bind && t.tagName !== 'SELECT') setPath(t.dataset.bind, t.value);
  };
  el.onchange = (e) => {
    const t = e.target;
    if (t.dataset.bind && t.tagName === 'SELECT') setPath(t.dataset.bind, t.value);
  };
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">시작하기 ${step + 1}/3</div><h1 class="title">${esc(st.title)}</h1>
    <p class="small muted" style="margin:4px 0 0">${esc(st.sub)}</p></div></div>
  <div class="qdots">${STEPS.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}"></i>`).join('')}</div>
  <div class="card" id="step-card">
    ${step === 0 ? keyBlockHTML() : step === 1 ? surveyHTML() : profileFieldsHTML(false)}
  </div>
  ${step === 1 ? `<p class="small muted" id="survey-count" style="margin:8px 2px">${state.profile.survey.length}개 선택</p>` : ''}
  <div class="btn-row" style="margin-top:18px">
    ${step > 0 ? `<button class="btn" data-w="prev">이전</button>` : `<a class="btn" href="#/home">나중에</a>`}
    <button class="btn primary" data-w="next">${step === 2 ? '시작하기' : '다음'} ${icon('chevron')}</button>
  </div>`;
  if (step === 0) unbindKey = bindKeyBlock(el.querySelector('#step-card'), { onSuccess: () => setTimeout(() => { if (step === 0) { step = 1; render(); } }, 900) });
}

function onClick(e) {
  const chip = e.target.closest('[data-survey]');
  if (chip) {
    const n = toggleSurvey(chip);
    el.querySelector('#survey-count').textContent = `${n}개 선택`;
    return;
  }
  const b = e.target.closest('[data-w]');
  if (!b) return;
  if (b.dataset.w === 'prev') step--;
  else if (step === 2) {
    location.hash = '#/home';
    return;
  } else step++;
  render();
  window.scrollTo(0, 0);
}
