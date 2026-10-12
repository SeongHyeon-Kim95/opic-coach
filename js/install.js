// 안드로이드 크롬의 "앱 설치" 프롬프트를 잡아 두었다가 홈 화면 배너에서 띄운다
let deferred = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
});
addEventListener('appinstalled', () => { deferred = null; });

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 아이폰 사파리: 홈 화면 앱은 사파리와 저장 공간이 따로라서, 먼저 설치하고 그 아이콘으로 설정해야 한다 */
export const IOS_INSTALL_TIP = `<b>아이폰은 먼저 홈 화면에 추가하세요</b><br>
  <span class="small">사파리 아래 공유 버튼(□↑) → <b>홈 화면에 추가</b> → 생긴 아이콘으로 열어서 설정하세요. 사파리 탭에서 넣은 키·기록은 홈 화면 앱과 공유되지 않아요.</span>`;
export const installPrompt = () => !!deferred && !isStandalone();
export async function promptInstall() {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice.catch(() => {});
  deferred = null;
  location.reload();
}
