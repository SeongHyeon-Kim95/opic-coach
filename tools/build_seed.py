"""OPIC_Vocab_Notebook.html -> js/data/seed-vocab.js (앱 기본 단어 카드)

사용법: python3 tools/build_seed.py ../OPIC_Vocab_Notebook.html
Part 1(문법 설명)은 카드로 만들기 어려워 제외하고 Part 2~6 표현만 변환한다.
"""
import html, json, re, sys, pathlib

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../OPIC_Vocab_Notebook.html')
OUT = pathlib.Path(__file__).resolve().parent.parent / 'js/data/seed-vocab.js'

# 단어장 섹션 제목 → 앱 주제 id
TOPIC_BY_HEADING = [
    ('답변 시작', 'starter'), ('필러', 'starter'), ('마무리 표현', 'starter'), ('콜로케이션', 'collocation'),
    ('집 / 거주지', 'home'), ('동네 / 이웃', 'neighborhood'), ('직장 / 학교', 'work'),
    ('여가활동', 'leisure'), ('취미', 'hobby'), ('운동 / 건강', 'exercise'), ('여행 / 출장', 'travel'),
    ('음식 / 카페', 'food'), ('날씨 / 계절', 'weather'), ('돈 / 경제', 'money'), ('기술 / 스마트폰', 'tech'),
    ('쇼핑', 'shopping'), ('재활용 / 환경', 'recycling'), ('스포츠 관람', 'sports_watch'), ('게임', 'game'),
    ('공원 · 해변', 'outdoor'), ('사교모임', 'social'), ('반려동물', 'pet'), ('공연 / 전시', 'show'),
    ('긍정 감정', 'feeling'), ('부정 감정', 'feeling'), ('감정 강도', 'feeling'), ('Feeling 문장', 'feeling'),
    ('묘사 (Description)', 'cat_desc'), ('과거경험 (Past', 'cat_past'), ('비교 (Comparison)', 'cat_comp'),
    ('습관 (Habit)', 'cat_habit'),
    ('RP11', 'roleplay'), ('RP12', 'roleplay'), ('RP13', 'roleplay'), ('RP 상황별', 'roleplay'),
]
HANGUL = re.compile(r'[가-힣]')


def clean(s):
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def topic_for(heading):
    for key, tid in TOPIC_BY_HEADING:
        if key in heading:
            return tid
    return None


def main():
    s = SRC.read_text(encoding='utf-8')
    body = s[s.find('<main') if '<main' in s else 0:]
    start = body.find('1. 답변 시작하기</h3>')
    body = body[body.rfind('<h3', 0, start):]
    token = re.compile(r'<(h3|h4|summary)[^>]*>(.*?)</\1>|<tr>(.*?)</tr>', re.S)
    heading, sub, topic = '', '', None
    cards, seen = [], set()
    for m in token.finditer(body):
        tag = m.group(1)
        if tag in ('h3', 'summary'):
            heading, sub = clean(m.group(2)), ''
            topic = topic_for(heading)
            continue
        if tag == 'h4':
            sub = clean(m.group(2))
            continue
        row = m.group(3)
        if topic is None or 'expr-en' not in row:
            continue
        cells = dict()
        for cm in re.finditer(r'<td class="([\w-]+)">(.*?)</td>', row, re.S):
            cells[cm.group(1)] = cm.group(2)
        en = clean(cells.get('expr-en', ''))
        ko = clean(cells.get('expr-ko', ''))
        ex_raw = cells.get('expr-ex', '')
        ko_span = re.search(r'<span class="ko">(.*?)</span>', ex_raw, re.S)
        ex_ko = clean(ko_span.group(1)) if ko_span else ''
        ex = clean(re.sub(r'<span class="ko">.*?</span>', '', ex_raw, flags=re.S))
        if not ko and ex and HANGUL.search(ex) and not ex_ko:
            ko, ex = ex, ''            # 2열 표: 표현 | 한국어 뜻
        if not ko and ' / ' in en and HANGUL.search(en):
            en, ko = [p.strip() for p in en.split(' / ', 1)]
        if not en or not ko or (en, ko) in seen:
            continue
        seen.add((en, ko))
        group = heading if not sub else f'{heading} · {sub}'
        group = re.sub(r'^\d+\.\s*', '', re.sub(r'^[^\w가-힣]+', '', group))
        card = {'id': f's{len(cards) + 1}', 't': topic, 'g': group, 'en': en, 'ko': ko}
        if ex:
            card['ex'] = ex
        if ex_ko:
            card['exKo'] = ex_ko
        cards.append(card)
    OUT.write_text('// tools/build_seed.py 로 생성 — 원본: OPIC_Vocab_Notebook.html\nexport default '
                   + json.dumps(cards, ensure_ascii=False, separators=(',', ':')).replace('},{', '},\n{') + ';\n',
                   encoding='utf-8')
    from collections import Counter
    print(len(cards), 'cards ->', OUT)
    print(Counter(c['t'] for c in cards))


main()
