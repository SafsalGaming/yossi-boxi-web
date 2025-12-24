import { logout } from "./firebaseAuth.js";
import { apiProfileGet } from "./api.js";
import { requireSessionOrGuest, getSession, isGuest, getGuestProfile, setCachedProfile, getCachedProfile } from "./state.js";

requireSessionOrGuest();

const $ = (id) => document.getElementById(id);

async function loadProfile(){
  if(isGuest()){
    return getGuestProfile();
  }
  const cached = getCachedProfile();
  if(cached) return cached;
  const p = await apiProfileGet();
  setCachedProfile(p);
  return p;
}

function skinStandUrl(skinId){
  return `assets/skins/${skinId}/stand.webp`;
}

const sess = getSession();
$("modeBadge").textContent = sess.mode === "guest" ? "Guest" : "Online";

$("btnLogout").addEventListener("click", async () => {
  if(isGuest()){
    localStorage.removeItem("yossi_session_v1");
    location.href = "index.html";
    return;
  }
  await logout();
  localStorage.removeItem("yossi_session_v1");
  location.href = "index.html";
});

$("btnStart").addEventListener("click", () => location.href = "game.html");
$("btnShop").addEventListener("click", () => location.href = "shop.html");
$("btnLb").addEventListener("click", () => location.href = "leaderboard.html");

const p = await loadProfile();
$("uName").textContent = p.username || "Player";
$("uCoins").textContent = p.coins ?? 0;
$("uBest").textContent = p.bestScore ?? 0;
$("skinImg").src = skinStandUrl(p.currentSkin || "yossi_classic");
