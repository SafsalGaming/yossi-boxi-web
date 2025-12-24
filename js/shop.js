import { SKINS } from "./constants.js";
import { apiProfileGet, apiProfilePatch, apiBuySkin } from "./api.js";
import { requireSessionOrGuest, isGuest, getGuestProfile, saveGuestProfile, setCachedProfile } from "./state.js";

requireSessionOrGuest();

const $ = (id) => document.getElementById(id);
$("back").addEventListener("click", () => location.href = "menu.html");

function standUrl(id){ return `assets/skins/${id}/stand.webp`; }

function setMsg(t, ok=false){
  $("msg").textContent = t || "";
  $("msg").style.color = ok ? "var(--green)" : "var(--red)";
}

async function loadProfile(){
  if(isGuest()){
    return getGuestProfile();
  }
  const p = await apiProfileGet();
  setCachedProfile(p);
  return p;
}

async function buySkin(skinId){
  const s = SKINS.find(x => x.id === skinId);
  if(!s) throw new Error("Unknown skin.");

  if(isGuest()){
    const p = getGuestProfile();
    const owned = (p.ownedSkins || []).includes(skinId) || s.price === 0;
    if(owned) return p;
    if((p.coins || 0) < s.price) throw new Error("Not enough coins.");

    p.coins -= s.price;
    p.ownedSkins = [...(p.ownedSkins || []), skinId];
    saveGuestProfile(p);
    return p;
  }

  const updated = await apiBuySkin(skinId);
  setCachedProfile(updated);
  return updated;
}

async function equipSkin(skinId){
  if(isGuest()){
    const p = getGuestProfile();
    p.currentSkin = skinId;
    saveGuestProfile(p);
    return p;
  }
  const updated = await apiProfilePatch({ currentSkin: skinId });
  setCachedProfile(updated);
  return updated;
}

function render(p){
  $("uName").textContent = p.username || "Player";
  $("uCoins").textContent = p.coins ?? 0;
  $("uSkin").textContent = p.currentSkin || "yossi_classic";

  const row = $("grid");
  row.innerHTML = "";

  const ordered = [...SKINS].sort((a,b) => a.price - b.price);

  for(const s of ordered){
    const owned = (p.ownedSkins || []).includes(s.id) || s.price === 0;
    const current = (p.currentSkin === s.id);
    const canBuy = (p.coins || 0) >= s.price;

    const card = document.createElement("div");
    card.className = "skinCard";

    card.innerHTML = `
      <div class="content">
        <div class="row" style="justify-content:space-between">
          <div class="pill">${s.name}</div>
          ${owned ? `<span class="badge">Owned</span>` : `<span class="badge locked">Locked</span>`}
        </div>

        <div style="height:10px"></div>
        <img class="skinImg" src="${standUrl(s.id)}" alt="${s.name}" />

        <div style="height:10px"></div>

        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <div class="small">${s.price === 0 ? "Free" : `${s.price} coins`}</div>
          <div class="row" style="gap:8px">
            ${
              !owned
                ? `<button class="btn success" data-act="buy" data-id="${s.id}" ${canBuy ? "" : "disabled"}>${canBuy ? "Buy" : "Need coins"}</button>`
                : current
                  ? `<button class="btn" disabled>Equipped</button>`
                  : `<button class="btn primary" data-act="equip" data-id="${s.id}">Equip</button>`
            }
          </div>
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
        btn.disabled = true;

        let updated = p;
        if(act === "buy"){
          updated = await buySkin(id);
          setMsg("Purchased!", true);
        }else if(act === "equip"){
          updated = await equipSkin(id);
          setMsg("Equipped!", true);
        }

        p = updated;
        render(p);
      }catch(err){
        setMsg(err.message || "Failed.");
        render(p);
      }
    });

    row.appendChild(card);
  }
}

try{
  let p = await loadProfile();
  render(p);
}catch(e){
  setMsg(e.message || "Failed to load shop.");
}
