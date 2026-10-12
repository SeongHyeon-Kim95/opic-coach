// Gemini 키 입력 (첫 실행 안내 · 설정 공용). 카메라·PC 없이 폰만으로: AI Studio 에서 복사 → 붙여넣기 버튼
import { state, save, flush } from './store.js';
import { $, esc, icon, toast } from './util.js';
import { testKey, friendlyError } from './gemini.js';

const KEY_RE = /AIza[0-9A-Za-z_-]{30,}/;

export function keyBlockHTML() {
  const has = !!state.settings.apiKey;
  return `
  <p class="small" style="margin-top:0">키는 <b>이 폰에 한 번만</b> 넣으면 계속 저장돼요. 무료이고, 이 폰 밖으로는 Google AI 호출에만 쓰여요.</p>
  <div class="list-item" style="align-items:center;border-top:none;padding-top:0">
    <span class="step-num">1</span>
    <div class="grow small">구글 로그인 → <b>Create API key</b> (이미 있으면 키 옆 복사 아이콘)</div>
    <a class="btn sm soft" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">AI Studio 열기 ↗</a>
  </div>
  <div class="list-item" style="align-items:center">
    <span class="step-num">2</span>
    <div class="grow small">복사했으면 이 앱으로 돌아와서</div>
    <button class="btn sm primary" data-key="paste">${icon('clipboard')} 붙여넣기</button>
  </div>
  <div class="row" style="margin-top:6px">
    <input type="password" id="key" class="grow" placeholder="또는 여기를 길게 눌러 붙여넣기 (AIza...)" value="${esc(state.settings.apiKey)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    <button class="icon-btn" data-key="show" aria-label="키 보기">${icon('eye')}</button>
  </div>
  <p class="small" id="key-msg" style="margin:8px 0 0">${has ? '<b style="color:var(--good)">✓ 키가 저장돼 있어요</b>' : '<span class="muted">아직 키가 없어요</span>'}</p>
  <details class="hint-box" style="margin-top:12px"><summary class="small">다른 방법</summary>
    <ul class="bullets small" style="margin-top:0">
      <li><b>PC에서 보내기</b>: PC에서 키를 복사해 카카오톡 <b>나와의 채팅</b>에 보내고, 폰 카톡에서 복사 → 위 붙여넣기</li>
      <li><b>다른 폰에서 옮기기</b>: 그 폰의 설정 → 백업 파일 저장(키 포함) → 이 폰에서 백업 불러오기</li>
    </ul>
  </details>`;
}

async function applyKey(root, raw) {
  const key = raw.match(KEY_RE)?.[0] || raw.trim();
  const input = $('#key', root);
  const msg = $('#key-msg', root);
  input.value = key;
  state.settings.apiKey = key;
  save('settings');
  flush();
  if (!key) { msg.innerHTML = '<span class="muted">키를 지웠어요</span>'; return false; }
  if (!KEY_RE.test(key)) { msg.innerHTML = '<b style="color:var(--warn)">키 형식이 달라 보여요 (AIza로 시작). 그래도 테스트해 볼게요…</b>'; }
  msg.innerHTML = '연결 테스트 중…';
  try {
    const model = await testKey();
    msg.innerHTML = `<b style="color:var(--good)">✓ 연결 성공 · 이제 AI 기능을 쓸 수 있어요</b> <span class="tiny muted">(${esc(model)})</span>`;
    return true;
  } catch (e) {
    msg.innerHTML = `<b style="color:var(--bad)">✗ ${esc(friendlyError(e))}</b>`;
    return false;
  }
}

/** 키 영역의 클릭·붙여넣기 처리. 성공하면 onSuccess() */
export function bindKeyBlock(root, { onSuccess } = {}) {
  const onClick = async (e) => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    if (b.dataset.key === 'show') {
      const k = $('#key', root);
      k.type = k.type === 'password' ? 'text' : 'password';
      return;
    }
    if (b.dataset.key === 'paste') {
      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch {
        $('#key', root).focus();
        return toast('입력칸을 길게 눌러 "붙여넣기" 해 주세요', 3000);
      }
      if (!KEY_RE.test(text)) return toast('클립보드에 키가 없어요. AI Studio에서 키를 먼저 복사해 주세요', 3000);
      b.disabled = true;
      if (await applyKey(root, text)) onSuccess?.();
      b.disabled = false;
    }
  };
  const onPaste = (e) => {
    if (e.target.id !== 'key') return;
    const text = e.clipboardData?.getData('text') || '';
    if (!text) return;
    e.preventDefault();
    applyKey(root, text).then((ok) => ok && onSuccess?.());
  };
  const onChange = (e) => {
    if (e.target.id === 'key' && e.target.value.trim() !== state.settings.apiKey) applyKey(root, e.target.value).then((ok) => ok && onSuccess?.());
  };
  root.addEventListener('click', onClick);
  root.addEventListener('paste', onPaste);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('paste', onPaste);
    root.removeEventListener('change', onChange);
  };
}
