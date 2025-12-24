import { initAuthPersistence, login, register } from "./firebaseAuth.js";
import { apiProfileGet, apiProfilePatch } from "./api.js";
import { setSession, setCachedProfile, ensureGuest, saveGuestProfile } from "./state.js";

const $ = (id) => document.getElementById(id);

function validEmail(s){
  return /^[^@]+@[^@]+\.[^@]+$/.test(String(s || "").trim());
}
function validPassword(s){
  return String(s || "").length >= 8;
}
function validUsername(s){
  const t = String(s || "").trim();
  if(t.length < 3 || t.length > 16) return false;
  return /^[a-zA-Z0-9_]+$/.test(t);
}

function msg(el, text, ok=false){
  el.textContent = text || "";
  el.style.color = ok ? "var(--ok)" : "var(--danger)";
}

await initAuthPersistence();

$("btnLogin").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const pass  = $("loginPass").value;

  if(!validEmail(email)) return msg($("loginMsg"), "אימייל לא תקין");
  if(!validPassword(pass)) return msg($("loginMsg"), "סיסמה חייבת לפחות 8 תווים");

  msg($("loginMsg"), "מתחבר...", true);

  try{
    await login(email, pass);
    const profile = await apiProfileGet();

    setSession({ mode:"auth", uid: profile.uid });
    setCachedProfile(profile);

    location.href = "menu.html";
  }catch(e){
    msg($("loginMsg"), e.message || "נכשל");
  }
});

$("btnRegister").addEventListener("click", async () => {
  const username = $("regUser").value.trim();
  const email = $("regEmail").value.trim();
  const pass  = $("regPass").value;

  if(!validUsername(username)) return msg($("regMsg"), "שם משתמש: 3-16 תווים, רק אותיות/מספרים/_");
  if(!validEmail(email)) return msg($("regMsg"), "אימייל לא תקין");
  if(!validPassword(pass)) return msg($("regMsg"), "סיסמה חייבת לפחות 8 תווים");

  msg($("regMsg"), "נרשם...", true);

  try{
    await register(email, pass);

    // יוצר פרופיל ב-Firestore דרך Netlify function
    const profile = await apiProfileGet();
    const patched = await apiProfilePatch({ username });

    setSession({ mode:"auth", uid: patched.uid });
    setCachedProfile(patched);

    location.href = "menu.html";
  }catch(e){
    msg($("regMsg"), e.message || "נכשל");
  }
});

$("btnGuest").addEventListener("click", () => {
  const g = ensureGuest();
  saveGuestProfile(g);
  setSession({ mode:"guest", uid: g.uid });
  location.href = "menu.html";
});
