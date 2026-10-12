# 오픽 데일리 (OPIc Daily)

매일 10~15분, 폰으로 OPIc IH를 연습하는 웹앱(PWA). 설치 없이 브라우저에서 열고 홈 화면에 추가해서 앱처럼 쓴다.

## 하루 루틴
1. **단어·표현 카드** — 한국어를 보고 영어로 소리 내어 말한 뒤 확인. 간격 반복(SRS)으로 잊기 직전에 다시 나온다. 기본 카드 484장은 `OPIC_Vocab_Notebook.html`에서 변환했다. 카드에서 바로 "이 표현으로 내 얘기 한 문장 만들기"(AI 확인)도 된다.
2. **오늘의 콤보 말하기** — 내 서베이 주제로 AI가 실전형 질문 3개를 만든다 → Ava(AI 원어민 음성)로 듣기 → 녹음 → AI 피드백
   - 예상 레벨, 영역별 점수 6개(질문 이해·구성·문법·어휘·유창성·발음), 단어 수·분당 단어·연결어·필러
   - MP(What·Feeling·Why) 체크, 체크리스트, 문장 교정(실수 유형 분류), 발음
   - **내 이야기 그대로 IH로 업그레이드한 답변** → 가리고 말하기(한국어 보고 말하기 → 원어민 음성 → 내 녹음 비교 → AI 발음 점수)
   - 교정된 실수는 "고쳐 말하기" 카드로 복습
3. **문장 노트** — 저장한 문장 따라 읽기·가리고 말하기, "하고 싶은 말 → 영어" 다듬기
4. **실전 모의고사** (주 1회) — 15문항(또는 미니 7문항)을 실제 시험처럼 피드백 없이 진행, 답하는 동안 뒤에서 채점 → 끝나면 최종 예상 등급·영역 점수·다음 주 계획·문항별 피드백
5. **성장 리포트** — 최근 답변 영역 평균과 변화, 가장 약한 영역, 자주 하는 실수 유형

## 설정
- **Gemini API 키**: 처음 열면 안내 화면이 뜬다. 폰에서 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → 키 복사 → 앱의 📋 붙여넣기. 한 번만 넣으면 계속 저장된다. 키와 모든 기록은 그 폰의 브라우저(IndexedDB)에만 있다.
- 서베이 주제·거주 형태·나에 대한 사실을 넣어 두면 질문과 예문이 내 얘기로 나온다.
- 기록은 폰에만 있으므로 가끔 **설정 → 백업 파일 저장**.

## 구조
```
index.html, css/app.css, manifest.webmanifest, sw.js (오프라인 캐시)
js/app.js            라우터
js/store.js          IndexedDB 저장, 연속 학습일, 백업
js/gemini.js         Gemini 호출 (모델이 바쁘면 다음 모델로 자동 전환, 10분 쿨다운)
js/prompts.js        질문·모의고사 생성 / 답변 평가 / 모의고사 종합 / 발음 체크 / 표현 / 문장 다듬기 (오픽노잼 방식)
js/aivoice.js        Gemini 음성 합성(Ava 목소리) + 기기 캐시, 실패 시 폰 음성
js/audio.js          녹음, Gemini 전송 형식 변환 (크롬 webm 그대로, 그 외 WAV)
js/tts.js            폰 내장 영어 음성
js/recui.js          녹음 중 화면 (말하기·모의고사 공용)
js/drill.js          가리고 말하기 + 내 녹음 비교 + AI 발음 체크
js/keysetup.js       키 붙여넣기 (첫 실행 안내·설정 공용)
js/metrics.js        받아쓰기로 계산하는 단어 수·분당 단어·연결어·필러
js/srs.js            간격 반복
js/screens/*.js      홈 · 말하기 · 모의고사 · 단어 · 노트 · 설정 · 첫 실행 안내
js/data/topics.js    서베이 항목, 돌발 주제, 질문 유형
js/data/seed-vocab.js  기본 단어 카드 (tools/build_seed.py 로 생성)
```

빌드 과정 없음. 정적 파일을 그대로 GitHub Pages에 올리면 된다.

```bash
python3 -m http.server 8765        # 로컬 확인: http://localhost:8765
python3 tools/build_seed.py ../OPIC_Vocab_Notebook.html   # 단어장 다시 변환
python3 tools/make_icons.py        # 아이콘 다시 생성
```
