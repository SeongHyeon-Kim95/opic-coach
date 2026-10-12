import { state, save, exportJSON, importJSON, resetAll, dayStat, DEFAULT_MODELS } from '../store.js';
import { $, esc, icon, toast, confirmBox } from '../util.js';
import { SURVEY_GROUPS, JOB_OPTIONS, LIVING_OPTIONS } from '../data/topics.js';
import * as tts from '../tts.js';
import * as voice from '../aivoice.js';
import { isStandalone } from '../install.js';
import { keyBlockHTML, bindKeyBlock } from '../keysetup.js';

let el;
let unbindKey = null;

export function mount(root) {
  el = root;
  render();
  if (location.hash.includes('key')) setTimeout(() => $('#key-sec')?.scrollIntoView({ block: 'start' }), 50);
  // 음성 목록은 늦게 로드되는 경우가 있어 선택칸만 다시 채운다
  const off = tts.onVoices(() => {
    const sel = el.querySelector('[data-bind="settings.tts.voice"]');
    if (sel) sel.innerHTML = voiceOptions();
  });
  return () => { off(); unbindKey?.(); voice.stopAll(); };
}

function voiceOptions() {
  const cur = state.settings.tts.voice;
  return `<option value="">자동 (가장 자연스러운 미국 음성)</option>${tts.englishVoices()
    .map((v) => `<option value="${esc(v.voiceURI)}" ${cur === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}`;
}

const opt = (list, cur) => list.map((o) => `<option value="${o.id}" ${o.id === cur ? 'selected' : ''}>${esc(o.ko)}</option>`).join('');

/** 내 정보 입력칸 (첫 실행 안내 화면과 공용, data-bind 로 자동 저장) */
export function profileFieldsHTML(full = true) {
  const p = state.profile;
  return `
    ${full ? `<label class="field" style="margin-top:0"><span>영어 이름 (선택)</span><input type="text" data-bind="profile.name" value="${esc(p.name)}" placeholder="예) Sam"></label>
    <div class="row" style="gap:10px">
      <label class="field grow"><span>현재 실력</span><input type="text" data-bind="profile.level" value="${esc(p.level)}"></label>
      <label class="field" style="width:96px"><span>목표</span><select data-bind="profile.target">${['IM2', 'IM3', 'IH', 'AL'].map((l) => `<option ${p.target === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>` : ''}
    <label class="field" ${full ? '' : 'style="margin-top:0"'}><span>직업 (서베이)</span><select data-bind="profile.job">${opt(JOB_OPTIONS, p.job)}</select></label>
    <label class="field"><span>회사·업무 설명</span><textarea rows="2" data-bind="profile.jobDesc" placeholder="예) IT 회사 마케팅팀에서 일해요. 회의가 많고 가끔 야근해요.">${esc(p.jobDesc)}</textarea></label>
    <label class="field"><span>거주 형태 (서베이)</span><select data-bind="profile.living"><option value="">선택해 주세요</option>${opt(LIVING_OPTIONS, p.living)}</select></label>
    <label class="field"><span>사는 곳·집 설명</span><textarea rows="2" data-bind="profile.livingDesc" placeholder="예) 서울 아파트에 가족과 살아요. 거실 창으로 공원이 보여요.">${esc(p.livingDesc)}</textarea></label>
    <label class="field"><span>나에 대한 사실들 (자유롭게)</span><textarea rows="4" data-bind="profile.facts" placeholder="예) 주 3회 퇴근 후 헬스. 주말엔 카페에서 책 읽기. 작년 여름 오사카 여행. 넷플릭스 드라마 좋아함.">${esc(p.facts)}</textarea></label>`;
}

export function surveyHTML() {
  const p = state.profile;
  return SURVEY_GROUPS.map((g) => `<div class="eyebrow" style="margin:${g === SURVEY_GROUPS[0] ? 0 : 16}px 0 8px">${esc(g.ko)}</div>
    <div class="chips">${g.items.map(([id, ko]) => `<button class="chip sm ${p.survey.includes(id) ? 'on' : ''}" data-survey="${id}">${esc(ko)}</button>`).join('')}</div>`).join('');
}

/** 서베이 칩 토글. 선택 개수를 돌려준다 */
export function toggleSurvey(btn) {
  const list = state.profile.survey;
  const i = list.indexOf(btn.dataset.survey);
  i >= 0 ? list.splice(i, 1) : list.push(btn.dataset.survey);
  save('profile');
  btn.classList.toggle('on', i < 0);
  return list.length;
}

function render() {
  const { settings: s, profile: p } = state;
  const voices = tts.englishVoices();
  const surveyCount = p.survey.length;
  el.onclick = onClick;
  el.onchange = onChange;
  el.oninput = onInput;
  unbindKey?.();
  el.innerHTML = `
  <div class="head"><div><div class="eyebrow">설정</div><h1 class="title">나에게 맞추기</h1></div></div>

  <h2 class="sec" id="key-sec">${icon('sparkle')} AI 연결 (Gemini 키) <span class="sub">오늘 AI 호출 ${dayStat().ai}회</span></h2>
  <div class="card" id="key-card">${keyBlockHTML()}</div>

  <h2 class="sec">내 정보 <span class="sub">AI가 내 얘기로 질문·예문을 만들어요</span></h2>
  <div class="card">
    ${profileFieldsHTML()}
    <p class="tiny muted" style="margin-bottom:0">실제와 같을수록 좋아요. 오픽은 "솔직한 내 얘기"가 가장 자연스럽게 나와요.</p>
  </div>

  <h2 class="sec">서베이 주제 <span class="sub">${surveyCount}개 선택 · 12개 이상 권장</span></h2>
  <div class="card">
    ${surveyHTML()}
    <p class="tiny muted" style="margin-bottom:0">실제 시험에서 고를 항목 그대로 선택하세요. 오늘의 콤보 주제와 새 카드 순서가 여기에 맞춰져요.</p>
  </div>

  <h2 class="sec">하루 목표</h2>
  <div class="card">
    ${[['speak', '말하기 (문항)', 1, 15], ['review', '카드 복습 (장)', 5, 200], ['newCards', '새 표현 (장)', 0, 50]].map(([k, label, min, max]) => `
      <div class="row between" style="padding:6px 0"><span>${label}</span>
        <div class="row" style="gap:6px"><button class="btn xs" data-step="${k}" data-d="-1">−</button>
        <input type="number" data-goal="${k}" min="${min}" max="${max}" value="${s.goals[k]}" style="width:66px;min-height:36px;text-align:center;padding:4px">
        <button class="btn xs" data-step="${k}" data-d="1">＋</button></div></div>`).join('')}
  </div>

  <h2 class="sec">연습 방식</h2>
  <div class="card">
    <label class="switch"><span>실전 모드<br><span class="tiny muted">질문을 귀로만 듣기 (글은 가려짐), 다시 듣기 1회</span></span><input type="checkbox" data-bind="settings.examMode" ${s.examMode ? 'checked' : ''}></label>
    <label class="switch"><span>녹음 파일 보관<br><span class="tiny muted">최근 60개까지 답변 기록에서 다시 듣기</span></span><input type="checkbox" data-bind="settings.keepAudio" ${s.keepAudio ? 'checked' : ''}></label>
    <label class="switch"><span>AI 원어민 음성 (Ava)<br><span class="tiny muted">질문·업그레이드 답변 전체 듣기에만 사용. 무료 한도가 하루 약 20~30문장이라, 다 쓰면 자동으로 폰 음성</span></span><input type="checkbox" data-bind="settings.aiVoice" ${s.aiVoice !== false ? 'checked' : ''}></label>
    <label class="field"><span>AI 음성 목소리</span>
      <select data-bind="settings.aiVoiceName">${voice.AI_VOICES.map(([id, ko]) => `<option value="${id}" ${(s.aiVoiceName || 'Aoede') === id ? 'selected' : ''}>${id} · ${ko}</option>`).join('')}</select></label>
    <button class="btn sm soft" data-act="testai" style="margin-top:8px">${icon('volume')} AI 음성 들어보기</button>
    <label class="field"><span>폰 음성 (단어 카드·문장별 듣기)</span>
      <select data-bind="settings.tts.voice">${voiceOptions()}</select></label>
    <label class="field"><span>읽기 속도 <b id="rate-val">${s.tts.rate.toFixed(2)}x</b></span>
      <input type="range" min="0.6" max="1.3" step="0.05" data-bind="settings.tts.rate" value="${s.tts.rate}" style="width:100%"></label>
    <button class="btn sm soft" data-act="testvoice">${icon('volume')} 폰 음성 들어보기</button>
    ${voices.length ? '' : '<p class="tiny muted">영어 음성이 안 보이면 폰 설정 → 텍스트 음성 변환(TTS)에서 Google 음성 엔진의 영어(미국)를 설치해 주세요.</p>'}
  </div>

  <h2 class="sec">데이터</h2>
  <div class="card">
    <p class="small" style="margin-top:0">모든 기록은 이 폰 브라우저에만 있어요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업하세요.</p>
    <div class="btn-row"><button class="btn sm" data-act="export">${icon('download')} 백업 파일 저장</button>
      <button class="btn sm" data-act="import">${icon('upload')} 백업 불러오기</button></div>
    <input type="file" id="import-file" accept="application/json,.json" class="hidden">
    <details class="hint-box" style="margin-top:14px"><summary class="small">고급: AI 모델 순서</summary>
      <p class="tiny muted">앞 모델이 바쁘거나 한도가 차면 다음 모델을 써요. 쉼표로 구분.</p>
      <input type="text" data-models value="${esc(s.models.join(', '))}">
      <button class="btn xs" data-act="resetmodels" style="margin-top:8px">기본값으로</button>
    </details>
    <button class="btn sm danger" data-act="reset" style="margin-top:14px">전체 초기화</button>
  </div>

  <h2 class="sec">앱으로 쓰기</h2>
  <div class="card small">
    ${isStandalone() ? '<p style="margin:0">✓ 홈 화면 앱으로 실행 중이에요.</p>' : `
    <p style="margin-top:0"><b>갤럭시 (크롬)</b>: 오른쪽 위 ⋮ → <b>홈 화면에 추가</b> (또는 앱 설치)</p>
    <p style="margin-bottom:0"><b>아이폰 (사파리)</b>: 아래 공유 버튼(□↑) → <b>홈 화면에 추가</b> → 그 아이콘으로 열어서 키를 넣으세요 (사파리 탭과 저장 공간이 따로예요)</p>`}
    <p class="tiny muted" style="margin-bottom:0">오픽 데일리 · 단어장 원본: 내 OPIc 단어장(오픽노잼 정리)</p>
  </div>`;
  unbindKey = bindKeyBlock($('#key-card'));
}

function setPath(path, value) {
  const keys = path.split('.');
  let o = state;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = value;
  save(keys[0]);
}

// 글자 입력은 칠 때마다 저장 (앱을 바로 닫아도 안전하게)
function onInput(e) {
  const t = e.target;
  if (!t.dataset.bind || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  setPath(t.dataset.bind, t.type === 'range' ? +t.value : t.value);
  if (t.type === 'range') $('#rate-val').textContent = `${(+t.value).toFixed(2)}x`;
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.bind && (t.type === 'checkbox' || t.tagName === 'SELECT')) {
    setPath(t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
  }
  if (t.dataset.goal) {
    const v = Math.max(+t.min, Math.min(+t.max, Math.round(+t.value || 0)));
    state.settings.goals[t.dataset.goal] = v;
    t.value = v;
    save('settings');
  }
  if (t.dataset.models !== undefined) {
    const list = t.value.split(',').map((x) => x.trim()).filter(Boolean);
    state.settings.models = list.length ? list : [...DEFAULT_MODELS];
    save('settings');
    toast('모델 순서를 저장했어요');
  }
  if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      try {
        importJSON(txt);
        toast('백업을 불러왔어요');
        render();
      } catch (err) {
        toast(err.message);
      }
    });
  }
}

async function onClick(e) {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.survey) {
    const n = toggleSurvey(t);
    const sub = t.closest('.card').previousElementSibling.querySelector('.sub');
    if (sub) sub.textContent = `${n}개 선택 · 12개 이상 권장`;
    return;
  }
  if (d.step) {
    const input = el.querySelector(`[data-goal="${d.step}"]`);
    input.value = +input.value + +d.d;
    return onChange({ target: input });
  }
  switch (d.act) {
    case 'testai':
      if (!state.settings.apiKey) return toast('먼저 키를 넣어 주세요');
      t.disabled = true;
      return voice.say('Hi, I\'m Ava. Tell me about your favorite cafe. What do you usually do there?', {
        waitMs: 15000, onStart: (k) => { t.disabled = false; if (k === 'device') toast('AI 음성을 못 만들어서 폰 음성으로 재생해요'); if (k === 'none') toast('재생이 막혔어요. 한 번 더 눌러 주세요'); },
      });
    case 'testvoice': voice.stopAll(); return tts.speak('Hi, I\'m Ava. Tell me about your favorite cafe. What do you usually do there?');
    case 'export': {
      const withKey = await confirmBox('백업에 API 키도 포함할까요? (다른 폰으로 옮길 때 편하지만, 파일 관리에 주의하세요)', '키 포함');
      const blob = new Blob([exportJSON(withKey)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opic-daily-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return;
    }
    case 'import': return $('#import-file').click();
    case 'resetmodels':
      state.settings.models = [...DEFAULT_MODELS];
      save('settings');
      return render();
    case 'reset':
      if (!(await confirmBox('모든 기록·카드·설정을 지울까요? 되돌릴 수 없어요.', '전부 지우기', 'danger'))) return;
      await resetAll();
      location.replace(location.pathname);
  }
}
