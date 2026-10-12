// 안드로이드 크롬의 "앱 설치" 프롬프트를 잡아 두었다가 홈 화면 배너에서 띄운다
let deferred = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
});
addEventListener('appinstalled', () => { deferred = null; });

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const installPrompt = () => !!deferred && !isStandalone();
export async function promptInstall() {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice.catch(() => {});
  deferred = null;
  location.reload();
}
