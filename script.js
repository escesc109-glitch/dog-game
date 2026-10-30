/* =====================================================
   🐶 멍멍이 키우기 - 게임 로직
   ===================================================== */

// ---------- 상태 ----------
const SAVE_KEY = 'dogGameSave_v1';

const state = {
  coins: 100,
  level: 1,
  xp: 0,
  stats: {
    hunger: 85,       // 배고픔 (높을수록 배부름)
    happiness: 80,    // 행복도
    energy: 85,       // 에너지
    cleanliness: 95,  // 청결도
  },
  sleeping: false,
};

const MAX_STAT = 100;
const XP_PER_LEVEL = 100;

// ---------- DOM 참조 ----------
const $ = (id) => document.getElementById(id);

const dogEl = $('dog');
const collarEl = $('collar');
const thoughtEl = $('thought');
const bubbleEl = $('status-bubble');
const ballEl = $('ball');
const messageEl = $('message');

const coinDisplay = $('coin-display');
const levelDisplay = $('level-display');
const xpBar = $('xp-bar');
const xpText = $('xp-text');

const statVals = {
  hunger: $('hunger-val'),
  happiness: $('happiness-val'),
  energy: $('energy-val'),
  cleanliness: $('cleanliness-val'),
};
const statBars = {
  hunger: $('hunger-bar'),
  happiness: $('happiness-bar'),
  energy: $('energy-bar'),
  cleanliness: $('cleanliness-bar'),
};

// ---------- 저장 / 불러오기 ----------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) { /* 저장 실패 무시 */ }
}

function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (data) {
      const loaded = JSON.parse(data);
      Object.assign(state, loaded);
    }
  } catch (e) { /* 불러오기 실패 무시 */ }
}

// ---------- 유틸 ----------
function clamp(v, min = 0, max = MAX_STAT) {
  return Math.max(min, Math.min(max, v));
}

function addCoin(amount) {
  state.coins = Math.max(0, state.coins + amount);
  updateHUD();
  saveGame();
}

function addXP(amount) {
  state.xp += amount;
  while (state.xp >= XP_PER_LEVEL) {
    state.xp -= XP_PER_LEVEL;
    state.level++;
    showMessage(`🎉 레벨 업! Lv.${state.level} 달성!`);
    updateCollar();
    dogEl.classList.add('jumping');
    setTimeout(() => dogEl.classList.remove('jumping'), 800);
  }
  updateHUD();
  saveGame();
}

// 레벨별 목걸이 색상 변화 (1: 기본, 2: 파랑, 3: 빨강, 4+: 황금)
function updateCollar() {
  const lv = Math.min(state.level, 4);
  collarEl.className = `collar lv${lv}`;
}

// 강아지 감정 표현
function showThought(emoji) {
  thoughtEl.textContent = emoji;
  thoughtEl.classList.remove('show');
  void thoughtEl.offsetWidth; // 애니메이션 재시작
  thoughtEl.classList.add('show');
  setTimeout(() => thoughtEl.classList.remove('show'), 1500);
}

// ---------- 렌더링 ----------
function updateHUD() {
  coinDisplay.textContent = `🪙 ${state.coins}`;
  levelDisplay.textContent = `⭐ Lv.${state.level}`;
  const progress = (state.xp / XP_PER_LEVEL) * 100;
  xpBar.style.width = `${progress}%`;
  xpText.textContent = `다음 레벨까지 ${XP_PER_LEVEL - state.xp}`;
}

function renderStats() {
  for (const key of ['hunger', 'happiness', 'energy', 'cleanliness']) {
    const val = Math.round(state.stats[key]);
    statVals[key].textContent = val;
    statBars[key].style.width = `${val}%`;
    statBars[key].classList.toggle('low', val <= 25);
  }
}

function renderDog() {
  const { hunger, happiness, energy, cleanliness } = state.stats;

  dogEl.classList.remove('sad', 'dirty', 'sleeping', 'clean');

  if (state.sleeping) {
    dogEl.classList.add('sleeping');
    bubbleEl.textContent = '💤 자고 있어요...';
    return;
  }

  // 표정 결정
  let status = '🐶 건강해요!';
  if (hunger <= 25) {
    status = '🍖 배고파요!';
    dogEl.classList.add('sad');
  } else if (happiness <= 25) {
    status = '🥺 심심해요...';
    dogEl.classList.add('sad');
  } else if (energy <= 25) {
    status = '😴 졸려요...';
  } else if (cleanliness <= 25) {
    status = '🧼 더러워요!';
    dogEl.classList.add('dirty');
  }
  bubbleEl.textContent = status;
}

function renderAll() {
  updateHUD();
  updateCollar();
  renderStats();
  renderDog();
}

// ---------- 메시지 ----------
let msgTimer = null;
function showMessage(text) {
  messageEl.textContent = text;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    messageEl.textContent = '🐶 강아지와 친해져 보세요!';
  }, 2500);
}

// ---------- 행동들 ----------
function feedDog() {
  if (state.sleeping) { showMessage('💤 지금은 자고 있어요!'); return; }
  if (state.coins < 10) { showMessage('🪙 돈이 부족해요! 놀아주기로 돈을 벌어보세요.'); return; }
  if (state.stats.hunger >= MAX_STAT) { showMessage('😋 이미 배부른 것 같아요!'); return; }

  addCoin(-10);
  state.stats.hunger = clamp(state.stats.hunger + 25);
  state.stats.happiness = clamp(state.stats.happiness + 5);
  addXP(10);
  showMessage('🍖 사료를 맛있게 먹었어요!');
  showThought('🍖');
  dogEl.classList.remove('eating');
  void dogEl.offsetWidth;
  dogEl.classList.add('eating');
  setTimeout(() => dogEl.classList.remove('eating'), 500);
  renderAll();
  saveGame();
}

function giveTreat() {
  if (state.sleeping) { showMessage('💤 지금은 자고 있어요!'); return; }
  if (state.coins < 25) { showMessage('🪙 돈이 부족해요! 놀아주기로 돈을 벌어보세요.'); return; }
  if (state.stats.hunger >= MAX_STAT) { showMessage('😋 배가 터질 것 같아요!'); return; }

  addCoin(-25);
  state.stats.hunger = clamp(state.stats.hunger + 20);
  state.stats.happiness = clamp(state.stats.happiness + 20);
  addXP(15);
  showMessage('🦴 간식을 정말 좋아해요!');
  showThought('🦴');
  dogEl.classList.add('jumping');
  setTimeout(() => dogEl.classList.remove('jumping'), 800);
  renderAll();
  saveGame();
}

function batheDog() {
  if (state.sleeping) { showMessage('💤 지금은 자고 있어요!'); return; }
  if (state.coins < 15) { showMessage('🪙 돈이 부족해요! 놀아주기로 돈을 벌어보세요.'); return; }
  if (state.stats.cleanliness >= MAX_STAT) { showMessage('✨ 깨끗한데 굳이 씻을 필요 없어요!'); return; }

  addCoin(-15);
  state.stats.cleanliness = clamp(state.stats.cleanliness + 30);
  state.stats.happiness = clamp(state.stats.happiness + 5);
  addXP(10);
  showMessage('🛁 시원하게 목욕했어요!');
  showThought('🫧');
  dogEl.classList.remove('clean');
  void dogEl.offsetWidth;
  dogEl.classList.add('clean');
  setTimeout(() => dogEl.classList.remove('clean'), 600);
  renderAll();
  saveGame();
}

function sleepDog() {
  if (state.sleeping) {
    // 깨우기
    state.sleeping = false;
    dogEl.classList.remove('sleeping');
    showMessage('😊 푹 자고 일어났어요!');
    renderAll();
    saveGame();
    return;
  }
  if (state.stats.energy >= MAX_STAT) { showMessage('😄 에너지가 가득해요!'); return; }

  state.sleeping = true;
  showMessage('💤 잠자리에 들었어요... 다시 누르면 깨워요.');
  renderDog();
  saveGame();
}

// ---------- 미니게임: 공 던지기 ----------
const overlay = $('game-overlay');
const gameArea = $('game-area');
const targetEl = $('target');
const timerEl = $('timer');
const scoreEl = $('score');
const startBtn = $('start-game');

let gameTimer = null;
let spawnTimer = null;
let score = 0;
let timeLeft = 15;
let playing = false;

function openGame() {
  if (state.sleeping) { showMessage('💤 지금은 자고 있어요!'); return; }
  if (state.stats.energy < 20) { showMessage('😴 힘이 없어서 놀 수 없어요. 재워주세요!'); return; }

  score = 0;
  timeLeft = 15;
  playing = false;
  scoreEl.textContent = '0';
  timerEl.textContent = '15';
  targetEl.classList.remove('show');
  startBtn.disabled = false;
  startBtn.textContent = '게임 시작!';
  overlay.classList.add('show');
}

function closeGame() {
  overlay.classList.remove('show');
  clearInterval(gameTimer);
  clearTimeout(spawnTimer);
  playing = false;
  targetEl.classList.remove('show');
}

function startGamePlay() {
  score = 0;
  timeLeft = 15;
  playing = true;
  scoreEl.textContent = '0';
  timerEl.textContent = '15';
  startBtn.disabled = true;
  startBtn.textContent = '게임 중...';

  clearInterval(gameTimer);
  clearTimeout(spawnTimer);

  gameTimer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  spawnTarget();
}

function spawnTarget() {
  if (!playing) return;
  const areaW = gameArea.clientWidth;
  const areaH = gameArea.clientHeight;
  const size = 50;
  const x = Math.random() * (areaW - size);
  const y = Math.random() * (areaH - size);
  targetEl.style.left = `${x}px`;
  targetEl.style.top = `${y}px`;
  targetEl.classList.add('show');

  // 1초 안에 못 누르면 사라지고 다시 생성
  spawnTimer = setTimeout(() => {
    targetEl.classList.remove('show');
    spawnTarget();
  }, 1000);
}

function onTargetClick(e) {
  e.stopPropagation();
  if (!playing) return;
  score++;
  scoreEl.textContent = score;
  targetEl.classList.remove('show');
  clearTimeout(spawnTimer);
  spawnTarget();
}

function endGame() {
  playing = false;
  clearInterval(gameTimer);
  clearTimeout(spawnTimer);
  targetEl.classList.remove('show');

  const earnedCoins = score * 5;
  const earnedHappiness = clamp(score * 4, 0, 40);
  const xpGain = score * 8;

  addCoin(earnedCoins);
  addXP(xpGain);
  state.stats.happiness = clamp(state.stats.happiness + earnedHappiness);
  state.stats.energy = clamp(state.stats.energy - 20);

  renderAll();
  saveGame();

  let grade = '😅';
  if (score >= 20) grade = '🏆 최고예요!';
  else if (score >= 12) grade = '🎉 잘했어요!';
  else if (score >= 6) grade = '😊 괜찮아요!';
  else grade = '😅 조금 연습해볼까요?';

  startBtn.disabled = false;
  startBtn.textContent = '다시 하기';
  messageEl.textContent = `${grade} ${score}개 성공! +${earnedCoins}코인, +${xpGain}경험치!`;
}

// ---------- 게임 루프 (스탯 감소) ----------
const TICK_MS = 3000;

function gameTick() {
  if (state.sleeping) {
    // 잠자는 동안 에너지 회복
    state.stats.energy = clamp(state.stats.energy + 8);
    state.stats.hunger = clamp(state.stats.hunger - 3);
    state.stats.happiness = clamp(state.stats.happiness - 2);
    if (state.stats.energy >= MAX_STAT) {
      state.sleeping = false;
      dogEl.classList.remove('sleeping');
      showMessage('😊 푹 자고 에너지가 가득 찼어요!');
    }
  } else {
    state.stats.hunger = clamp(state.stats.hunger - 4);
    state.stats.happiness = clamp(state.stats.happiness - 3);
    state.stats.energy = clamp(state.stats.energy - 3);
    state.stats.cleanliness = clamp(state.stats.cleanliness - 2);
  }

  renderAll();
  saveGame();
}

// ---------- 이벤트 등록 ----------
$('btn-feed').addEventListener('click', feedDog);
$('btn-treat').addEventListener('click', giveTreat);
$('btn-bathe').addEventListener('click', batheDog);
$('btn-sleep').addEventListener('click', sleepDog);
$('btn-play').addEventListener('click', openGame);

startBtn.addEventListener('click', startGamePlay);
targetEl.addEventListener('click', onTargetClick);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeGame();
});

// ---------- 시작 ----------
loadGame();
renderAll();
setInterval(gameTick, TICK_MS);
