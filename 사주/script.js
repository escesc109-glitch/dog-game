/* =====================================================
   🧧 정통 사주 운세 - 계산 & 해설 로직
   - 만세력 기반: 60갑자, 절기(立春 등) 경계, 일주(JDN), 시주
   - 오행 · 음양 · 십성 · 합충 · 일주 · 운세 해설
   ===================================================== */

'use strict';

// ---------- 기초 데이터 ----------
const STEMS          = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const STEMS_HANJA    = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES       = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const BRANCHES_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 원소 인덱스: 0=목 1=화 2=토 3=금 4=수
const STEM_ELEMENT   = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const STEM_YINYANG   = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]; // 0=양
const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 자축인묘진사오미신유술해
const BRANCH_YINYANG = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

const ELEMENT_NAMES  = ['목', '화', '토', '금', '수'];
const ELEMENT_FULL   = ['木(목)', '火(화)', '土(토)', '金(금)', '水(수)'];
const ELEMENT_COLOR  = ['#2e9e5b', '#d9543f', '#c9982a', '#7f8fa6', '#3f7fd0'];
const ELEMENT_DARK   = ['#1f7a45', '#b03a28', '#9a7317', '#5d6b7e', '#2a5f9e'];
const ELEMENT_TRAIT  = {
  0: '성장과 확장, 계획과 시작의 에너지',
  1: '열정과 표현, 빛과 영향력의 에너지',
  2: '안정과 신뢰, 실용과 포용의 에너지',
  3: '결단과 정의, 정리와 원칙의 에너지',
  4: '지혜와 유연, 깊이와 통찰의 에너지',
};

// 오행 상생/상극 (인덱스 기준)
const GEN  = [1, 2, 3, 4, 0]; // 목→화→토→금→수→목
const CTRL = [2, 3, 4, 0, 1]; // 목극토, 화극금, 토극수, 금극목, 수극화

// ---------- 절기 경계 (월주 구분) ----------
const BOUNDARIES = [
  { md: 106,  b: 1 },  // 小寒 → 丑월
  { md: 204,  b: 2 },  // 立春 → 寅월
  { md: 306,  b: 3 },  // 驚蟄 → 卯월
  { md: 405,  b: 4 },  // 清明 → 辰월
  { md: 506,  b: 5 },  // 立夏 → 巳월
  { md: 606,  b: 6 },  // 芒種 → 午월
  { md: 707,  b: 7 },  // 小暑 → 未월
  { md: 808,  b: 8 },  // 立秋 → 申월
  { md: 908,  b: 9 },  // 白露 → 酉월
  { md: 1008, b: 10 }, // 寒露 → 戌월
  { md: 1107, b: 11 }, // 立冬 → 亥월
  { md: 1207, b: 0 },  // 大雪 → 子월
];

// ---------- 유틸 ----------
function mod(n, m) { return ((n % m) + m) % m; }

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// 결정적 난수 (날짜 시드)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

// ---------- 사주팔자 계산 ----------
function getMonthBranch(md) {
  let best = { md: -1, b: -1 };
  for (const bd of BOUNDARIES) {
    if (bd.md <= md && bd.md > best.md) best = bd;
  }
  return best.b === -1 ? 0 : best.b; // 1/1~1/5 는 자월(子)
}

function computeChart(y, m, d, hourBranchIndex) {
  const md = m * 100 + d;
  const baziYear = md < 204 ? y - 1 : y; // 입춘(2/4) 전이면 전년

  // 연주
  const yearStem   = mod(baziYear - 4, 10);
  const yearBranch = mod(baziYear - 4, 12);

  // 월주 (五虎遁)
  const monthBranch = getMonthBranch(md);
  const monthStemFirst = mod((yearStem % 5) * 2 + 2, 10);
  const monthStem = mod(monthStemFirst + (monthBranch - 2), 10);

  // 일주 (JDN → 60갑자)
  const dayIdx    = mod(jdn(y, m, d) + 49, 60);
  const dayStem   = dayIdx % 10;
  const dayBranch = dayIdx % 12;

  // 시주 (五鼠遁)
  const hourStemFirst = mod((dayStem % 5) * 2, 10);
  const hourBranch = hourBranchIndex;
  const hourStem = mod(hourStemFirst + hourBranch, 10);

  return {
    baziYear,
    pillars: [
      { name: '년주', tag: baziYear + '년생', stem: yearStem,   branch: yearBranch,   daily: false },
      { name: '월주', tag: '月柱',           stem: monthStem,  branch: monthBranch,  daily: false },
      { name: '일주', tag: '日主',           stem: dayStem,    branch: dayBranch,    daily: true  },
      { name: '시주', tag: '時柱',           stem: hourStem,   branch: hourBranch,   daily: false },
    ],
    yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch,
  };
}

// ---------- 십성 ----------
function tenGod(dmEl, dmPol, el, pol) {
  const same = pol === dmPol;
  if (el === dmEl)       return same ? '비견' : '겁재';
  if (GEN[dmEl] === el)  return same ? '식신' : '상관';
  if (GEN[el] === dmEl)  return same ? '정인' : '편인';
  if (CTRL[dmEl] === el) return same ? '정재' : '편재';
  if (CTRL[el] === dmEl) return same ? '정관' : '칠살';
  return '';
}

const TEN_GOD_INFO = {
  비견: { k: '比肩', m: '동료·형제·자아', d: '자립심과 주체성이 강하고, 함께 성장하는 기운입니다.' },
  겁재: { k: '劫財', m: '경쟁·추진력',   d: '승부욕과 행동력이 있지만, 과욕은 경계해야 합니다.' },
  식신: { k: '食神', m: '재능·표현·복',   d: '유쾌함과 재능 발휘, 삶의 여유를 부르는 기운입니다.' },
  상관: { k: '傷官', m: '창의·예술·반항', d: '독창성과 표현력이 뛰어나며 개성이 강합니다.' },
  편재: { k: '偏財', m: '큰 재물·모험',   d: '통찰력과 대인관계 능력, 큰 그림을 보는 재주가 있습니다.' },
  정재: { k: '正財', m: '안정 재물·성실', d: '근검절약과 신뢰로 재물을 안정적으로 쌓아갑니다.' },
  정관: { k: '正官', m: '명예·규율·책임', d: '책임감과 리더십이 있으며 사회적 신망을 얻습니다.' },
  칠살: { k: '七殺', m: '권력·도전·압박', d: '추진력과 결단력이 강해 어려운 일도 돌파합니다.' },
  편인: { k: '偏印', m: '지혜·연구·통찰', d: '독특한 통찰과 창의적 사고로 깊이 있는 공부를 합니다.' },
  정인: { k: '正印', m: '학문·보호·지혜', d: '학식과 포용력이 깊어 주변의 신뢰를 받습니다.' },
};

// ---------- 합충 ----------
const LIUHE_NAME = {
  '0,1': '子丑合(자축합)', '2,11': '寅亥合(인해합)', '3,10': '卯戌合(묘술합)',
  '4,9': '辰酉合(진유합)', '5,8': '巳申合(사신합)', '6,7': '午未合(오미합)',
};
const CHONG_NAME = {
  '0,6': '子午冲(자오충)', '1,7': '丑未冲(축미충)', '2,8': '寅申冲(인신충)',
  '3,9': '卯酉冲(묘유충)', '4,10': '辰戌冲(진술충)', '5,11': '巳亥冲(사해충)',
};
const STEM_HE_NAME = {
  '0,5': '甲己合(갑기합)', '1,6': '乙庚合(을경합)', '2,7': '丙辛合(병신합)',
  '3,8': '丁壬合(정임합)', '4,9': '戊癸合(무계합)',
};

function findRelations(chart) {
  const branches = chart.pillars.map((p) => p.branch);
  const stems = chart.pillars.map((p) => p.stem);
  const out = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const bKey = [branches[i], branches[j]].sort((a, b) => a - b).join(',');
      if (LIUHE_NAME[bKey]) {
        out.push({ type: '합', text: LIUHE_NAME[bKey] + ' — ' + chart.pillars[i].name + '·' + chart.pillars[j].name });
      }
      if (CHONG_NAME[bKey]) {
        out.push({ type: '충', text: CHONG_NAME[bKey] + ' — ' + chart.pillars[i].name + '·' + chart.pillars[j].name });
      }
      const sKey = [stems[i], stems[j]].sort((a, b) => a - b).join(',');
      if (STEM_HE_NAME[sKey]) {
        out.push({ type: '합', text: STEM_HE_NAME[sKey] + ' — ' + chart.pillars[i].name + '·' + chart.pillars[j].name });
      }
    }
  }
  return out;
}

// ---------- 일주 성격 ----------
const DM_INFO = {
  0: {
    name: '갑목(甲木)', ele: 0, icon: '🌳',
    title: '큰 나무처럼 곧고 강한 리더',
    desc: '갑목은 울창한 큰 나무입니다. 곧게 자라며 주변을 품는 포용력을 지녔고, 한 번 정한 목표는 끝까지 밀고 나가는 강한 추진력을 가집니다. 겉으로는 온화해 보여도 속은 단단해 "외유내강"의 전형이라 할 수 있습니다.',
    plus: ['리더십이 뛰어나다', '책임감이 강하다', '배포가 크다', '목표 지향적'],
    minus: ['고집이 세다', '남에게 기대기 어려워한다', '감정 표현이 서툴다'],
  },
  1: {
    name: '을목(乙木)', ele: 0, icon: '🌿',
    title: '화초처럼 유연하고 섬세한 사고',
    desc: '을목은 봄날의 화초와 같습니다. 바람에도 휘어지되 부러지지 않는 유연함으로 어떤 환경에도 잘 적응합니다. 관찰력이 뛰어나고 배려가 깊으며, 상황에 맞게 몸을 낮추는 지혜가 있습니다.',
    plus: ['적응력이 뛰어나다', '배려와 공감 능력', '창의적이다', '꼼꼼하다'],
    minus: ['우유부단할 때가 있다', '혼자 끙끙 앓는다', '체면에 약하다'],
  },
  2: {
    name: '병화(丙火)', ele: 1, icon: '☀️',
    title: '태양처럼 밝고 열정적인 존재',
    desc: '병화는 하늘에 뜬 태양입니다. 어떤 어둠도 밝히는 열정과 낙천성으로 주변을 따뜻하게 만듭니다. 사교적이고 배려가 깊어 사람들의 호감을 얻지만, 지나친 직진과 충동이 가끔은 약점입니다.',
    plus: ['밝고 낙천적이다', '사교성이 뛰어나다', '열정적이다', '주변을 밝힌다'],
    minus: ['다혈질 기질', '끝맺음이 약하다', '혼자서는 약해진다'],
  },
  3: {
    name: '정화(丁火)', ele: 1, icon: '🕯️',
    title: '촛불처럼 섬세하고 은은한 정성',
    desc: '정화는 밤을 밝히는 촛불입니다. 겉은 조용하지만 속은 뜨겁고, 가까이 있을수록 편안함을 주는 존재입니다. 집중력과 정성이 뛰어나 예술과 학문에 재능을 보이며, 오래 감추어둔 마음을 끝까지 지킵니다.',
    plus: ['집중력이 강하다', '정성이 깊다', '감성이 풍부하다', '믿음직스럽다'],
    minus: ['내향적이고 예민하다', '혼자 다 앓는다', '과한 완벽주의'],
  },
  4: {
    name: '무토(戊土)', ele: 2, icon: '⛰️',
    title: '산처럼 크고 안정된 신뢰',
    desc: '무토는 우뚝 솟은 큰 산입니다. 흔들리지 않는 안정감과 신뢰감으로 주변 사람들이 의지하게 됩니다. 실용적이고 현실 감각이 뛰어나며, 한 번 맡은 일은 끝까지 책임지는 성격입니다.',
    plus: ['신뢰감이 높다', '책임감이 강하다', '실용적이다', '굳건하다'],
    minus: ['융통성이 부족하다', '감정 표현이 서툴다', '완고한 면이 있다'],
  },
  5: {
    name: '기토(己土)', ele: 2, icon: '🏔️',
    title: '온전한 옥토처럼 수용하는 마음',
    desc: '기토는 만물을 키우는 옥토(밭)입니다. 온순하고 배려심이 깊어 주변 사람들을 잘 살피고, 조용히 뒷받침하는 역할을 즐깁니다. 성실하고 꼼꼼하며 내면의 지혜가 깊습니다.',
    plus: ['성실하고 꼼꼼하다', '배려와 헌신', '인내심이 강하다', '내면의 지혜'],
    minus: ['자신감이 부족할 때가 있다', '남 눈치를 본다', '뒤끝을 챙긴다'],
  },
  6: {
    name: '경금(庚金)', ele: 3, icon: '⚔️',
    title: '강철처럼 단단한 의지와 정의',
    desc: '경금은 단단한 강철입니다. 정의감이 강하고 결단력이 있어, 어려운 일을 만나면 오히려 패기로 돌파합니다. 행동력과 추진력이 뛰어나며, 직설적이지만 그만큼 믿을 수 있는 사람입니다.',
    plus: ['결단력이 뛰어나다', '정의감이 강하다', '행동력이 있다', '속이 시원하다'],
    minus: ['직설적이다', '단순하다는 평가를 받는다', '감정을 묻어둔다'],
  },
  7: {
    name: '신금(辛金)', ele: 3, icon: '💎',
    title: '보석처럼 섬세하고 예리한 감각',
    desc: '신금은 갈고 닦아 만든 보석입니다. 예민한 감각과 심미안으로 세상을 섬세하게 바라봅니다. 완벽주의 성향이 있어 맡은 일은 정교하게 마무리하며, 겉은 차가워 보여도 속은 따뜻합니다.',
    plus: ['미적 감각이 뛰어나다', '정교하다', '통찰력이 있다', '자존심이 강하다'],
    minus: ['예민하다', '완벽주의에 지친다', '타인에 대한 기준이 높다'],
  },
  8: {
    name: '임수(壬水)', ele: 4, icon: '🌊',
    title: '바다처럼 포용하는 대범한 지혜',
    desc: '임수는 끝없이 흐르는 큰 강과 바다입니다. 대범하고 유연하며 어떤 그릇에도 담기는 적응력을 지녔습니다. 배우는 것을 좋아하고 사람을 포용하는 힘이 커서 큰일을 벌이기 좋은 기운입니다.',
    plus: ['포용력이 크다', '지혜롭다', '적응력이 뛰어나다', '모험심이 있다'],
    minus: ['한곳에 오래 머물지 못한다', '너무 융통적이다', '흐름에 휩쓸린다'],
  },
  9: {
    name: '계수(癸水)', ele: 4, icon: '💧',
    title: '이슬비처럼 섬세하고 깊은 직관',
    desc: '계수는 봄날의 이슬비입니다. 조용히 스며들어 모든 것을 적시는 힘을 가졌고, 직관과 통찰이 매우 뛰어납니다. 섬세하고 공감 능력이 좋아 상대의 마음을 잘 읽으며, 그늘에서도 꿋꿋이 자라는 강인함이 있습니다.',
    plus: ['직관과 통찰이 뛰어나다', '공감 능력', '섬세하다', '침착하다'],
    minus: ['우울해지기 쉽다', '예민하다', '소심해 보이지만 실제로는 강하다'],
  },
};

// ---------- 오늘/연간 운세 ----------
const DAILY_FORTUNE = {
  비견: ['동료나 친구의 도움이 기분 좋은 하루가 될 수 있어요. 오랜 친구에게 먼저 연락해 보세요.', '함께하면 효율이 오르는 날! 협력이 재물을 부릅니다.', '자존감이 올라가는 하루, 내 의견을 자신 있게 표현해 보세요.'],
  겁재: ['뜻하지 않은 지출이 있을 수 있어요. 큰 구매는 다음 날로 미뤄보세요.', '경쟁심이 불붙는 날이에요. 승부를 즐기되 무리한 도전은 삼가세요.', '주변의 유혹에 흔들리지 말고 원칙을 지키면 득이 되는 날입니다.'],
  식신: ['먹고 즐기기에 좋은 날! 좋아하는 음식으로 힐링해 보세요.', '재능이 빛나는 날이에요. 그림·음악·글쓰기 등 창작 활동이 즐겁습니다.', '긍정 에너지가 넘쳐 주변을 밝게 만드는 하루가 될 거예요.'],
  상관: ['평소와 다른 시도가 신선한 결과를 가져와요. 틀에서 벗어나 보세요.', '직구보다 우회로가 좋은 날. 지혜롭게 풀어가세요.', '표현력이 살아나는 날, 나의 생각을 솔직하게 말해도 좋아요.'],
  편재: ['뜻밖의 수입이나 이득이 있을 수 있는 날이에요.', '새로운 인연과의 만남이 좋은 기회가 됩니다. 환영해 보세요.', '큰 그림을 그리는 데 좋은 하루. 미래 계획을 세워보세요.'],
  정재: ['성실한 노력이 결실로 이어지는 날이에요. 맡은 일을 꼼꼼히 하세요.', '소비는 필요한 만큼만. 절약이 큰 재산을 만듭니다.', '꾸준함이 빛나는 하루, 평소 루틴을 지켜보세요.'],
  정관: ['책임감이 빛나는 날이에요. 주변의 신뢰를 얻기 좋습니다.', '규칙을 잘 지키면 도움이 되는 하루. 일정 관리를 철저히 하세요.', '명예를 쌓기에 좋은 날, 성실함이 인정받습니다.'],
  칠살: ['결단이 필요한 날이에요. 망설이지 말고 결심한 대로 행동하세요.', '압박이 따르는 날이지만, 이겨내면 크게 성장합니다.', '승부처에서 강한 모습을 보이는 날. 패기 있게 도전해 보세요.'],
  편인: ['머리가 맑아지는 날! 독서나 공부가 잘됩니다.', '직관이 빛나요. 느낌이 오는 일은 진행해도 좋습니다.', '조용히 혼자만의 시간을 보내면 아이디어가 샘솟는 날.'],
  정인: ['배움의 기회가 찾아오는 날이에요. 강의나 책을 접해보세요.', '귀인의 조언이 따르는 날. 주변의 조언을 귀 기울여 들으세요.', '마음이 차분해지고 안정되는 하루, 복잡한 일도 잘 풀립니다.'],
};

const YEARLY_FORTUNE = {
  비견: '자립과 성장의 해. 나를 단단하게 만드는 시기로, 인간관계가 활발해지고 주도권을 쥐기 좋은 해입니다.',
  겁재: '경쟁과 변화의 해. 지출 관리가 중요하며, 불필요한 경쟁보다 내 속도를 지키는 것이 좋습니다.',
  식신: '풍요와 즐거움의 해. 재능이 빛나고 새로운 수입원이 생기기 쉬운 시기입니다.',
  상관: '창의와 도전의 해. 변화가 많지만 기회도 많은 해, 나만의 색을 보여주세요.',
  편재: '대박의 기운이 도는 해. 모험과 투자가 대체로 유리하지만 과욕은 금물입니다.',
  정재: '성실이 보상받는 해. 목돈이 모이고 안정된 생활이 기대됩니다.',
  정관: '출세운이 좋은 해. 승진·취직·합격 등 사회적 인정을 받기 좋습니다.',
  칠살: '도전과 성장의 해. 부담은 크지만 이겨낼 때 확실히 강해지는 시기입니다.',
  편인: '공부와 연구의 해. 기술과 지혜를 쌓기에 좋으며 뜻밖의 통찰이 따라옵니다.',
  정인: '학문과 귀인의 해. 멘토나 주변의 도움으로 한 단계 도약하는 해입니다.',
};

const HELP_ELEMENT = {
  0: { name: '목(木)', color: '초록 · 청록색', nums: '3, 8', dir: '동쪽', item: '식물 · 나무 · 책', keyword: '성장 · 계획' },
  1: { name: '화(火)', color: '빨강 · 주황 · 보라', nums: '2, 7', dir: '남쪽', item: '불 · 조명 · 꽃', keyword: '열정 · 표현' },
  2: { name: '토(土)', color: '노랑 · 갈색 · 베이지', nums: '5, 0', dir: '중앙 · 남서', item: '도자기 · 돌 · 산', keyword: '안정 · 신뢰' },
  3: { name: '금(金)', color: '흰색 · 금색 · 은색', nums: '4, 9', dir: '서쪽', item: '금속 · 시계 · 보석', keyword: '결단 · 정리' },
  4: { name: '수(水)', color: '검정 · 파랑 · 남색', nums: '1, 6', dir: '북쪽', item: '물 · 수족관 · 거울', keyword: '지혜 · 유연' },
};

// ---------- 오행 집계 ----------
function analyzeChart(chart) {
  const dm = chart.dayStem;
  const dmEl = STEM_ELEMENT[dm];
  const dmPol = STEM_YINYANG[dm];

  const elCount = [0, 0, 0, 0, 0];
  let yang = 0, yin = 0;
  const tenList = [];

  for (const p of chart.pillars) {
    const sEl = STEM_ELEMENT[p.stem];
    const bEl = BRANCH_ELEMENT[p.branch];
    const sPol = STEM_YINYANG[p.stem];
    const bPol = BRANCH_YINYANG[p.branch];
    elCount[sEl]++;
    elCount[bEl]++;
    if (sPol === 0) yang++; else yin++;
    if (bPol === 0) yang++; else yin++;

    const sTG = p.daily ? '일원' : tenGod(dmEl, dmPol, sEl, sPol);
    const bTG = p.daily ? '일지' : tenGod(dmEl, dmPol, bEl, bPol);
    tenList.push({ pillar: p, sTG, bTG, sEl, bEl });
  }

  const ranked = ELEMENT_NAMES.map((name, i) => ({ name, i, c: elCount[i] }))
    .sort((a, b) => b.c - a.c);
  const max = ranked[0].c;
  const min = ranked[ranked.length - 1].c;
  const missing = ranked.filter((r) => r.c === 0).map((r) => r.name);

  let balance = Math.round(100 - (max - min) * 8 - missing.length * 8);
  balance = Math.max(35, Math.min(99, balance));

  return {
    dm, dmEl, dmPol, elCount, yang, yin, tenList,
    ranked, strong: ranked[0], weak: ranked[ranked.length - 1], missing, balance,
  };
}

// ---------- 오늘/연간 운세 계산 ----------
function dailyFortune(dmEl, dmPol) {
  const now = new Date();
  const todayJ = jdn(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const tIdx = mod(todayJ + 49, 60);
  const tStem = tIdx % 10;
  const tg = tenGod(dmEl, dmPol, STEM_ELEMENT[tStem], STEM_YINYANG[tStem]);
  const rnd = mulberry32(todayJ);

  let luck = 30 + Math.floor(rnd() * 70);
  const adj = { 비견: 5, 식신: 10, 편재: 8, 정재: 6, 정인: 9, 정관: 4, 편인: 3, 상관: -4, 겁재: -8, 칠살: -6 }[tg] || 0;
  luck = Math.max(20, Math.min(99, luck + adj));

  const star = luck >= 85 ? '★★★★★' : luck >= 70 ? '★★★★☆' : luck >= 55 ? '★★★☆☆' : luck >= 40 ? '★★☆☆☆' : '★☆☆☆☆';
  return {
    tg, text: pick(DAILY_FORTUNE[tg], rnd), luck, star,
    today: (now.getMonth() + 1) + '월 ' + now.getDate() + '일',
    ganzhi: STEMS[tStem] + BRANCHES[tIdx % 12] + '일',
  };
}

function yearlyFortune(dmEl, dmPol) {
  const now = new Date();
  const y = now.getFullYear();
  const yStem = mod(y - 4, 10);
  const yBranch = mod(y - 4, 12);
  const tg = tenGod(dmEl, dmPol, STEM_ELEMENT[yStem], STEM_YINYANG[yStem]);
  return {
    tg, text: YEARLY_FORTUNE[tg],
    year: y, ganzhi: STEMS[yStem] + BRANCHES[yBranch] + '년',
  };
}

// ---------- 렌더링 ----------
function $(id) { return document.getElementById(id); }

function renderResult(chart, genderNote) {
  const A = analyzeChart(chart);
  const rels = findRelations(chart);
  const daily = dailyFortune(A.dmEl, A.dmPol);
  const yearly = yearlyFortune(A.dmEl, A.dmPol);
  const dmInfo = DM_INFO[A.dm];

  const helpIdx = A.missing.length > 0 ? ELEMENT_NAMES.indexOf(A.missing[0]) : A.weak.i;
  const help = HELP_ELEMENT[helpIdx];

  // 1. 사주 기둥
  let pillarHtml = '<div class="pillar-grid">';
  for (const p of chart.pillars) {
    const sEl = STEM_ELEMENT[p.stem];
    const bEl = BRANCH_ELEMENT[p.branch];
    const eleLabel = ELEMENT_NAMES[sEl] === ELEMENT_NAMES[bEl] ? ELEMENT_NAMES[sEl] : ELEMENT_NAMES[sEl] + '·' + ELEMENT_NAMES[bEl];
    pillarHtml +=
      '<div class="pillar' + (p.daily ? ' daily' : '') + '">' +
        '<div class="pillar-head">' + p.name + ' · ' + p.tag + '</div>' +
        '<div class="stem" style="color:' + ELEMENT_DARK[sEl] + '">' + STEMS[p.stem] + '</div>' +
        '<div class="hanja2">' + STEMS_HANJA[p.stem] + '</div>' +
        '<div class="branch" style="color:' + ELEMENT_DARK[bEl] + '">' + BRANCHES[p.branch] + '</div>' +
        '<div class="hanja2">' + BRANCHES_HANJA[p.branch] + '</div>' +
        '<span class="ele-tag" style="background:' + ELEMENT_COLOR[sEl] + '">' + eleLabel + '</span>' +
      '</div>';
  }
  pillarHtml += '</div>';

  const ganzhi =
    STEMS[chart.yearStem] + BRANCHES[chart.yearBranch] + '년 · ' +
    STEMS[chart.monthStem] + BRANCHES[chart.monthBranch] + '월 · ' +
    STEMS[chart.dayStem] + BRANCHES[chart.dayBranch] + '일 · ' +
    STEMS[chart.hourStem] + BRANCHES[chart.hourBranch] + '시';

  // 2. 오행 막대
  const maxCount = Math.max(1, ...A.elCount);
  let barsHtml = '';
  for (let i = 0; i < 5; i++) {
    const pct = Math.round((A.elCount[i] / maxCount) * 100);
    barsHtml +=
      '<div class="five-row">' +
        '<div class="five-name" style="color:' + ELEMENT_DARK[i] + '">' + ELEMENT_FULL[i] + '</div>' +
        '<div class="five-bar-wrap"><div class="five-bar" style="background:' + ELEMENT_COLOR[i] + ';width:' + pct + '%"></div></div>' +
        '<div class="five-count">' + A.elCount[i] + '</div>' +
      '</div>';
  }

  const yinYangText = A.yang > A.yin
    ? '양(陽)의 기운이 우세해 적극적이고 추진력이 강한 성향입니다.'
    : A.yin > A.yang
      ? '음(陰)의 기운이 우세해 신중하고 내면이 깊은 성향입니다.'
      : '음양이 균형을 이뤄 안정적인 기운을 갖추고 있습니다.';

  const missingChip = A.missing.length
    ? '<span class="chip">부족한 오행 <b style="color:#a43a24">' + A.missing.join('·') + '</b></span>'
    : '<span class="chip">5행 모두 보유 ✓</span>';

  // 3. 십성 테이블
  let tenRows = '';
  for (const t of A.tenList) {
    const infoS = TEN_GOD_INFO[t.sTG];
    const infoB = TEN_GOD_INFO[t.bTG];
    tenRows +=
      '<tr>' +
        '<td class="tg-name">' + t.pillar.name + '<br><span style="font-size:11px;color:#a98d6d">' + STEMS[t.pillar.stem] + BRANCHES[t.pillar.branch] + '</span></td>' +
        '<td><b>' + t.sTG + '</b><br><span class="tg-mean">' + (infoS ? infoS.m : '') + '</span></td>' +
        '<td><b>' + t.bTG + '</b><br><span class="tg-mean">' + (infoB ? infoB.m : '') + '</span></td>' +
      '</tr>';
  }

  // 4. 합충
  const relHtml = rels.length
    ? rels.map((r) =>
        '<div class="rel-item">' + (r.type === '합' ? '🤝' : '⚡') + ' <b>' + r.text + '</b> — ' +
        (r.type === '합' ? '서로 끌리는 결합의 기운으로, 조화를 이루는 힘입니다.' : '서로 부딪히는 충돌의 기운으로, 변화와 도전을 만드는 힘입니다.') +
        '</div>').join('')
    : '<div class="rel-item">📿 사주 내 뚜렷한 합·충 관계가 없어 비교적 안정적인 기운이 형성되어 있습니다.</div>';

  // 5. 종합 텍스트
  const verdict = buildVerdict(A, dmInfo, helpIdx, yinYangText);

  // 최종 HTML
  const html =
    '<div class="ganzhi-line">' + ganzhi + '</div>' +
    pillarHtml +

    '<div class="card result-card">' +
      '<h3>⚖️ 오행 분석</h3>' + barsHtml +
      '<div class="chips">' +
        '<span class="chip">음양 <b>' + A.yang + ' : ' + A.yin + '</b> (양:음)</span>' +
        '<span class="chip">가장 강한 오행 <b style="color:' + ELEMENT_DARK[A.strong.i] + '">' + ELEMENT_NAMES[A.strong.i] + ' ' + A.strong.c + '개</b></span>' +
        missingChip +
        '<span class="chip">오행 균형 점수 <b>' + A.balance + '점</b></span>' +
      '</div>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>🔗 합과 충</h3>' +
      '<div class="relation-list">' + relHtml + '</div>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>🗂️ 십성 분석</h3>' +
      '<table class="ten">' +
        '<tr><th>기둥</th><th>천간 (하늘 기운)</th><th>지지 (땅 기운)</th></tr>' +
        tenRows +
      '</table>' +
      '<p style="margin-top:12px;font-size:13px;color:#8a6a48;line-height:1.7">십성은 일간(日主)인 <b>' + dmInfo.name + '</b>을 기준으로, 사주의 각 글자가 나에게 어떤 관계로 작용하는지를 나타냅니다.</p>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>🌳 일주(日主) 성격 해설</h3>' +
      '<div class="personality">' +
        '<h4>' + dmInfo.icon + ' ' + dmInfo.name + ' — ' + dmInfo.title + '</h4>' +
        '<p>' + dmInfo.desc + '</p>' +
        '<div class="traits">' + dmInfo.plus.map(function (t) { return '<span class="trait">✔ ' + t + '</span>'; }).join('') + '</div>' +
        '<div class="traits">' + dmInfo.minus.map(function (t) { return '<span class="trait" style="color:#a85a3a">△ ' + t + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<p style="font-size:13px;color:#8a6a48;line-height:1.7">일지(日支)는 ' + BRANCHES[chart.dayBranch] + '(' + BRANCHES_HANJA[chart.dayBranch] + ')로 ' + ELEMENT_TRAIT[BRANCH_ELEMENT[chart.dayBranch]] + '을 지닙니다. 일간과 일지의 조화가 타고난 성향과 삶의 방식에 함께 작용합니다.</p>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>📅 오늘의 운세 · ' + daily.today + '</h3>' +
      '<div class="fortune-box">' +
        '<div class="fb-head"><span>' + daily.ganzhi + ' · ' + daily.tg + '의 날</span><span class="fb-luck">' + daily.luck + ' · ' + daily.star + '</span></div>' +
        '<p>' + daily.text + '</p>' +
      '</div>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>🗓️ ' + yearly.year + '년 연간 운세</h3>' +
      '<div class="fortune-box">' +
        '<div class="fb-head"><span>' + yearly.ganzhi + ' · ' + yearly.tg + '의 해</span></div>' +
        '<p>' + yearly.text + '</p>' +
      '</div>' +
    '</div>' +

    '<div class="card result-card">' +
      '<h3>🧭 보완 요소 <span style="font-size:13px;font-weight:700;color:#a98d6d">(' + help.name + ' 보충)</span></h3>' +
      '<div class="help-grid">' +
        '<div class="help-item"><div class="hi-label">🎨 행운의 색</div><div class="hi-value">' + help.color + '</div></div>' +
        '<div class="help-item"><div class="hi-label">🔢 행운의 숫자</div><div class="hi-value">' + help.nums + '</div></div>' +
        '<div class="help-item"><div class="hi-label">🧭 행운의 방향</div><div class="hi-value">' + help.dir + '</div></div>' +
        '<div class="help-item"><div class="hi-label">✨ 보조 아이템</div><div class="hi-value">' + help.item + '</div></div>' +
        '<div class="help-item"><div class="hi-label">💫 키워드</div><div class="hi-value">' + help.keyword + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="card result-card verdict">' +
      '<h3>🔮 종합 운세</h3>' +
      '<div class="stars">' + starsFromScore(A.balance) + '</div>' +
      '<p>' + verdict + '</p>' +
      (genderNote ? '<p style="margin-top:10px;font-size:13px;color:#8a6a48">' + genderNote + '</p>' : '') +
    '</div>';

  $('result').innerHTML = html;
  $('result').classList.remove('hidden');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function starsFromScore(balance) {
  if (balance >= 85) return '⭐⭐⭐⭐⭐';
  if (balance >= 70) return '⭐⭐⭐⭐';
  if (balance >= 55) return '⭐⭐⭐';
  if (balance >= 45) return '⭐⭐';
  return '⭐';
}

function buildVerdict(A, dmInfo, helpIdx, yinYangText) {
  const parts = [];
  parts.push(
    dmInfo.name + '을(를) 일주(日主)로 지닌 당신의 사주는 ' +
    ELEMENT_NAMES[A.strong.i] + '(이)가 가장 왕성한 기운입니다. ' +
    ELEMENT_TRAIT[A.strong.i] + '이 두드러집니다.'
  );
  if (A.missing.length) {
    parts.push(
      '반면 사주에 ' + A.missing.join('·') + ' 기운이 부족하여, ' +
      HELP_ELEMENT[helpIdx].name + ' 기운을 보완하면 균형 잡힌 흐름을 만들 수 있습니다.'
    );
  } else {
    parts.push('다행히 오행이 골고루 갖추어져 있어 비교적 균형 잡힌 기운을 지녔습니다.');
  }
  parts.push(yinYangText);
  parts.push('운명은 타고난 기운과 자신의 선택이 어우러져 만들어집니다. 사주의 해석을 자신을 더 깊이 이해하는 도구로 삼아, 주도적으로 삶을 설계해 나가시길 바랍니다.');
  return parts.join(' ');
}

// ---------- 폼 구성 ----------
function initForm() {
  const ySel = $('sel-year');
  const mSel = $('sel-month');
  const dSel = $('sel-day');
  const hSel = $('sel-hour');

  const now = new Date();
  for (let y = 1930; y <= 2030; y++) ySel.add(new Option(y + '년', y));
  for (let m = 1; m <= 12; m++) mSel.add(new Option(m + '월', m));
  ySel.value = now.getFullYear();
  mSel.value = now.getMonth() + 1;

  const HOURS = [
    ['자시 (23:00~00:59)', 0],
    ['축시 (01:00~02:59)', 1],
    ['인시 (03:00~04:59)', 2],
    ['묘시 (05:00~06:59)', 3],
    ['진시 (07:00~08:59)', 4],
    ['사시 (09:00~10:59)', 5],
    ['오시 (11:00~12:59)', 6],
    ['미시 (13:00~14:59)', 7],
    ['신시 (15:00~16:59)', 8],
    ['유시 (17:00~18:59)', 9],
    ['술시 (19:00~20:59)', 10],
    ['해시 (21:00~22:59)', 11],
  ];
  for (const h of HOURS) hSel.add(new Option(h[0], h[1]));
  hSel.value = 6;

  function fillDays() {
    const y = parseInt(ySel.value, 10);
    const m = parseInt(mSel.value, 10);
    const maxD = new Date(y, m, 0).getDate();
    const cur = parseInt(dSel.value, 10) || 1;
    dSel.innerHTML = '';
    for (let d = 1; d <= maxD; d++) dSel.add(new Option(d + '일', d));
    dSel.value = cur <= maxD ? cur : maxD;
  }
  fillDays();
  ySel.addEventListener('change', fillDays);
  mSel.addEventListener('change', fillDays);
}

// ---------- 실행 ----------
initForm();

$('btn-analyze').addEventListener('click', function () {
  const y = parseInt($('sel-year').value, 10);
  const m = parseInt($('sel-month').value, 10);
  const d = parseInt($('sel-day').value, 10);
  const hb = parseInt($('sel-hour').value, 10);
  const g = $('sel-gender').value;

  const chart = computeChart(y, m, d, hb);

  const genderNote =
    g === 'm' ? '남성의 경우 대운(大運)이 양의 방향으로 흘러 사회 활동과 직장운에 힘이 실리는 편입니다.' :
    g === 'f' ? '여성의 경우 대운(大運)이 음의 방향으로 흘러 인간관계와 가정운의 영향이 큽니다.' :
    '성별을 선택하시면 대운(大運)의 흐름 방향까지 더 자세히 풀이할 수 있습니다.';

  renderResult(chart, genderNote);
});
