export const EMOJI_CATEGORIES = ['추천', '표정', '손짓', '축하', '상태', '자연'] as const;
export type EmojiCategory = (typeof EMOJI_CATEGORIES)[number];
export interface EmojiChoice {
    emoji: string;
    name: string;
    keywords: string;
    category: EmojiCategory;
}

const GROUPS: Array<[EmojiCategory, Array<[string, string, string]>]> = [
    [
        '추천',
        [
            ['👍', '좋아요', 'thumbsup like yes 확인'],
            ['❤️', '하트', 'heart love 사랑'],
            ['😂', '기쁨의 눈물', 'joy laugh 웃음'],
            ['🎉', '축하', 'tada party celebration'],
            ['🚀', '로켓', 'rocket launch 배포'],
            ['👀', '눈', 'eyes 보고있어요 확인'],
            ['🙏', '감사', 'pray thanks 부탁'],
            ['🔥', '불', 'fire hot 열정'],
        ],
    ],
    [
        '표정',
        [
            ['😀', '활짝 웃음', 'grin smile 행복'],
            ['😃', '웃는 얼굴', 'smiley happy'],
            ['😄', '눈웃음', 'smile happy'],
            ['😁', '함박웃음', 'grin'],
            ['😆', '크게 웃음', 'laugh'],
            ['😅', '땀 흘리는 웃음', 'sweat smile'],
            ['🤣', '빵 터진 웃음', 'rofl laugh'],
            ['😊', '미소', 'blush smile'],
            ['🙂', '살짝 웃음', 'smile'],
            ['😉', '윙크', 'wink'],
            ['🥰', '사랑스러움', 'love heart'],
            ['😍', '하트 눈', 'heart eyes'],
            ['😘', '입맞춤', 'kiss'],
            ['😎', '멋짐', 'cool sunglasses'],
            ['🤓', '안경 쓴 얼굴', 'nerd'],
            ['🧐', '살펴보는 얼굴', 'inspect'],
            ['🤔', '생각 중', 'thinking 고민'],
            ['🤨', '의문', 'question'],
            ['😐', '무표정', 'neutral'],
            ['🙃', '거꾸로 얼굴', 'upside down'],
            ['😴', '졸림', 'sleep tired'],
            ['🥱', '하품', 'yawn'],
            ['😮', '놀람', 'surprise wow'],
            ['😲', '깜짝 놀람', 'astonished'],
            ['🤯', '충격', 'mind blown'],
            ['😢', '눈물', 'cry sad'],
            ['😭', '엉엉', 'sob cry'],
            ['🥺', '부탁하는 얼굴', 'please'],
            ['😤', '씩씩', 'angry'],
            ['😡', '화남', 'rage angry'],
            ['😱', '비명', 'scream'],
            ['😬', '난감', 'grimace'],
            ['🤫', '조용', 'shush'],
            ['🤗', '포옹', 'hug'],
            ['🫡', '경례', 'salute 확인'],
            ['🫠', '녹는 얼굴', 'melting'],
            ['🤩', '반짝이는 눈', 'star struck'],
        ],
    ],
    [
        '손짓',
        [
            ['👎', '아쉬워요', 'thumbsdown no'],
            ['👌', '좋습니다', 'ok hand'],
            ['✌️', '브이', 'victory peace'],
            ['🤞', '행운을 빌어요', 'fingers crossed luck'],
            ['🤟', '사랑해요', 'love'],
            ['🤘', '최고', 'rock'],
            ['🤙', '연락해요', 'call'],
            ['👋', '인사', 'wave hello'],
            ['🤚', '손 들기', 'raised hand'],
            ['✋', '잠깐', 'stop hand'],
            ['👏', '박수', 'clap 잘했어요'],
            ['🙌', '만세', 'raised hands hooray'],
            ['👐', '두 손', 'open hands'],
            ['🤝', '악수', 'handshake agree'],
            ['💪', '힘내요', 'muscle strong'],
            ['🫶', '손 하트', 'heart hands'],
            ['🤜', '주먹', 'fist bump'],
        ],
    ],
    [
        '축하',
        [
            ['🥳', '파티', 'party celebration'],
            ['🎊', '색종이', 'confetti'],
            ['🎈', '풍선', 'balloon'],
            ['🎂', '생일 케이크', 'birthday cake'],
            ['🎁', '선물', 'gift'],
            ['🏆', '트로피', 'trophy win'],
            ['🥇', '금메달', 'medal first'],
            ['🏅', '메달', 'medal'],
            ['✨', '반짝임', 'sparkles'],
            ['🌟', '빛나는 별', 'star'],
            ['💯', '백 점', 'hundred perfect'],
            ['💐', '꽃다발', 'bouquet'],
        ],
    ],
    [
        '상태',
        [
            ['✅', '완료', 'check done success'],
            ['☑️', '체크', 'check'],
            ['❌', '취소', 'cross error no'],
            ['⚠️', '주의', 'warning'],
            ['❓', '질문', 'question'],
            ['❗', '중요', 'exclamation'],
            ['💡', '아이디어', 'idea bulb'],
            ['🛠️', '작업 중', 'tools fix'],
            ['🔍', '확인 중', 'search review'],
            ['📝', '기록', 'memo note'],
            ['📌', '핀', 'pin'],
            ['📅', '일정', 'calendar'],
            ['⏳', '대기', 'hourglass wait'],
            ['🔒', '잠금', 'lock private'],
            ['💬', '대화', 'chat'],
            ['🧪', '테스트', 'test experiment'],
            ['🐛', '버그', 'bug'],
            ['💻', '개발', 'laptop code'],
            ['☕', '커피', 'coffee break'],
            ['🍕', '피자', 'pizza lunch'],
        ],
    ],
    [
        '자연',
        [
            ['🌱', '새싹', 'seedling grow'],
            ['🌿', '잎', 'herb'],
            ['🌸', '벚꽃', 'blossom flower'],
            ['🌻', '해바라기', 'sunflower'],
            ['🌈', '무지개', 'rainbow'],
            ['☀️', '햇빛', 'sun'],
            ['🌙', '달', 'moon night'],
            ['⭐', '별', 'star'],
            ['🐶', '강아지', 'dog'],
            ['🐱', '고양이', 'cat'],
            ['🐻', '곰', 'bear'],
            ['🐰', '토끼', 'rabbit'],
            ['🦊', '여우', 'fox'],
            ['🐧', '펭귄', 'penguin'],
            ['🦋', '나비', 'butterfly'],
        ],
    ],
];

export const EMOJI_CATALOG: EmojiChoice[] = GROUPS.flatMap(([category, entries]) =>
    entries.map(([emoji, name, keywords]) => ({ emoji, name, keywords, category })),
);

export function findEmojiChoices(query: string, category: EmojiCategory, quick: string[] = []): EmojiChoice[] {
    const search = query.trim().toLocaleLowerCase().replace(/^:|:$/g, '');
    if (search)
        return EMOJI_CATALOG.filter((choice) =>
            `${choice.emoji} ${choice.name} ${choice.keywords}`.toLocaleLowerCase().includes(search),
        );
    if (category !== '추천') return EMOJI_CATALOG.filter((choice) => choice.category === category);
    return [
        ...new Set([
            ...quick,
            ...EMOJI_CATALOG.filter((choice) => choice.category === category).map((choice) => choice.emoji),
        ]),
    ].map(
        (emoji) =>
            EMOJI_CATALOG.find((choice) => choice.emoji === emoji) ?? { emoji, name: emoji, keywords: '', category },
    );
}
