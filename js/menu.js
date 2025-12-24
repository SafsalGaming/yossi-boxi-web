import { logout } from "./firebaseAuth.js";
import { apiProfileGet, apiSubmitRun } from "./api.js";
import {
  requireSessionOrGuest,
  isGuest,
  getGuestProfile,
  saveGuestProfile,
  setCachedProfile,
  getCachedProfile,
  getPendingRun,
  clearPendingRun
} from "./state.js";

requireSessionOrGuest();

const $ = (id) => document.getElementById(id);
const loader = document.getElementById("loader");

function hideLoader(){ loader?.remove(); }

function waitImage(imgEl){
  return new Promise((resolve) => {
    if(!imgEl) return resolve();
    if(imgEl.complete && imgEl.naturalWidth > 0) return resolve();
    imgEl.onload = () => resolve();
    imgEl.onerror = () => resolve();
  });
}

function skinStandUrl(id){ return `assets/skins/${id}/stand.webp`; }

async function loadProfile(){
  if(isGuest()) return getGuestProfile();
  const cached = getCachedProfile();
  if(cached) return cached;
  const p = await apiProfileGet();
  setCachedProfile(p);
  return p;
}

async function applyPendingRun(p){
  const run = getPendingRun();
  if(!run) return p;

  const score = Math.max(0, Math.floor(run.score || 0));
  const coinsEarned = Math.max(0, Math.floor(run.coinsEarned || 0));
  if(score === 0 && coinsEarned === 0){
    clearPendingRun();
    return p;
  }

  if(isGuest()){
    const g = getGuestProfile();
    g.coins = (g.coins || 0) + coinsEarned;
    g.bestScore = Math.max(g.bestScore || 0, score);
    saveGuestProfile(g);
    clearPendingRun();
    return g;
  }

  try{
    const updated = await apiSubmitRun(score, coinsEarned);
    setCachedProfile(updated);
    clearPendingRun();
    return updated;
  }catch{
    return p; // keep pending, will retry next load
  }
}

function render(p){
  $("uName").textContent = p.username || "Player";
  $("uCoins").textContent = p.coins ?? 0;
  $("uBest").textContent  = p.bestScore ?? 0;

  const img = $("skinImg");
  img.src = skinStandUrl(p.currentSkin || "yossi_classic");
  return img;
}

$("btnLogout").addEventListener("click", async () => {
  try{ await logout(); }catch{}
  localStorage.removeItem("yossi_session_v1");
  localStorage.removeItem("yossi_cached_profile_v1");
  location.href = "index.html";
});

$("btnStart").addEventListener("click", () => location.href = "game.html");
$("btnShop").addEventListener("click", () => location.href = "shop.html");
$("btnLb").addEventListener("click", () => location.href = "leaderboard.html");

let p = await loadProfile();
p = await applyPendingRun(p);

const skinImgEl = render(p);
await waitImage(skinImgEl);
hideLoader();

// silent refresh (no weird flashes)
if(!isGuest()){
  try{
    const fresh = await apiProfileGet();
    setCachedProfile(fresh);
    render(fresh);
  }catch{}
}
