// 녹음 중 화면(타이머·목표 구간·레벨 미터) — 말하기와 모의고사에서 공용
import { $, icon, fmtDur } from './util.js';
import { Recorder } from './audio.js';

export const MAX_SEC = 180;
export const zone = (t) => (t < 50 ? 'short' : t <= 100 ? 'good' : t <= 120 ? 'long' : 'over');
export const ZONE_MSG = {
  short: '조금 짧아요. IH는 1분~1분 30초(약 10문장)가 적당해요.',
  good: '좋은 길이예요!',
  long: '살짝 길어요. MP 위주로 다듬으면 더 좋아요.',
  over: '2분이 넘으면 감점될 수 있어요. 핵심만 남겨 보세요.',
};

export function recordingHTML() {
  return `<div class="rec-wrap" style="margin-top:30px">
    <div class="eyebrow" style="color:var(--accent)">● 녹음 중</div>
    <div class="timer" id="timer" data-zone="short">0:00</div>
    <div class="zone-bar"><div class="zone"></div><div class="fill"></div></div>
    <div class="zone-legend"><span>0:00</span><span style="margin-left:18%">1:00~1:30 목표</span><span>3:00</span></div>
    <div class="meter">${'<i></i>'.repeat(14)}</div>
    <button class="rec-btn stop" data-act="stop" aria-label="녹음 끝내기">${icon('stop')}</button>
    <div class="small muted">다 말했으면 눌러서 끝내기</div>
  </div>`;
}

/**
 * recordingHTML() 이 그려진 뒤 호출. 마이크를 열고 타이머·미터를 움직인다.
 * 3분이 되면 onLimit() 호출. 반환: { rec, stopUi }
 */
export async function startRecording(root, { onLimit } = {}) {
  const rec = new Recorder();
  const bars = [...root.querySelectorAll('.meter i')];
  try {
    await rec.start((lv) => bars.forEach((b, i) => {
      b.style.height = `${6 + lv * 30 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + performance.now() / 160)))}px`;
    }));
  } catch (e) {
    rec.cleanup();
    throw e;
  }
  const timerEl = $('#timer', root);
  const fill = $('.zone-bar .fill', root);
  const iv = setInterval(() => {
    const t = rec.elapsed();
    timerEl.textContent = fmtDur(t);
    timerEl.dataset.zone = zone(t);
    fill.style.width = `${Math.min(100, (t / MAX_SEC) * 100)}%`;
    if (t >= MAX_SEC) onLimit?.();
  }, 200);
  return { rec, stopUi: () => clearInterval(iv) };
}

export const micErrorMessage = (e) => (e.name === 'NotAllowedError'
  ? '마이크 권한이 필요해요. 브라우저(사이트) 설정에서 마이크를 허용해 주세요.'
  : `녹음을 시작할 수 없어요: ${e.message}`);
