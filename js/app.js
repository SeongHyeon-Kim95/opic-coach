import { state, loadState, save, flush } from './store.js';
import { $, $$, toast } from './util.js';
import './install.js';
import * as home from './screens/home.js';
import * as speak from './screens/speak.js';
import * as review from './screens/review.js';
import * as notes from './screens/notes.js';
import * as settings from './screens/settings.js';

const SCREENS = { home, speak, review, notes, settings };
const view = $('#view');
let cleanup = null;

function route() {
  const [name = 'home', ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const screen = SCREENS[name] || home;
  cleanup?.();
  cleanup = null;
  view.onclick = view.oninput = view.onchange = null;
  $('#modal-root').innerHTML = ''; // 뒤로가기 등으로 화면이 바뀌면 열린 팝업도 닫는다
  document.body.classList.remove('focus-mode');
  $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (SCREENS[name] ? name : 'home')));
  view.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = screen.mount(view, params) || null;
}

// PC에서 만든 설정 링크(#setup=키)로 열면 키를 저장하고 주소창에서 지운다
function consumeSetupLink() {
  const m = location.hash.match(/^#setup=([\w-]+)/);
  if (!m) return;
  state.settings.apiKey = m[1];
  save('settings');
  flush();
  history.replaceState(null, '', location.pathname + '#/home');
  setTimeout(() => toast('API 키가 설정됐어요 ✓'), 300);
}

async function init() {
  try {
    await loadState();
  } catch (e) {
    view.innerHTML = `<div class="empty">저장소를 열 수 없어요 (${e.message}).<br>시크릿 모드라면 일반 모드로 열어 주세요.</div>`;
    return;
  }
  consumeSetupLink();
  addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
