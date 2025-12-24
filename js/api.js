import { getToken } from "./firebaseAuth.js";

const BASE = "/.netlify/functions";

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function tokenWithRetry(){
  for(let i=0;i<12;i++){
    const t = await getToken();
    if(t) return t;
    await sleep(120);
  }
  return "";
}

async function parseMaybeJson(text){
  try{ return JSON.parse(text); }catch{ return null; }
}

async function callFn(path, { method="GET", body=null, authMode="required" } = {}){
  const headers = {};
  let token = "";

  if(authMode !== "none"){
    token = await tokenWithRetry();
    if(!token && authMode === "required"){
      throw new Error("לא מחובר (אין טוקן). תעשה רענון ותנסה שוב.");
    }
    if(token) headers.Authorization = "Bearer " + token;
  }

  if(body !== null){
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === null ? null : JSON.stringify(body),
    cache: "no-store"
  });

  const text = await res.text();
  const j = await parseMaybeJson(text);

  if(!res.ok){
    throw new Error(j?.error || j?.message || text || `${res.status} ${res.statusText}`);
  }

  return j ?? {};
}

export const apiProfileGet   = () => callFn("/profile", { method:"GET", authMode:"required" });
export const apiProfilePatch = (patch) => callFn("/profile", { method:"PATCH", body: patch, authMode:"required" });

export const apiBuySkin      = (skinId) => callFn("/buySkin", { method:"POST", body:{ skinId }, authMode:"required" });
export const apiSubmitRun    = (score, coinsEarned) => callFn("/submitRun", { method:"POST", body:{ score, coinsEarned }, authMode:"required" });

// בלידרבורד אפשר גם כאורח, ואם יש טוקן הוא יוסיף "me"
export const apiLeaderboard  = () => callFn("/leaderboard", { method:"GET", authMode:"optional" });
