import { DEFAULT_PROFILE } from "./constants.js";

const K_SESSION = "yossi_session_v1";
const K_GUEST   = "yossi_guest_profile_v1";
const K_CACHE   = "yossi_cached_profile_v1";
const K_PENDING = "yossi_pending_run_v1";

function safeParse(s){
  try{ return JSON.parse(s); }catch{ return null; }
}

function uid(){
  if(globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "g_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function setSession(sess){
  localStorage.setItem(K_SESSION, JSON.stringify({ ...sess, t: Date.now() }));
}

export function getSession(){
  return safeParse(localStorage.getItem(K_SESSION) || "") || null;
}

export function isGuest(){
  return getSession()?.mode === "guest";
}

export function requireSessionOrGuest(){
  const s = getSession();
  if(!s || !s.mode) location.href = "index.html";
}

export function setCachedProfile(p){
  localStorage.setItem(K_CACHE, JSON.stringify({ ...p, t: Date.now() }));
}

export function getCachedProfile(){
  return safeParse(localStorage.getItem(K_CACHE) || "") || null;
}

export function ensureGuest(){
  let p = safeParse(localStorage.getItem(K_GUEST) || "");
  if(!p){
    p = { ...DEFAULT_PROFILE, uid: uid(), username: "Guest" };
    localStorage.setItem(K_GUEST, JSON.stringify(p));
  }
  if(!p.ownedSkins?.includes("yossi_classic")){
    p.ownedSkins = ["yossi_classic", ...(p.ownedSkins || [])];
    localStorage.setItem(K_GUEST, JSON.stringify(p));
  }
  return p;
}

export function saveGuestProfile(p){
  localStorage.setItem(K_GUEST, JSON.stringify(p));
}

export function getGuestProfile(){
  return ensureGuest();
}

/* pending run (save on exit) */
export function setPendingRun(run){
  localStorage.setItem(K_PENDING, JSON.stringify({ ...run, t: Date.now() }));
}
export function getPendingRun(){
  return safeParse(localStorage.getItem(K_PENDING) || "") || null;
}
export function clearPendingRun(){
  localStorage.removeItem(K_PENDING);
}
