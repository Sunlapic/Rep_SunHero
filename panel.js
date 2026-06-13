const API = "https://rep-sunhero.onrender.com";
const ui = document.getElementById("ui");

// ── Безопасная функция подсказки ──
function showHint(text) {
  const el = document.getElementById("hint");
  if (el) el.textContent = text;
}

// ── Fallback копирование (работает на мобиле) ──
function copyCmd(cmd) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd)
      .then(() => showHint("Скопировано: " + cmd + " — вставь в чат!"))
      .catch(() => fallbackCopy(cmd));
  } else {
    fallbackCopy(cmd);
  }
}

function fallbackCopy(cmd) {
  const ta = document.createElement("textarea");
  ta.value = cmd;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try {
    document.execCommand("copy");
    showHint("Скопировано: " + cmd + " — вставь в чат!");
  } catch {
    showHint("Напиши в чат: " + cmd);
  }
  document.body.removeChild(ta);
}

// ── Загрузка с timeout + retry ──
let loadTimer = null;

async function load() {
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(API + "/api/players", {
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(abortTimeout);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data);
    if (!list || list.length === 0) {
      ui.innerHTML = '<p class="hint">Нет игроков. Напишите !join</p>';
      return;
    }
    render(list[0]);
  } catch (e) {
    clearTimeout(abortTimeout);
    const msg = e.name === "AbortError" ? "Timeout (сервер спит, повтор...)" : e.message;
    ui.innerHTML = '<p class="error">Ошибка: ' + msg + '</p>';
    if (e.name === "AbortError") {
      loadTimer = setTimeout(load, 5000);
    }
  }
}

function statHints(p) {
  const c = p.class || "warrior";
  const h = { str:"+10 HP +1.5 атк", agi:"+1 атк +увернт", int:"+1 атк +0.5 МЗ" };
  if (c === "warrior") h.str = "+14 HP +2 атк +0.8 брн";
  if (c === "archer")  h.agi = "+2 атк +скорость +уворот";
  if (c === "wizard")  h.int = "+2.5 атк +0.8 МЗ";
  return h;
}

function render(p) {
  const lvl  = (p.class_levels && p.class_levels[p.class]) || 1;
  const pts  = (p.class_attr_points && p.class_attr_points[p.class]) || 0;
  const hp   = p.max_hp ? Math.round(p.hp / p.max_hp * 100) : 0;
  const aps  = p.attack_spd ? (60 / p.attack_spd).toFixed(1) : "-";
  const h    = statHints(p);

  ui.innerHTML = `
    <div class="card">
      <div class="name">${p.username ?? "-"}</div>
      <div class="cls">${p.class ?? "-"} · ${lvl} ур</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hp}%"></div></div>
      <div class="hp-text">❤ ${p.hp ?? 0} / ${p.max_hp ?? 0}</div>
      <div class="row">🪙 Золото <b>${p.gold ?? 0}</b></div>
      <div class="row">⚔ Атака · СкА <b>${p.damage ?? 0} · ${aps}/с</b></div>
      <div class="row">🛡 Броня · МЗ <b>${p.armor ?? 0} · ${p.magic_res ?? 0}</b></div>
      <div class="row">✨ Очки атрибутов <b>${pts}</b></div>
      <div class="stats">
        <button class="stat-btn" onclick="copyCmd('!str')">
          💪 STR ${p.strength ?? 0}<small>${h.str}</small>
        </button>
        <button class="stat-btn" onclick="copyCmd('!agi')">
          🏃 AGI ${p.agility ?? 0}<small>${h.agi}</small>
        </button>
        <button class="stat-btn" onclick="copyCmd('!int')">
          🔮 INT ${p.intellect ?? 0}<small>${h.int}</small>
        </button>
      </div>
      <div id="hint" class="hint">кнопка копирует команду — вставь в чат</div>
    </div>
  `;
}

// Инициализация через Twitch Helper
if (window.Twitch && window.Twitch.ext) {
  window.Twitch.ext.onAuthorized(function() { load(); });
  window.Twitch.ext.onContext(function(ctx) {
    document.body.className = ctx.theme === "dark" ? "dark" : "light";
  });
} else {
  // Fallback если helper не загрузился
  load();
}

setInterval(load, 5000);
