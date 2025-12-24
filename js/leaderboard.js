import { apiLeaderboard } from "./api.js";
import { requireSessionOrGuest } from "./state.js";

requireSessionOrGuest();

const $ = (id) => document.getElementById(id);
$("back").addEventListener("click", () => location.href = "menu.html");

function setMsg(t, ok=false){
  $("msg").textContent = t || "";
  $("msg").style.color = ok ? "var(--green)" : "var(--red)";
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rowHTML(r, isMe){
  return `
    <tr class="${isMe ? "me" : ""}">
      <td>${r.rank}</td>
      <td>${escapeHtml(r.username || "Player")}</td>
      <td>${r.bestScore ?? 0}</td>
    </tr>
  `;
}

try{
  setMsg("Loading...", true);

  const data = await apiLeaderboard();
  const top = data.top || [];
  const me  = data.me || null;

  const tbody = $("body");
  tbody.innerHTML = "";

  for(const r of top){
    tbody.insertAdjacentHTML("beforeend", rowHTML(r, !!r.isMe));
  }

  if(me && !me.inTop){
    tbody.insertAdjacentHTML("beforeend",
      `<tr><td colspan="3" style="height:10px;background:rgba(255,255,255,.04)"></td></tr>`
    );
    tbody.insertAdjacentHTML("beforeend", rowHTML(me, true));
  }

  setMsg("");
}catch(e){
  setMsg(e.message || "Failed to load leaderboard.");
}
