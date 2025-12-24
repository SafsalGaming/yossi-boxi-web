import { HEART_URL } from "./constants.js";
import { apiProfileGet, apiSubmitRun } from "./api.js";
import {
  requireSessionOrGuest,
  isGuest,
  getGuestProfile,
  saveGuestProfile,
  setCachedProfile,
  setPendingRun,
  clearPendingRun
} from "./state.js";

requireSessionOrGuest();

const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
const loader = document.getElementById("loader");

const ui = {
  score: document.getElementById("score"),
  coins: document.getElementById("coins"),
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
  drawW: 0,
  drawH: 0,
  facing: 1,
  pose: "stand",
  idleT: 0,
  atkDur: 200,
  attackEnd: 0,
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
addEventListener("resize", applyLayout);

/* assets */
function isImgReady(img){
  return !!img && img.complete && img.naturalWidth > 0;
}

function loadImg(src){
  const img = new Image();
  img.src = src;
  img.addEventListener("error", () => console.error("[IMG FAIL]", src), { once:true });
  return img;
}

function waitImg(img){
  return new Promise((resolve) => {
    if(!img) return resolve();
    if(isImgReady(img)) return resolve();
    img.addEventListener("load", () => resolve(), { once:true });
    img.addEventListener("error", () => resolve(), { once:true });
  });
}

const enemyImgs = [1,2,3].map(n => loadImg(`assets/enemy${n}.webp`));
const heartImg = loadImg(HEART_URL);

function loadSkin(name){
  return {
    name,
    stand:      loadImg(`assets/skins/${name}/stand.webp`),
    crouch:     loadImg(`assets/skins/${name}/crouch.webp`),
    top_hit:    loadImg(`assets/skins/${name}/top_hit.webp`),
    middle_hit: loadImg(`assets/skins/${name}/middle_hit.webp`),
    bottom_hit: loadImg(`assets/skins/${name}/bottom_hit.webp`),
  };
}

let skinId = "yossi_classic";
if(isGuest()){
  skinId = getGuestProfile().currentSkin || "yossi_classic";
}else{
  try{
    const p = await apiProfileGet();
    setCachedProfile(p);
    skinId = p.currentSkin || "yossi_classic";
  }catch{}
}

let skin = loadSkin(skinId);

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

/* sound */
let ACtx = null;
function ctxAudio(){ if(!ACtx) ACtx = new (window.AudioContext||window.webkitAudioContext)(); return ACtx; }
function playEnemyHitPlayer(){
  const ctxA = ctxAudio();
  const dur = 0.08, rate = ctxA.sampleRate, frames = Math.floor(rate*dur);
  const buf = ctxA.createBuffer(1, frames, rate);
  const data = buf.getChannelData(0);
  for(let i=0;i<frames;i++) data[i] = (Math.random()*2-1) * (1 - i/frames);
  const src = ctxA.createBufferSource(); src.buffer = buf;
  const filt = ctxA.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 700;
  const gain = ctxA.createGain(); gain.gain.value = 0.6;
  src.connect(filt); filt.connect(gain); gain.connect(ctxA.destination);
  src.start();
}

/* game state */
let enemies = [];
let coinsEarned = 0;
let scoreF = 0;
let score = 0;

let alive = true;
let paused = false;
let hurtUntil = 0;

let spawnTimer = 0;
let spawnRate = 800;
let speedBase = 250;

let committed = false;
let prevAttacking = false;

function currentRun(){
  return { score: Math.floor(scoreF), coinsEarned: Math.floor(coinsEarned) };
}
function hasProgress(r){
  return (r.score > 0) || (r.coinsEarned > 0);
}

async function commitRun(){
  if(committed) return;
  committed = true;

  const run = currentRun();
  if(!hasProgress(run)) return;

  setPendingRun(run);

  if(isGuest()){
    const g = getGuestProfile();
    g.coins = (g.coins || 0) + run.coinsEarned;
    g.bestScore = Math.max(g.bestScore || 0, run.score);
    saveGuestProfile(g);
    clearPendingRun();
    return;
  }

  try{
    const updated = await apiSubmitRun(run.score, run.coinsEarned);
    setCachedProfile(updated);
    clearPendingRun();
  }catch{
    // keep pending, menu will retry
  }
}

async function exitToMenu(){
  await commitRun();
  location.href = "menu.html";
}

ui.backBtn.addEventListener("click", exitToMenu);
ui.toMenu.addEventListener("click", exitToMenu);
ui.pauseBtn.addEventListener("click", () => paused = !paused);

addEventListener("beforeunload", () => {
  if(committed) return;
  const run = currentRun();
  if(hasProgress(run)) setPendingRun(run);
});

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if(k === " "){
    e.preventDefault();
    paused = !paused;
    return;
  }
  if(k === "escape"){
    exitToMenu();
    return;
  }
  if(e.key === "ArrowLeft" || k === "a") punch(-1);
  if(e.key === "ArrowRight" || k === "d") punch(1);
});

/* spawn */
function spawn(){
  const side = Math.random() < 0.5 ? -1 : 1;
  const laneIdx = Math.floor(Math.random() * 3);
  const x = side < 0 ? -ENEMY_SIZE : W + ENEMY_SIZE;
  const v = speedBase + Math.random() * 100;
  const spriteIdx = Math.floor(Math.random() * 3);
  enemies.push({
    side, lane: laneIdx, x, y: lanes[laneIdx].y,
    w: ENEMY_SIZE, h: ENEMY_SIZE, speed: v,
    sprite: spriteIdx, dead:false, removeAt:0, cause:""
  });
}

/* logic */
function update(dt){
  const now = performance.now();

  scoreF += dt * 5;
  score = Math.floor(scoreF);

  const attacking = now < player.attackEnd;

  if(!attacking && prevAttacking){
    player.pose = "stand";
    player.idleT = 0;
  }

  if(!attacking){
    player.idleT += dt;
    const cycle = Math.max(0.12, SETTINGS.timing.idleCycleSec);
    const phase = (player.idleT % cycle) / cycle;
    player.pose = phase < 0.5 ? "stand" : "crouch";
  }
  prevAttacking = attacking;

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
      playEnemyHitPlayer();
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
  if(now < player.attackEnd) return;

  player.facing = dir;

  const center = player.x;
  let target = null, best = 1e9;
  for(const e of enemies){
    if(e.dead) continue;
    const correctSide = dir < 0 ? e.x < center : e.x > center;
    if(!correctSide) continue;
    const d = Math.abs(e.x - center);
    if(d < best){ best = d; target = e; }
  }

  const laneWanted = target ? target.lane : 1;
  player.pose = laneWanted === 2 ? "top_hit" : laneWanted === 1 ? "middle_hit" : "bottom_hit";
  player.attackEnd = now + player.atkDur;

  if(target && Math.abs(target.x - center) <= HIT_RANGE){
    target.dead = true;
    target.cause = "byPlayer";

    coinsEarned += 1;

    if(spawnRate > 420) spawnRate -= 10;
    speedBase += 1;
  }
}

async function endGame(){
  ui.finalScore.textContent = String(score);
  ui.finalCoins.textContent = String(coinsEarned);
  ui.over.style.display = "flex";
  await commitRun();
}

/* draw */
function drawPausedOverlay(){
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.font = "1000 64px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSED", W/2, H/2);
}

function draw(){
  ctx.clearRect(0,0,W,H);

  drawPlayer();
  drawEnemies();

  if(paused && alive){
    drawPausedOverlay();
  }

  ui.score.textContent = String(score);
  ui.coins.textContent = String(coinsEarned);
}

function drawPlayer(){
  const img = skin[player.pose];
  const dw = player.drawW, dh = player.drawH;

  ctx.save();
  ctx.translate(player.x, 0);
  if(player.facing < 0) ctx.scale(-1, 1);

  if(isImgReady(img)){
    ctx.drawImage(img, -dw/2, player.baseY - dh, dw, dh);
  }

  if(performance.now() < hurtUntil && isImgReady(img)){
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
      if(isImgReady(img)) ctx.drawImage(img, -dw/2, e.y - dh, dw, dh);
    }else{
      if(isImgReady(img)) ctx.drawImage(img, e.x - dw/2, e.y - dh, dw, dh);
    }
    ctx.restore();
  }
}

/* loop */
function reset(){
  enemies.length = 0;
  coinsEarned = 0;
  scoreF = 0;
  score = 0;

  alive = true;
  paused = false;
  hp = 3;
  renderHearts();

  hurtUntil = 0;
  spawnTimer = 0;
  spawnRate = 800;
  speedBase = 250;

  player.pose = "stand";
  player.idleT = 0;
  player.attackEnd = 0;

  committed = false;
  prevAttacking = false;
  ui.over.style.display = "none";
}

async function preloadAll(){
  const list = [
    ...enemyImgs,
    heartImg,
    skin.stand, skin.crouch, skin.top_hit, skin.middle_hit, skin.bottom_hit
  ];
  await Promise.all(list.map(waitImg));
}

await preloadAll();
renderHearts();
loader?.remove();

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

