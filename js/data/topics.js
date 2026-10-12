// 오픽 Background Survey 항목과 돌발 주제.
// seed: 단어장(seed-vocab.js)의 어느 주제 카드와 연결되는지 — 새 카드 우선순위에 사용

export const JOB_OPTIONS = [
  { id: 'office', ko: '사업/회사 (직장인)' },
  { id: 'remote', ko: '재택근무/재택사업' },
  { id: 'teacher', ko: '교사/교육자' },
  { id: 'none', ko: '일 경험 없음' },
];

export const LIVING_OPTIONS = [
  { id: 'alone', ko: '개인 주택이나 아파트에 홀로 거주' },
  { id: 'roommate', ko: '친구나 룸메이트와 함께 거주' },
  { id: 'family', ko: '가족(배우자/자녀/부모님)과 함께 거주' },
  { id: 'dorm', ko: '학교 기숙사' },
];

export const SURVEY_GROUPS = [
  {
    id: 'leisure', ko: '여가 활동', items: [
      ['movie', '영화 보기', 'watching movies', 'leisure'],
      ['club', '클럽/나이트클럽 가기', 'going to clubs', 'social'],
      ['performance', '공연 보기', 'watching performances', 'show'],
      ['concert', '콘서트 보기', 'going to concerts', 'show'],
      ['museum', '박물관 가기', 'visiting museums', 'show'],
      ['park', '공원 가기', 'going to parks', 'outdoor'],
      ['camping', '캠핑하기', 'camping', 'outdoor'],
      ['beach', '해변 가기', 'going to the beach', 'outdoor'],
      ['sports_watch', '스포츠 관람', 'watching sports', 'sports_watch'],
      ['home_improve', '주거 개선', 'improving your home', 'home'],
      ['bar', '술집/바에 가기', 'going to bars', 'social'],
      ['cafe', '카페/커피전문점 가기', 'going to cafes', 'food'],
      ['game', '게임하기', 'playing games', 'game'],
      ['sns', 'SNS에 글 올리기', 'posting on social media', 'leisure'],
      ['texting', '친구들과 문자 대화', 'texting with friends', 'leisure'],
      ['news', '뉴스 보거나 듣기', 'watching or listening to the news', 'leisure'],
      ['tv', 'TV 시청하기', 'watching TV', 'leisure'],
      ['reality', '리얼리티쇼 시청', 'watching reality shows', 'leisure'],
      ['shopping', '쇼핑하기', 'shopping', 'shopping'],
      ['drive', '차로 드라이브하기', 'going for a drive', 'travel'],
      ['spa', '스파/마사지샵 가기', 'going to spas', 'social'],
      ['volunteer', '자원봉사하기', 'volunteering', 'social'],
    ],
  },
  {
    id: 'hobby', ko: '취미/관심사', items: [
      ['music', '음악 감상하기', 'listening to music', 'leisure'],
      ['instrument', '악기 연주하기', 'playing a musical instrument', 'hobby'],
      ['singing', '노래 부르기', 'singing', 'hobby'],
      ['dance', '춤추기', 'dancing', 'hobby'],
      ['writing', '글쓰기', 'writing', 'hobby'],
      ['drawing', '그림 그리기', 'drawing', 'hobby'],
      ['cooking', '요리하기', 'cooking', 'hobby'],
      ['pet', '애완동물 기르기', 'raising a pet', 'pet'],
      ['reading', '독서', 'reading books', 'hobby'],
      ['stock', '주식 투자하기', 'investing in stocks', 'money'],
      ['photo', '사진 촬영하기', 'taking photos', 'hobby'],
      ['travel_blog', '여행 잡지/블로그 읽기', 'reading travel blogs', 'travel'],
    ],
  },
  {
    id: 'sport', ko: '운동', items: [
      ['gym', '헬스', 'working out at the gym', 'exercise'],
      ['jogging', '조깅', 'jogging', 'exercise'],
      ['walking', '걷기', 'walking', 'exercise'],
      ['hiking', '하이킹/트레킹', 'hiking', 'exercise'],
      ['cycling', '자전거', 'riding a bike', 'exercise'],
      ['swimming', '수영', 'swimming', 'exercise'],
      ['yoga', '요가', 'doing yoga', 'exercise'],
      ['golf', '골프', 'playing golf', 'exercise'],
      ['tennis', '테니스', 'playing tennis', 'exercise'],
      ['badminton', '배드민턴', 'playing badminton', 'exercise'],
      ['pingpong', '탁구', 'playing table tennis', 'exercise'],
      ['soccer', '축구', 'playing soccer', 'exercise'],
      ['basketball', '농구', 'playing basketball', 'exercise'],
      ['baseball', '야구/소프트볼', 'playing baseball', 'exercise'],
      ['ski', '스키/스노보드', 'skiing and snowboarding', 'exercise'],
      ['fishing', '낚시', 'fishing', 'exercise'],
      ['exercise_class', '운동 수업 수강', 'taking exercise classes', 'exercise'],
      ['no_exercise', '운동을 전혀 하지 않음', 'not exercising', 'exercise'],
    ],
  },
  {
    id: 'vacation', ko: '휴가/출장', items: [
      ['travel_domestic', '국내 여행', 'traveling in your country', 'travel'],
      ['travel_abroad', '해외 여행', 'traveling abroad', 'travel'],
      ['staycation', '집에서 보내는 휴가', 'vacations at home', 'travel'],
      ['biz_domestic', '국내 출장', 'domestic business trips', 'travel'],
      ['biz_abroad', '해외 출장', 'overseas business trips', 'travel'],
    ],
  },
];

// 서베이와 상관없이 늘 나오는 기본 주제
export const BASE_TOPICS = [
  ['home', '집 / 거주지', 'your home', 'home'],
  ['neighborhood', '동네 / 이웃', 'your neighborhood', 'neighborhood'],
  ['work', '직장 / 업무', 'your job and company', 'work'],
];

// 돌발 주제 (서베이에 없어도 나오는 것들)
export const SURPRISE_TOPICS = [
  ['weather', '날씨 / 계절', 'weather and seasons', 'weather'],
  ['recycling', '재활용', 'recycling', 'recycling'],
  ['transport', '교통 / 대중교통', 'transportation', 'travel'],
  ['tech', '기술 / 인터넷', 'technology and the internet', 'tech'],
  ['phone', '휴대폰 / 전화', 'mobile phones', 'tech'],
  ['food', '음식 / 외식', 'food and eating out', 'food'],
  ['holiday', '휴일 / 명절', 'holidays', 'social'],
  ['furniture', '가구 / 가전', 'furniture and appliances', 'home'],
  ['fashion', '패션 / 옷', 'fashion and clothes', 'shopping'],
  ['health', '건강 / 병원', 'health and hospitals', 'exercise'],
  ['bank', '은행', 'banks', 'money'],
  ['hotel', '호텔', 'hotels', 'travel'],
  ['appointment', '약속', 'appointments with friends', 'social'],
  ['geography', '지형 / 우리나라', 'the geography of your country', 'travel'],
  ['industry', '산업 / 회사', 'industries in your country', 'work'],
  ['gathering', '모임 / 파티', 'gatherings and parties', 'social'],
  ['money', '돈 / 소비', 'money and spending', 'money'],
];

const toTopic = ([id, ko, en, seed], kind) => ({ id, ko, en, seed, kind });
export const TOPICS = Object.fromEntries([
  ...BASE_TOPICS.map((t) => toTopic(t, 'base')),
  ...SURVEY_GROUPS.flatMap((g) => g.items.map((t) => toTopic(t, 'survey'))),
  ...SURPRISE_TOPICS.map((t) => toTopic(t, 'surprise')),
].map((t) => [t.id, t]));

// 단어장 주제 이름 (seed-vocab.js 의 t 값)
export const SEED_TOPIC_LABELS = {
  starter: '답변 시작·필러·마무리', collocation: '만능 콜로케이션', feeling: '감정 표현(Feeling)',
  cat_desc: '묘사 표현', cat_habit: '습관 표현', cat_past: '과거경험 표현', cat_comp: '비교 표현', roleplay: '롤플레이',
  home: '집', neighborhood: '동네', work: '직장', leisure: '여가(영화·음악·SNS)', hobby: '취미', exercise: '운동/건강',
  travel: '여행/출장', food: '음식/카페', weather: '날씨', money: '돈/경제', tech: '기술', shopping: '쇼핑',
  recycling: '재활용', sports_watch: '스포츠 관람', game: '게임', outdoor: '공원·해변·캠핑', social: '사교모임', pet: '반려동물',
  show: '공연·전시', mine: '내 문장', mistakes: '내 실수 교정',
};
// 어떤 주제든 쓰이는 공통 표현 — 새 카드 우선순위 최상위
export const CORE_SEED_TOPICS = ['starter', 'feeling', 'cat_desc', 'cat_habit', 'cat_past', 'cat_comp'];

export const CATEGORIES = {
  desc: { ko: '묘사', en: 'Description' },
  habit: { ko: '습관', en: 'Habit' },
  past: { ko: '과거경험', en: 'Past experience' },
  comp: { ko: '비교', en: 'Comparison' },
  rp11: { ko: '롤플레이 11 · 질문하기', en: 'Role-play 11: ask 3-4 questions' },
  rp12: { ko: '롤플레이 12 · 대안 제시', en: 'Role-play 12: explain a problem and offer 2-3 alternatives' },
  rp13: { ko: '롤플레이 13 · 비슷한 경험', en: 'Role-play 13: past experience with a similar problem' },
  ihu14: { ko: 'IHU 14 · 사회 변화 비교', en: 'Hard comparison: changes in society/people' },
  ihu15: { ko: 'IHU 15 · 이슈/관심사', en: 'Hard question: social issue or concern' },
  intro: { ko: '자기소개', en: 'Self-introduction' },
};

// 6-6 난이도 콤보 패턴 (실제 시험에서 자주 나오는 순서)
export const COMBO_PATTERNS = [
  ['desc', 'habit', 'past'],
  ['desc', 'past', 'past'],
  ['desc', 'comp', 'past'],
  ['habit', 'past', 'comp'],
];

export const MODES = {
  combo: { ko: '콤보 3문항', desc: '같은 주제 3문항 (실전 순서)' },
  single: { ko: '한 문제', desc: '원하는 유형 1문항' },
  roleplay: { ko: '롤플레이', desc: '11 → 12 → 13 세트' },
  surprise: { ko: '돌발 콤보', desc: '서베이에 없는 주제 3문항' },
  hard: { ko: 'IHU 14·15', desc: '사회 비교 + 이슈 질문' },
};

// API 키가 없거나 AI가 응답하지 않을 때 쓰는 기본 질문 (주제 영어 이름을 끼워 넣음)
export const OFFLINE_TEMPLATES = {
  desc: [
    (t) => `You indicated in the survey that you enjoy ${t.en}. What do you like about it? Tell me about it in as much detail as possible.`,
    (t) => `I'd like to know about ${t.en}. Describe it for me. What is it like, and why do you feel that way about it?`,
  ],
  habit: [
    (t) => `What do you usually do when it comes to ${t.en}? Tell me about your typical routine from beginning to end.`,
    (t) => `Tell me about the things you usually do related to ${t.en}. How often do you do them, and who do you usually do them with?`,
  ],
  past: [
    (t) => `Tell me about a memorable experience you had related to ${t.en}. When was it, what happened, and why was it so memorable?`,
    (t) => `Have you ever had an unexpected problem related to ${t.en}? What happened, and how did you deal with it?`,
  ],
  comp: [
    (t) => `How has ${t.en} changed compared to when you were younger? What are the differences, and how do you feel about those changes?`,
  ],
  ihu14: [
    (t) => `People's attitudes toward ${t.en} have changed over the years. How were things in the past, and how are they now? What caused those changes?`,
  ],
  ihu15: [
    (t) => `What are some issues or concerns people have these days about ${t.en}? Why do people worry about them, and what do you think should be done?`,
  ],
  intro: [() => 'Let\'s start the interview now. Tell me a little bit about yourself.'],
};
export const OFFLINE_ROLEPLAY = [
  {
    rp11: 'I\'d like to give you a situation and ask you to act it out. You want to join a gym near your home. Call the gym and ask three or four questions to get the information you need.',
    rp12: 'I\'m sorry, but there is a problem I need you to resolve. You signed up for the gym, but you just found out you have to go on a long business trip. Call the gym, explain the situation, and offer two or three alternatives.',
    rp13: 'That\'s the end of the situation. Have you ever had to change or cancel plans because of something unexpected? Tell me what happened and how you handled it.',
  },
  {
    rp11: 'I\'d like you to act out a situation. You want to buy a new smartphone. Go to an electronics store and ask the clerk three or four questions about the phone you want.',
    rp12: 'I\'m sorry, but there is a problem. The phone you bought stopped working after one day. Call the store, explain the problem, and suggest two or three ways to solve it.',
    rp13: 'Have you ever had a problem with something you bought? What was the problem, and how did you solve it? Tell me about it in detail.',
  },
];
