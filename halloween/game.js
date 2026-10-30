/* =====================================================
   🎃 할로윈 호박 사냥 - 게임 로직
   ===================================================== */
(() => {
'use strict';

// ---------- 기본 설정 ----------
const CANVAS_W = 960;
const CANVAS_H = 600;
const GAME_TIME = 60;
const BOW = { x: CANVAS_W / 2, y: CANVAS_H - 46 };
const BEST_KEY = 'halloweenPumpkinBest';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);

// ---------- 상태 ----------
let state = 'start';            // start | playing | over
let score = 0;
let timeLeft = GAME_TIME;
let best = loadBest();

let mouse = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
let aimAngle = -Math.PI / 2;
let pull = 1;                   // 활시위 당김 (1 = 당김 상태)
let recoil = 0;                 // 발사 반동
let shake = 0;                  // 화면 흔들림

let arrows = [];
let pumpkins = [];
let particles = [];
let texts = [];
let bats = [];
let stars = [];
let fog = { t: 0 };

let spawnTimer = 0.4;
let combo = 0;
let comboTimer = 0;

let lastTime = performance.now();

// ---------- 저장 ----------
function loadBest() {
  try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; }
  catch (e) { return 0; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
}

// ---------- 사운드 (Web Audio) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
const sfxShoot = () => tone(700, 0.12, 'triangle', 0.12, 180);
const sfxHit   = () => { tone(220, 0.14, 'square', 0.1, 80); tone(120, 0.2, 'sine', 0.15, 60); };
const sfxBonus = () => { tone(880, 0.1, 'sine', 0.15); setTimeout(() => tone(1320, 0.16, 'sine', 0.15), 90); };
const sfxCombo = () => tone(600, 0.12, 'triangle', 0.12, 900);
const sfxOver  = () => tone(400, 0.4, 'sawtooth', 0.1, 100);

// ---------- 화면 스케일 ----------
function resize() {
  const maxW = Math.min(window.innerWidth - 20, CANVAS_W);
  const scale = maxW / CANVAS_W;
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
}

// ---------- 좌표 변환 ----------
function toCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (CANVAS_W / rect.width),
    y: (clientY - rect.top) * (CANVAS_H / rect.height),
  };
}

// ---------- 초기화 ----------
function initStars() {
  stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H * 0.7,
      r: Math.random() * 1.6 + 0.4,
      tw: Math.random() * Math.PI * 2,
      sp: 1 + Math.random() * 2,
    });
  }
}

function spawnBat() {
  const fromLeft = Math.random() < 0.5;
  bats.push({
    x: fromLeft ? -40 : CANVAS_W + 40,
    sp: (40 + Math.random() * 50) * (fromLeft ? 1 : -1),
    y: 50 + Math.random() * 180,
    flap: Math.random() * Math.PI * 2,
    size: 14 + Math.random() * 10,
  });
}

function spawnPumpkin() {
  if (pumpkins.length >= 8) return;
  const roll = Math.random();
  let type = 'normal', r, base, speed;
  if (roll < 0.10) {        // 황금 호박
    type = 'gold'; r = 30; base = 100; speed = 40 + Math.random() * 50;
  } else if (roll < 0.22) { // 작고 빠른 호박
    type = 'small'; r = 16 + Math.random() * 6; base = 20; speed = 120 + Math.random() * 90;
  } else if (roll < 0.36) { // 크고 느린 호박
    type = 'big'; r = 44 + Math.random() * 10; base = 15; speed = 40 + Math.random() * 40;
  } else {                  // 일반 호박
    type = 'normal'; r = 26 + Math.random() * 14; base = 10; speed = 60 + Math.random() * 90;
  }
  const fromLeft = Math.random() < 0.5;
  pumpkins.push({
    x: fromLeft ? -40 : CANVAS_W + 40,
    baseY: 90 + Math.random() * 280,
    cy: 0,
    vx: (fromLeft ? 1 : -1) * speed,
    bob: Math.random() * Math.PI * 2,
    bobSpeed: 1.5 + Math.random() * 1.5,
    amp: 8 + Math.random() * 8,
    r, type, base,
    face: Math.floor(Math.random() * 4),
  });
}

// ---------- 게임 흐름 ----------
function startGame() {
  state = 'playing';
  score = 0;
  timeLeft = GAME_TIME;
  combo = 0;
  comboTimer = 0;
  arrows = [];
  pumpkins = [];
  particles = [];
  texts = [];
  spawnTimer = 0.3;
  for (let i = 0; i < 3; i++) spawnPumpkin();
  $('start-screen').classList.add('hidden');
  $('end-screen').classList.add('hidden');
  $('hud-time').textContent = GAME_TIME;
  updateHUD();
}

function endGame() {
  state = 'over';
  sfxOver();
  if (score > best) {
    best = score;
    saveBest();
  }
  $('final-score').textContent = score;
  $('final-best').textContent = best;
  $('final-grade').textContent = gradeText(score);
  $('end-screen').classList.remove('hidden');
  updateHUD();
}

function gradeText(s) {
  if (s >= 500) return '👑 호박의 제왕!';
  if (s >= 300) return '🎃 할로윈 마스터!';
  if (s >= 150) return '😈 무서울 정도로 잘해요!';
  if (s >= 50)  return '🎃 무난한 유령!';
  return '🦇 좀 더 연습해봐요!';
}

function updateHUD() {
  $('hud-score').textContent = score;
  $('hud-best').textContent = best;
}

function shoot() {
  if (state !== 'playing') return;
  recoil = 1;
  const speed = 1250;
  const cos = Math.cos(aimAngle), sin = Math.sin(aimAngle);
  arrows.push({
    x: BOW.x + cos * 12,
    y: BOW.y + sin * 12,
    vx: cos * speed,
    vy: sin * speed,
    angle: aimAngle,
    trail: [],
  });
  sfxShoot();
}

function scoreHit(p) {
  combo++;
  comboTimer = 1.8;
  const mult = Math.min(1 + Math.floor(combo / 3), 5);
  const pts = p.base * mult;
  score += pts;
  addText(p.x, p.cy - 26, '+' + pts, p.type === 'gold' ? '#ffd54f' : '#ffffff');
  explode(p.x, p.cy, p.type);
  if (p.type === 'gold') sfxBonus(); else sfxHit();
  if (combo > 0 && combo % 3 === 0) sfxCombo();
  shake = Math.min(shake + 4, 12);
  updateHUD();
}

// ---------- 이펙트 ----------
function explode(x, y, type) {
  const colors = type === 'gold'
    ? ['#ffd54f', '#ffb300', '#fff176', '#ffffff']
    : ['#ff8c1a', '#ffa726', '#e06b0d', '#ffd54f', '#66bb6a', '#ff6b6b'];
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 220;
    const life = 0.6 + Math.random() * 0.5;
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 60,
      r: 2 + Math.random() * 4,
      color: colors[(Math.random() * colors.length) | 0],
      t: 0, maxLife: life,
    });
  }
}

function addText(x, y, txt, color) {
  texts.push({ x, y, txt, color, t: 0 });
}

// ---------- 업데이트 ----------
function update(dt) {
  for (const s of stars) s.tw += dt * s.sp;

  if (state === 'playing') {
    pull = Math.min(1, pull + dt * 5);
    recoil = Math.max(0, recoil - dt * 4);
    shake = Math.max(0, shake - dt * 12);

    // 콤보 감쇠
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    // 타이머
    timeLeft -= dt;
    $('hud-time').textContent = Math.max(0, Math.ceil(timeLeft));
    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }

    // 호박 스폰
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPumpkin();
      spawnTimer = 0.7 + Math.random() * 1.2;
    }

    // 호박 이동
    for (const p of pumpkins) {
      p.x += p.vx * dt;
      p.bob += p.bobSpeed * dt;
      p.cy = p.baseY + Math.sin(p.bob) * p.amp;
    }
    pumpkins = pumpkins.filter((p) => p.x > -80 && p.x < CANVAS_W + 80);

    // 화살 이동
    for (const a of arrows) {
      a.trail.push({ x: a.x, y: a.y });
      if (a.trail.length > 14) a.trail.shift();
      a.vy += 950 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.angle = Math.atan2(a.vy, a.vx);
    }

    // 충돌 판정
    const hitArrows = new Set();
    const hitPumpkins = new Set();
    for (const a of arrows) {
      if (hitArrows.has(a)) continue;
      for (const p of pumpkins) {
        if (hitPumpkins.has(p)) continue;
        const dx = a.x - p.x, dy = a.y - p.cy;
        if (dx * dx + dy * dy < (p.r + 9) * (p.r + 9)) {
          hitArrows.add(a);
          hitPumpkins.add(p);
          scoreHit(p);
          break;
        }
      }
    }
    pumpkins = pumpkins.filter((p) => !hitPumpkins.has(p));
    arrows = arrows.filter(
      (a) => !hitArrows.has(a) && a.x > -80 && a.x < CANVAS_W + 80 && a.y > -80 && a.y < CANVAS_H + 160
    );

    // 콤보 HUD
    const comboEl = $('hud-combo');
    if (combo >= 2) {
      comboEl.classList.remove('hidden');
      comboEl.textContent = '🔥 ' + combo + ' 콤보';
      comboEl.classList.remove('pop');
      void comboEl.offsetWidth;
      comboEl.classList.add('pop');
    } else {
      comboEl.classList.add('hidden');
    }
  }

  // 파티클 / 텍스트
  for (const pt of particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 300 * dt;
  }
  particles = particles.filter((pt) => pt.t < pt.maxLife);
  for (const t of texts) { t.t += dt; t.y -= 30 * dt; }
  texts = texts.filter((t) => t.t < 1);

  // 박쥐
  if (Math.random() < dt * 0.3 && bats.length < 3) spawnBat();
  for (const b of bats) { b.x += b.sp * dt; b.flap += dt * 7; }
  bats = bats.filter((b) => b.x > -80 && b.x < CANVAS_W + 80);
}

// ---------- 그리기 ----------
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();
  if (shake > 0.1) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawSky();
  drawStars();
  drawMoon();
  drawHills();
  drawTrees();
  drawGround();
  drawBats();
  for (const p of pumpkins) drawPumpkin(p);
  drawFlyingArrows();
  drawBow();
  drawParticles();
  drawTexts();
  drawFog();
  drawAim();
  ctx.restore();
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, '#0b0e2a');
  g.addColorStop(0.55, '#1c1740');
  g.addColorStop(0.78, '#3a1d4f');
  g.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawStars() {
  for (const s of stars) {
    const a = 0.35 + Math.sin(s.tw) * 0.35;
    ctx.globalAlpha = Math.max(0.05, a);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon() {
  const mx = 820, my = 95, mr = 52;
  ctx.save();
  ctx.shadowColor = 'rgba(255,244,200,0.9)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(230,210,150,0.5)';
  ctx.beginPath(); ctx.arc(mx - 16, my - 12, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 14, my + 14, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 2, my - 24, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 24, my - 8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHills() {
  ctx.fillStyle = '#140d24';
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  ctx.lineTo(0, 470);
  ctx.quadraticCurveTo(140, 430, 300, 460);
  ctx.quadraticCurveTo(480, 500, 640, 455);
  ctx.quadraticCurveTo(820, 410, 960, 460);
  ctx.lineTo(960, CANVAS_H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1a1030';
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  ctx.lineTo(0, 505);
  ctx.quadraticCurveTo(200, 470, 420, 505);
  ctx.quadraticCurveTo(650, 540, 820, 500);
  ctx.quadraticCurveTo(900, 480, 960, 505);
  ctx.lineTo(960, CANVAS_H);
  ctx.closePath();
  ctx.fill();
}

function drawTree(x, baseY, h) {
  ctx.save();
  ctx.strokeStyle = '#0d0818';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const ang = dir * (0.4 + i * 0.13);
    ctx.beginPath();
    ctx.moveTo(x, baseY - h * 0.35 - i * h * 0.13);
    ctx.quadraticCurveTo(
      x + Math.cos(ang) * h * 0.3, baseY - h * 0.5 - i * h * 0.15,
      x + Math.cos(ang) * h * 0.55, baseY - h * 0.3 - i * h * 0.14
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrees() {
  drawTree(120, 472, 90);
  drawTree(260, 466, 120);
  drawTree(700, 460, 100);
  drawTree(880, 462, 80);
}

function drawGround() {
  ctx.fillStyle = '#0d0918';
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  ctx.lineTo(0, 545);
  for (let x = 0; x <= CANVAS_W; x += 30) {
    ctx.lineTo(x, 545 + Math.sin(x * 0.05) * 5);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#2c2440';
  ctx.lineWidth = 2;
  for (let x = 60; x < CANVAS_W; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, 548);
    ctx.quadraticCurveTo(x + 3, 536, x + 6, 530);
    ctx.moveTo(x + 12, 548);
    ctx.quadraticCurveTo(x + 18, 538, x + 24, 533);
    ctx.stroke();
  }
}

function drawBats() {
  for (const b of bats) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#1a1230';
    const w = Math.sin(b.flap);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-10, w * -12, -22, 2);
    ctx.quadraticCurveTo(-10, w * 10, 0, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10, w * -12, 22, 2);
    ctx.quadraticCurveTo(10, w * 10, 0, 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPumpkin(p) {
  const isGold = p.type === 'gold';
  const base = isGold ? '#ffc107' : '#ff8c1a';
  const dark = isGold ? '#b8860b' : '#c75b0c';
  const r = p.r;
  ctx.save();
  ctx.translate(p.x, p.cy);
  ctx.shadowColor = isGold ? 'rgba(255,215,0,0.85)' : 'rgba(255,140,26,0.7)';
  ctx.shadowBlur = isGold ? 34 : 24;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(-r * 0.5, 0, r * 0.42, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.42, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // 줄기
  ctx.fillStyle = '#5d4a23';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.95, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  drawFace(p, r);
  // 황금 호박 반짝임
  if (isGold) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const t = performance.now() / 300;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      const sx = Math.cos(a) * (r + 8), sy = Math.sin(a) * (r + 8);
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy);
      ctx.lineTo(sx + 5, sy);
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx, sy + 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFace(p, r) {
  ctx.fillStyle = '#231007';
  const es = r * 0.42;
  const ey = -r * 0.12;
  const esz = r * 0.16;
  const mw = r * 0.55;
  const face = p.face % 4;

  const triEye = (x, y, s, dir) => {
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y + s * dir);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
  };

  if (face === 0) {
    // 클래식
    triEye(-es, ey, esz, 1);
    triEye(es, ey, esz, 1);
    ctx.beginPath();
    ctx.moveTo(-mw, r * 0.35);
    for (let i = 0; i <= 4; i++) {
      const mx2 = -mw + (mw * 2 * i) / 4;
      ctx.lineTo(mx2, r * 0.35 + (i % 2 === 0 ? 0 : r * 0.22));
    }
    ctx.closePath();
    ctx.fill();
  } else if (face === 1) {
    // 행복한 얼굴
    triEye(-es, ey, esz, -1);
    triEye(es, ey, esz, -1);
    ctx.strokeStyle = '#231007';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.42, 0, Math.PI);
    ctx.stroke();
  } else if (face === 2) {
    // 졸린 얼굴
    ctx.fillRect(-es - esz * 0.7, ey - 2, esz * 1.4, 5);
    ctx.fillRect(es - esz * 0.7, ey - 2, esz * 1.4, 5);
    ctx.beginPath();
    ctx.arc(0, r * 0.28, esz * 0.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 무서운 얼굴
    triEye(-es, ey, esz * 1.4, 1);
    triEye(es, ey, esz * 1.4, 1);
    ctx.beginPath();
    ctx.moveTo(-mw, r * 0.3);
    ctx.lineTo(-mw * 0.6, r * 0.62);
    ctx.lineTo(-mw * 0.2, r * 0.3);
    ctx.lineTo(mw * 0.2, r * 0.3);
    ctx.lineTo(mw * 0.6, r * 0.62);
    ctx.lineTo(mw, r * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBow() {
  const x = BOW.x, y = BOW.y;
  const nockX = -10 - pull * 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aimAngle);
  const s = 1 - recoil * 0.12;
  ctx.scale(s, s);

  // 활 몸통
  ctx.strokeStyle = '#4a2c12';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.quadraticCurveTo(34, -24, 34, 0);
  ctx.quadraticCurveTo(34, 24, 0, 42);
  ctx.stroke();
  ctx.strokeStyle = '#7a4a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.quadraticCurveTo(34, -24, 34, 0);
  ctx.quadraticCurveTo(34, 24, 0, 42);
  ctx.stroke();

  // 시위
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(nockX, 0);
  ctx.lineTo(0, 42);
  ctx.stroke();

  // 장전된 화살
  ctx.save();
  ctx.translate(nockX, 0);
  drawArrowSprite(1);
  ctx.restore();

  ctx.restore();
}

function drawArrowSprite(k) {
  const len = 46 * k;
  ctx.save();
  // 화살대
  ctx.strokeStyle = '#c8a063';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-len * 0.4, 0);
  ctx.lineTo(len * 0.75, 0);
  ctx.stroke();
  // 촉
  ctx.fillStyle = '#cfd8dc';
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len - 10, -5);
  ctx.lineTo(len - 8, 0);
  ctx.lineTo(len - 10, 5);
  ctx.closePath();
  ctx.fill();
  // 깃털
  ctx.fillStyle = '#ef5350';
  ctx.beginPath();
  ctx.moveTo(-len * 0.35, 0);
  ctx.lineTo(-len * 0.35 - 8, -7);
  ctx.lineTo(-len * 0.35 - 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-len * 0.35, 0);
  ctx.lineTo(-len * 0.35 - 8, 7);
  ctx.lineTo(-len * 0.35 - 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlyingArrows() {
  for (const a of arrows) {
    for (let i = 1; i < a.trail.length; i++) {
      ctx.globalAlpha = (i / a.trail.length) * 0.4;
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.trail[i - 1].x, a.trail[i - 1].y);
      ctx.lineTo(a.trail[i].x, a.trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    drawArrowSprite(1.2);
    ctx.restore();
  }
}

function drawParticles() {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  ctx.textAlign = 'center';
  for (const t of texts) {
    const a = Math.max(0, 1 - t.t);
    ctx.globalAlpha = a;
    ctx.font = 'bold 28px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawFog() {
  fog.t += 0.016;
  for (let i = 0; i < 5; i++) {
    const x = ((i * 230 + fog.t * 14) % (CANVAS_W + 300)) - 150;
    ctx.fillStyle = 'rgba(200,210,230,0.05)';
    ctx.beginPath();
    ctx.ellipse(x, CANVAS_H - 28, 170, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAim() {
  if (state !== 'playing') return;
  const dx = mouse.x - BOW.x, dy = mouse.y - BOW.y;
  if (dx * dx + dy * dy < 30 * 30) return;
  const r = 14;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(mouse.x + Math.cos(a) * (r - 5), mouse.y + Math.sin(a) * (r - 5));
    ctx.lineTo(mouse.x + Math.cos(a) * (r + 5), mouse.y + Math.sin(a) * (r + 5));
    ctx.stroke();
  }
}

// ---------- 메인 루프 ----------
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  aimAngle = Math.atan2(mouse.y - BOW.y, mouse.x - BOW.x);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- 입력 ----------
canvas.addEventListener('mousemove', (e) => {
  const p = toCanvas(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
});

canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  ensureAudio();
  const p = toCanvas(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
  shoot();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  ensureAudio();
  const t = e.touches[0];
  const p = toCanvas(t.clientX, t.clientY);
  mouse.x = p.x; mouse.y = p.y;
  shoot();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const p = toCanvas(t.clientX, t.clientY);
  mouse.x = p.x; mouse.y = p.y;
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    ensureAudio();
    shoot();
  }
});

$('btn-start').addEventListener('click', () => { ensureAudio(); startGame(); });
$('btn-restart').addEventListener('click', () => { ensureAudio(); startGame(); });

// ---------- 시작 ----------
initStars();
resize();
window.addEventListener('resize', resize);
$('hud-best').textContent = best;
requestAnimationFrame(loop);
})();
