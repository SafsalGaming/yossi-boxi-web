import { HEART_URL } from "./constants.js";
import { apiProfileGet, apiSubmitRun } from "./api.js";
import { requireSessionOrGuest, isGuest, getGuestProfile, saveGuestProfile, setCachedProfile } from "./state.js";

requireSessionOrGuest();

const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  skinName: document.getElementById("skinName"),
  hearts: document.getElementById("hearts"),
  over: document.getElementById("over"),
  finalScore: document.getElementById("finalScore"),
  finalCoins: document.getElementById("finalCoins"),
  toMenu: document.getElementById("toMenu"),
  pauseBtn: document.getElementById("pauseBtn"),
  backBtn: document.getElementById("backBtn"),
};

const W = cvs.width, H = cvs.height;

function pctFromBottom(pct){ return H * (1 - pct/100); }

const SETTINGS = {
  lanesPct: { bottom: 20, middle: 43, top: 55 },
  player: { sizePx: 300, baseHeightPct: 18 },
  enemy:  { sizePx: 70 },
  hitRangePx: 220,
  timing: { idleCycleSec: 0.7, attackHoldMs: 200 },
};

let lanes = [];
let ENEMY_SIZE = 70;
let HIT_RANGE = 220;

const player = {
  x: W/2,
  baseY: 0,
  drawW: 0, drawH: 0,
  facing: 1,
  lastAtk: 0,
  atkDur: 200,
  pose: "stand",
  idleT: 0,
};

function applyLayout(){
  lanes = [
    { name:"low",  y: pctFromBottom(SETTINGS.lanesPct.bottom) },
    { name:"mid",  y: pctFromBottom(SETTINGS.lanesPct.middle) },
    { name:"high", y: pctFromBottom(SETTINGS.lanesPct.top) },
  ];
  player.baseY = pctFromBottom(SETTINGS.player.baseHeightPct);
  player.drawW = player.drawH = SETTINGS.player.sizePx;
  ENEMY_SIZE = SETTINGS.enemy.sizePx;
  HIT_RANGE = SETTINGS.hitRangePx;
  player.atkDur = SETTINGS.timing.attackHoldMs;
}
applyLayout();

let paused = false;
ui.pauseBtn.addEventListener("click", () => paused = !paused);
ui.backBtn.addEventListener("click", () => location.href = "menu.html");
ui.toMenu.addEventListener("click", () => location.href = "menu.html");

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if(k === " "){ e.preventDefault(); paused = !paused; return; }
  if(e.key === "ArrowLeft" || k === "a") punch(-1);
  if(e.key === "ArrowRight" || k === "d") punch(1);
});

/* assets */
async function loadBitmap(url){
  if("createImageBitmap" in window){
    const r = await fetch(url, { cache:"force-cache" });
    if(!r.ok) throw new Error("asset " + url);
    const b = await r.blob();
    return await createImageBitmap(b);
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const SKIN_IDS = ["yossi_classic","yossi_bossi","yossi_dossi","yoyo_yossi"];

function skinPaths(id){
  return {
    name:id,
    stand:      `assets/skins/${id}/stand.webp`,
    crouch:     `assets/skins/${id}/crouch.webp`,
    top_hit:    `assets/skins/${id}/top_hit.webp`,
    middle_hit: `assets/skins/${id}/middle_hit.webp`,
    bottom_hit: `assets/skins/${id}/bottom_hit.webp`,
  };
}

async function loadSkinBitmaps(id){
  const p = skinPaths(id);
  const [stand,crouch,top,middle,bottom] = await Promise.all([
    loadBitmap(p.stand),
    loadBitmap(p.crouch),
    loadBitmap(p.top_hit),
    loadBitmap(p.middle_hit),
    loadBitmap(p.bottom_hit),
  ]);
  return { name:id, stand, crouch, top_hit:top, middle_hit:middle, bottom_hit:bottom };
}

async function loadEnemyBitmaps(){
  return await Promise.all([1,2,3].map(n => loadBitmap(`assets/enemy${n}.webp`)));
}

/* hearts */
let hp = 3;
function renderHearts(){
  ui.hearts.innerHTML = "";
  for(let i=0;i<hp;i++){
    const im = document.createElement("img");
    im.src = HEART_URL;
    im.alt = "heart";
    ui.hearts.appendChild(im);
  }
}

/* game state */
let enemies = [];
let score = 0;
let coinsEarned = 0;
let alive = true;
let hurtUntil = 0;

let spawnTimer = 0;
let spawnRate = 800;
let speedBase = 250;

function reset(){
  enemies.length = 0;
  score = 0;
  coinsEarned = 0;
  hp = 3;
  alive = true;
  paused = false;
  spawnTimer = 0;
  spawnRate = 800;
  speedBase = 250;
  player.lastAtk = 0;
  player.pose = "stand";
  player.facing = 1;
  player.idleT = 0;
  ui.over.style.display = "none";
  renderHearts();
}

function spawn(){
  const side = Math.random() < 0.5 ? -1 : 1;
  const laneIdx = Math.floor(Math.random() * 3);
  const x = side < 0 ? -ENEMY_SIZE : W + ENEMY_SIZE;
  const v = speedBase + Math.random() * 100;
  const spriteIdx = Math.floor(Math.random() * 3);
  enemies.push({
    side, lane: laneIdx,
    x, y: lanes[laneIdx].y,
    w: ENEMY_SIZE, h: ENEMY_SIZE,
    speed: v, sprite: spriteIdx,
    dead:false, removeAt:0, cause:"",
  });
}

/* simple hit sound */
let ACtx = null;
function ctxAudio(){ if(!ACtx) ACtx = new (window.AudioContext||window.webkitAudioContext)(); return ACtx; }
function playHit(){
  const a = ctxAudio();
  const dur = 0.08;
  const rate = a.sampleRate;
  const frames = Math.floor(rate * dur);
  const buf = a.createBuffer(1, frames, rate);
  const data = buf.getChannelData(0);
  for(let i=0;i<frames;i++) data[i] = (Math.random()*2-1) * (1 - i/frames);

  const src = a.createBufferSource(); src.buffer = buf;
  const filt = a.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=700;
  const gain = a.createGain(); gain.gain.value = 0.6;

  src.connect(filt); filt.connect(gain); gain.connect(a.destination);
  src.start();
}

function update(dt){
  const now = performance.now();
  const attacking = (now - player.lastAtk) <= player.atkDur;

  if(!attacking){
    player.idleT += dt;
    const cycle = Math.max(0.1, SETTINGS.timing.idleCycleSec);
    const phase = (player.idleT % cycle) / cycle;
    player.pose = phase < 0.5 ? "stand" : "crouch";
  }

  spawnTimer += dt * 1000;
  if(spawnTimer >= spawnRate){
    spawnTimer = 0;
    spawn();
  }

  const center = player.x;

  for(const e of enemies){
    if(e.dead){
      if(e.cause === "byPlayer"){
        e.y -= 240 * dt;
        e.x += e.side * 140 * dt;
        e.w *= 0.985; e.h *= 0.985;
      }
      continue;
    }

    const dir = e.x < center ? 1 : -1;
    e.x += dir * e.speed * dt;

    if(Math.abs(e.x - center) < 26){
      e.dead = true;
      e.cause = "hitPlayer";
      e.removeAt = now + 90;

      playHit();
      hurtUntil = now + 220;

      hp--;
      renderHearts();

      if(hp <= 0){
        alive = false;
        endGame();
      }
    }
  }

  enemies = enemies.filter(e => {
    if(e.cause === "hitPlayer" && e.removeAt && now >= e.removeAt) return false;
    if(e.cause === "byPlayer" && (e.y < -120 || e.x < -220 || e.x > W + 220)) return false;
    return true;
  });
}

function punch(dir){
  if(!alive || paused) return;
  const now = performance.now();
  if(now - player.lastAtk < player.atkDur) return;

  player.lastAtk = now;
  player.facing = dir;

  const center = player.x;
  let target = null;
  let best = 1e9;

  for(const e of enemies){
    if(e.dead) continue;
    const correctSide = dir < 0 ? e.x < center : e.x > center;
    if(!correctSide) continue;
    const d = Math.abs(e.x - center);
    if(d < best){ best = d; target = e; }
  }

  const laneWanted = target ? target.lane : 1;
  player.pose = laneWanted === 2 ? "top_hit" : laneWanted === 1 ? "middle_hit" : "bottom_hit";

  const stamp = player.lastAtk;
  setTimeout(() => {
    if(!paused && player.lastAtk === stamp){
      player.pose = "stand";
      player.idleT = 0;
    }
  }, player.atkDur);

  if(target && Math.abs(target.x - center) <= HIT_RANGE){
    target.dead = true;
    target.cause = "byPlayer";
    score += 10;
    coinsEarned += 5;

    if(spawnRate > 420) spawnRate -= 10;
    speedBase += 1;
  }
}

/* draw */
function drawPlayer(){
  const dw = player.drawW, dh = player.drawH;

  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(player.x, H-50, 50, 14, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.save();
  ctx.translate(player.x, 0);
  if(player.facing < 0) ctx.scale(-1,1);

  const img = skin[player.pose] || skin.stand;
  if(img) ctx.drawImage(img, -dw/2, player.baseY - dh, dw, dh);

  if(performance.now() < hurtUntil){
    const prev = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(-dw/2, player.baseY - dh, dw, dh);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prev;
  }

  ctx.restore();
}

function drawEnemies(){
  for(const e of enemies){
    const img = enemyImgs[e.sprite];
    const dw = e.w, dh = e.h;
    ctx.save();
    if(e.side < 0){
      ctx.translate(e.x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -dw/2, e.y - dh, dw, dh);
    }else{
      ctx.drawImage(img, e.x - dw/2, e.y - dh, dw, dh);
    }
    ctx.restore();
  }
}

function drawPause(){
  ctx.fillStyle="rgba(0,0,0,0.45)";
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(255,255,255,0.92)";
  ctx.font="bold 28px system-ui";
  ctx.textAlign="center";
  ctx.fillText("PAUSED", W/2, H/2);
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawPlayer();
  drawEnemies();
  if(paused && alive) drawPause();
  ui.score.textContent = String(score);
}

/* end + submit */
async function endGame(){
  ui.finalScore.textContent = String(score);
  ui.finalCoins.textContent = String(coinsEarned);
  ui.over.style.display = "flex";

  if(isGuest()){
    const g = getGuestProfile();
    g.coins = (g.coins || 0) + coinsEarned;
    g.bestScore = Math.max(g.bestScore || 0, score);
    saveGuestProfile(g);
    return;
  }

  try{
    const updated = await apiSubmitRun(score, coinsEarned);
    setCachedProfile(updated);
  }catch{
    // אם נכשל, לא שובר את המסך
  }
}

/* boot */
let skin = null;
let enemyImgs = null;

async function loadProfile(){
  if(isGuest()) return getGuestProfile();
  const p = await apiProfileGet();
  setCachedProfile(p);
  return p;
}

const profile = await loadProfile();
const skinId = profile.currentSkin || "yossi_classic";
ui.skinName.textContent = skinId;

enemyImgs = await loadEnemyBitmaps();
skin = await loadSkinBitmaps(skinId);

reset();

let tPrev = performance.now();
function loop(){
  const now = performance.now();
  const dt = Math.min(0.03, (now - tPrev) / 1000);
  tPrev = now;

  if(alive && !paused) update(dt);
  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
