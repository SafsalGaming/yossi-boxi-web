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

const loader = document.getElementById("loader");

function hideLoader(){ loader?.remove(); }

function domReady(){
  if(document.readyState !== "loading") return Promise.resolve();
  return new Promise(r => document.addEventListener("DOMContentLoaded", r, { once:true }));
}

function getEl(id){
  return document.getElementById(id);
}

function mustEl(id){
  const el = getEl(id);
  if(!el) throw new Error(`Missing element #${id} in menu.html`);
  return el;
}

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

(async function main(){
  try{
    await domReady();

    const uName = mustEl("uName");
    const uCoins = mustEl("uCoins");
    const uBest = mustEl("uBest");
    const skinImg = mustEl("skinImg");

    const btnLogout = mustEl("btnLogout");
    const btnStart = mustEl("btnStart");
    const btnShop = mustEl("btnShop");
    const btnLb = mustEl("btnLb");

    btnLogout.addEventListener("click", async () => {
      try{ await logout(); }catch{}
      localStorage.removeItem("yossi_session_v1");
      localStorage.removeItem("yossi_cached_profile_v1");
      location.href = "index.html";
    });

    btnStart.addEventListener("click", () => location.href = "game.html");
    btnShop.addEventListener("click", () => location.href = "shop.html");
    btnLb.addEventListener("click", () => location.href = "leaderboard.html");

    let p = await loadProfile();
    p = await applyPendingRun(p);

    uName.textContent = p.username || "Player";
    uCoins.textContent = p.coins ?? 0;
    uBest.textContent  = p.bestScore ?? 0;

    skinImg.src = skinStandUrl(p.currentSkin || "yossi_classic");
    await waitImage(skinImg);

  }catch(err){
    // אם זה NO_SESSION_REDIRECT - אל תבלבל את עצמך, זה פשוט עצר את הקוד כמו שרצינו
    if(String(err?.message || "").includes("NO_SESSION_REDIRECT")) return;

    console.error(err);
    // שלא תיתקע על Loading
    alert(err.message || "Menu failed to load. Check console.");
  }finally{
    hideLoader();
  }
})();
