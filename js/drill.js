// 가리고 말하기: 한국어 보고 영어로 말하기 → 원어민(AI) 음성과 내 녹음 비교 → AI 발음 체크
import { state } from './store.js';
import { $, esc, icon, modal, toast } from './util.js';
import { Recorder, canRecord, audioForAI } from './audio.js';
import { checkPronunciation } from './prompts.js';
import { friendlyError } from './gemini.js';
import * as voice from './aivoice.js';

export function openDrill(lines, { title = '가리고 말하기' } = {}) {
  if (!lines?.length) return toast('연습할 문장이 없어요');
  const D = { i: 0, showEn: false, rec: null, takes: {}, results: {}, busy: false };
  let root;

  const draw = () => {
    const line = lines[D.i];
    const take = D.takes[D.i];
    const res = D.results[D.i];
    root.querySelector('.modal-body').innerHTML = `
      <div class="row between" style="margin-bottom:10px">
        <span class="tag primary">${D.i + 1} / ${lines.length}</span>
        <label class="row small muted" style="gap:6px">영어 계속 보기 <input type="checkbox" data-d="always" ${D.always ? 'checked' : ''}></label>
      </div>
      <div class="card center" style="min-height:190px;display:flex;flex-direction:column;justify-content:center;gap:10px">
        <div style="font-size:19px;font-weight:700">${esc(line.ko || '')}</div>
        ${D.showEn || D.always || !line.ko
          ? `<div class="en" style="font-size:19px;font-weight:800;color:var(--primary)">${esc(line.en)}</div>`
          : `<button class="btn sm soft" data-d="reveal" style="align-self:center">${icon('eye')} 영어 보기</button>`}
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn" data-d="native">${icon('volume')} 원어민</button>
        ${D.rec
          ? `<button class="btn accent" data-d="stop">${icon('stop')} 정지</button>`
          : `<button class="btn" data-d="rec" ${canRecord() ? '' : 'disabled'}>${icon('mic')} 내 녹음</button>`}
        <button class="btn" data-d="mine" ${take ? '' : 'disabled'}>${icon('play')} 내 목소리</button>
      </div>
      ${take && state.settings.apiKey ? `<button class="btn soft block" data-d="check" style="margin-top:10px" ${D.busy ? 'disabled' : ''}>${icon('sparkle')} ${D.busy ? '듣는 중…' : 'AI 발음 체크'}</button>` : ''}
      ${res ? `<div class="card tight" style="margin-top:10px">
          <div class="row"><span class="lv" data-lv="${res.score >= 85 ? 'IH' : res.score >= 65 ? 'IM2' : 'IL'}" style="min-width:58px">${res.score}점</span>
            <span class="small grow">${esc(res.comment_ko)}</span></div>
          ${res.words?.length ? `<div style="margin-top:8px">${res.words.map((w) => `<div class="row small" style="padding:3px 0"><button class="btn xs soft" data-say="${esc(w.word)}">${icon('volume')} ${esc(w.word)}</button><span class="grow">${esc(w.tip_ko)}</span></div>`).join('')}</div>` : ''}
          <div class="tiny muted" style="margin-top:6px">들린 문장: ${esc(res.transcript)}</div></div>` : ''}
      <p class="tiny muted" style="margin:10px 2px 0">한국어만 보고 먼저 영어로 말해 본 뒤 → 원어민 듣기 → 녹음해서 비교하세요.</p>`;
  };

  const go = (d) => {
    if (D.rec) return;
    voice.stopAll();
    D.i = Math.max(0, Math.min(lines.length - 1, D.i + d));
    D.showEn = false;
    draw();
  };

  const onClick = async (e) => {
    const say = e.target.closest('[data-say]');
    if (say) return voice.say(say.dataset.say, { cachedOnly: true });
    const b = e.target.closest('[data-d]');
    if (!b || b.tagName === 'INPUT') return;
    const line = lines[D.i];
    switch (b.dataset.d) {
      case 'reveal': D.showEn = true; return draw();
      case 'native': return voice.say(line.en, { waitMs: 6000 });
      case 'rec':
        voice.stopAll();
        D.rec = new Recorder();
        try { await D.rec.start(); } catch (err) { D.rec = null; toast(err.name === 'NotAllowedError' ? '마이크 권한을 허용해 주세요' : '녹음을 시작할 수 없어요'); }
        return draw();
      case 'stop': {
        const { blob } = await D.rec.stop();
        D.rec = null;
        D.takes[D.i] = blob;
        delete D.results[D.i];
        D.showEn = true;
        return draw();
      }
      case 'mine': {
        voice.stopAll();
        const a = new Audio(URL.createObjectURL(D.takes[D.i]));
        a.onended = () => URL.revokeObjectURL(a.src);
        return a.play();
      }
      case 'check': {
        D.busy = true;
        draw();
        try {
          D.results[D.i] = await checkPronunciation({ target: line.en, audio: await audioForAI(D.takes[D.i]) });
        } catch (err) {
          toast(friendlyError(err), 3500);
        }
        D.busy = false;
        return draw();
      }
    }
  };

  modal({
    title,
    body: '',
    actions: [
      { label: '‹ 이전', onClick: () => { go(-1); return false; } },
      { label: '다음 ›', kind: 'primary', onClick: () => { go(1); return false; } },
      { label: '닫기' },
    ],
    onClose: () => { D.rec?.cancel(); voice.stopAll(); },
    onMount: (m) => {
      root = m;
      m.addEventListener('click', onClick);
      m.addEventListener('change', (e) => { if (e.target.dataset.d === 'always') { D.always = e.target.checked; draw(); } });
      draw();
    },
  });
}
