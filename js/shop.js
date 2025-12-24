import { SKINS } from "./constants.js";
import { apiProfileGet, apiProfilePatch, apiBuySkin } from "./api.js";
import { requireSessionOrGuest, isGuest, getGuestProfile, saveGuestProfile, setCachedProfile } from "./state.js";

requireSessionOrGuest();

const $ = (id) => document.getElementById(id);
$("back").addEventListener("click", () => location.href = "menu.html");

function standUrl(id){ return `assets/skins/${id}/stand.webp`; }

function setMsg(t, ok=false){
  $("msg").textContent = t || "";
  $("msg").style.color = ok ? "var(--ok)" : "var(--danger)";
}

async function loadProfile(){
  if(isGuest()) return getGuestProfile();
  const p = await apiProfileGet();
  setCachedProfile(p);
  return p;
}

async function saveCurrentSkin(p, skinId){
  if(isGuest()){
    p.currentSkin = skinId;
    if(!p.ownedSkins.includes("yossi_classic")) p.ownedSkins.push("yossi_classic");
    saveGuestProfile(p);
    return p;
  }
  const updated = await apiProfilePatch({ currentSkin: skinId });
  setCachedProfile(updated);
  return updated;
}

async function buy(p, skinId){
  if(isGuest()){
    const s = SKINS.find(x=>x.id===skinId);
    if(!s) throw new Error("skin?");
    if(p.ownedSkins.includes(skinId)) return p;
    if((p.coins||0) < s.price) throw new Error("אין מספיק מטבעות");
    p.coins -= s.price;
    p.ownedSkins = Array.from(new Set([...(p.ownedSkins||[]), skinId, "yossi_classic"]));
    saveGuestProfile(p);
    return p;
  }

  const updated = await apiBuySkin(skinId);
  setCachedProfile(updated);
  return updated;
}

function render(p){
  $("uName").textContent = p.username || "Player";
  $("uCoins").textContent = p.coins ?? 0;
  $("uSkin").textContent = p.currentSkin || "yossi_classic";

  const grid = $("grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = window.innerWidth < 860 ? "1fr" : "1fr 1fr";

  for(const s of SKINS){
    const owned = (p.ownedSkins || []).includes(s.id) || s.price === 0;
    const current = (p.currentSkin === s.id);

    const card = document.createElement("div");
    card.className = "card";
    card.style.borderRadius = "14px";

    card.innerHTML = `
      <div class="content">
        <div class="row" style="gap:10px">
          <div class="pill">${s.name}</div>
          ${owned ? `<span class="badge">Owned</span>` : `<span class="badge locked">Locked</span>`}
        </div>

        <div style="height:10px"></div>
        <img src="${standUrl(s.id)}" style="width:100%;max-height:280px;object-fit:contain;filter:drop-shadow(0 18px 22px rgba(0,0,0,.6))" />

        <div style="height:10px"></div>

        <div class="row" style="gap:10px;flex-wrap:wrap">
          <div class="pill">מחיר: ${s.price}</div>
          <button class="btn ${current ? "primary" : ""}" data-act="select" data-id="${s.id}">
            ${current ? "Selected" : "Select"}
          </button>
          ${
            owned ? "" :
            `<button class="btn primary" data-act="buy" data-id="${s.id}">Buy</button>`
          }
        </div>
      </div>
    `;

    card.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button");
      if(!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;

      try{
        setMsg("");
        if(act === "buy"){
          setMsg("קונה...", true);
          p = await buy(p, id);
          setMsg("נרכש!", true);
          render(p);
        }
        if(act === "select"){
          if(!(p.ownedSkins||[]).includes(id) && SKINS.find(x=>x.id===id)?.price>0){
            return setMsg("אין לך את הסקין הזה");
          }
          setMsg("מעדכן סקין...", true);
          p = await saveCurrentSkin(p, id);
          setMsg("עודכן!", true);
          render(p);
        }
      }catch(err){
        setMsg(err.message || "נכשל");
      }
    });

    grid.appendChild(card);
  }
}

let profile = await loadProfile();
if(!profile.ownedSkins?.includes("yossi_classic")) profile.ownedSkins = ["yossi_classic", ...(profile.ownedSkins||[])];
render(profile);
