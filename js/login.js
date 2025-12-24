import { initAuthPersistence, login, register } from "./firebaseAuth.js";
import { apiProfileGet, apiProfilePatch } from "./api.js";
import { setSession, setCachedProfile, ensureGuest } from "./state.js";

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

function msg(el, t, ok=false){
  el.textContent = t || "";
  el.style.color = ok ? "var(--green)" : "var(--red)";
}

await initAuthPersistence();

$("btnLogin").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const pass  = $("loginPass").value;

  if(!validEmail(email)) return msg($("loginMsg"), "Enter a valid email.");
  if(!validPassword(pass)) return msg($("loginMsg"), "Password must be at least 8 characters.");

  try{
    msg($("loginMsg"), "Signing in...", true);
    await login(email, pass);

    const profile = await apiProfileGet();
    setSession({ mode:"auth", uid: profile.uid });
    setCachedProfile(profile);

    location.href = "menu.html";
  }catch(e){
    msg($("loginMsg"), e.message || "Login failed.");
  }
});

$("btnRegister").addEventListener("click", async () => {
  const username = $("regUser").value.trim();
  const email    = $("regEmail").value.trim();
  const pass     = $("regPass").value;

  if(!validUsername(username)) return msg($("regMsg"), "Username: 3-16, letters/numbers/_ only.");
  if(!validEmail(email)) return msg($("regMsg"), "Enter a valid email.");
  if(!validPassword(pass)) return msg($("regMsg"), "Password must be at least 8 characters.");

  try{
    msg($("regMsg"), "Creating account...", true);
    await register(email, pass);

    const base = await apiProfileGet();
    const updated = await apiProfilePatch({ username });

    setSession({ mode:"auth", uid: updated.uid || base.uid });
    setCachedProfile(updated);

    location.href = "menu.html";
  }catch(e){
    msg($("regMsg"), e.message || "Register failed.");
  }
});

$("btnGuest").addEventListener("click", () => {
  const g = ensureGuest();
  setSession({ mode:"guest", uid: g.uid });
  location.href = "menu.html";
});
