# 오픽 데일리 (OPIc Daily)

매일 10~15분, 폰으로 OPIc IH를 연습하는 웹앱(PWA). 설치 없이 브라우저에서 열고 홈 화면에 추가해서 앱처럼 쓴다.

## 하루 루틴
1. **단어·표현 카드** — 한국어를 보고 영어로 소리 내어 말한 뒤 확인. 간격 반복(SRS)으로 잊기 직전에 다시 나온다. 기본 카드 484장은 `OPIC_Vocab_Notebook.html`에서 변환했다.
2. **오늘의 콤보 말하기** — 내 서베이 주제로 AI가 실전형 질문 3개를 만든다 → Ava 음성으로 듣기 → 녹음 → AI 피드백
   - 예상 레벨, MP(What·Feeling·Why) 체크, 체크리스트, 문장 교정, 발음, **내 이야기 그대로 IH로 업그레이드한 답변**, 외울 표현
3. **문장 노트** — 업그레이드 답변 문장이나 "하고 싶은 말 → 영어" 결과를 모아 두고 따라 읽기. 카드로 보내 복습할 수도 있다.

## 설정
- **Gemini API 키**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 무료 발급 → 설정 탭에 붙여넣기. 키와 모든 기록은 그 폰의 브라우저(IndexedDB)에만 저장된다.
- 서베이 주제·거주 형태·나에 대한 사실을 넣어 두면 질문과 예문이 내 얘기로 나온다.
- 기록은 폰에만 있으므로 가끔 **설정 → 백업 파일 저장**.

## 구조
```
index.html, css/app.css, manifest.webmanifest, sw.js (오프라인 캐시)
js/app.js            라우터
js/store.js          IndexedDB 저장, 연속 학습일, 백업
js/gemini.js         Gemini 호출 (모델이 바쁘면 다음 모델로 자동 전환)
js/prompts.js        질문 생성 / 답변 평가 / 표현 생성 / 문장 다듬기 프롬프트 (오픽노잼 방식)
js/audio.js          녹음 → 16kHz WAV 변환
js/tts.js            폰 내장 영어 음성
js/srs.js            간격 반복
js/screens/*.js      홈 · 말하기 · 단어 · 노트 · 설정
js/data/topics.js    서베이 항목, 돌발 주제, 질문 유형
js/data/seed-vocab.js  기본 단어 카드 (tools/build_seed.py 로 생성)
```

빌드 과정 없음. 정적 파일을 그대로 GitHub Pages에 올리면 된다.

```bash
python3 -m http.server 8765        # 로컬 확인: http://localhost:8765
python3 tools/build_seed.py ../OPIC_Vocab_Notebook.html   # 단어장 다시 변환
python3 tools/make_icons.py        # 아이콘 다시 생성
```
