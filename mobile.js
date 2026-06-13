const API = "https://rep-sunhero.onrender.com";
const POLL_MS = 5000;
const FETCH_TIMEOUT_MS = 12000;

const ui = document.getElementById("ui");

let isLoading = false;
let pollTimer = null;
let lastPlayerName = null;

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const forcedName = qs("name");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value, digits = 0) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "-";

  if (Number.isInteger(n)) return String(n);

  return n
    .toFixed(digits)
    .replace(/\.?0+$/, "");
}

function hpPercent(p) {
  const hp = toNum(p.hp, 0);
  const max = toNum(p.max_hp, 0);

  if (max <= 0) return 0;

  return clamp(Math.round((hp / max) * 100), 0, 100);
}

function attackPerSecond(p) {
  const cooldownFrames = toNum(p.attack_spd, 0);

  if (cooldownFrames <= 0) return "-";

  return fmt(60 / cooldownFrames, 1);
}

function currentClass(p) {
  return p.class || "warrior";
}

function currentLevel(p) {
  const cls = currentClass(p);
  return toNum(p.class_levels && p.class_levels[cls], 1);
}

function currentPoints(p) {
  const cls = currentClass(p);
  return toNum(p.class_attr_points && p.class_attr_points[cls], 0);
}

function statHints(p) {
  const cls = currentClass(p);

  const h = {
    str: "+10 HP +1.5 атк",
    agi: "+1 атк +уворот",
    int: "+1 атк +0.5 МЗ"
  };

  if (cls === "warrior") {
    h.str = "+14 HP +2 атк +броня";
  }

  if (cls === "archer") {
    h.agi = "+2 атк +скорость +уворот";
  }

  if (cls === "wizard") {
    h.int = "+2.5 атк +МЗ";
  }

  return h;
}

function showHint(text) {
  const el = document.getElementById("hint");
  if (el) el.textContent = text;
}

async function copyCommand(cmd) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(cmd);
      showHint("✓ Скопировано: " + cmd + " — вставь в чат");
      return;
    }

    fallbackCopy(cmd);
  } catch {
    fallbackCopy(cmd);
  }
}

function fallbackCopy(cmd) {
  try {
    const ta = document.createElement("textarea");

    ta.value = cmd;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";

    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    document.execCommand("copy");
    document.body.removeChild(ta);

    showHint("✓ Скопировано: " + cmd + " — вставь в чат");
  } catch {
    showHint("Напиши в чат: " + cmd);
  }
}

async function fetchJson(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function playerUrl() {
  if (forcedName) {
    return API + "/api/player/" + encodeURIComponent(forcedName);
  }

  return API + "/api/players";
}

async function getPlayer() {
  const data = await fetchJson(playerUrl());

  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return data[0];
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
}

function renderEmpty() {
  ui.className = "empty";
  ui.innerHTML = `
    <div>
      Нет игроков.<br>
      Напишите <b>!join</b> в чат.
    </div>
    <div class="mini">Ожидание данных от игры...</div>
  `;
}

function renderError(err) {
  const msg = err && err.name === "AbortError"
    ? "Timeout: сервер долго отвечает. Возможно Render просыпается."
    : (err && err.message ? err.message : "unknown error");

  ui.className = "error";
  ui.innerHTML = `
    <div><b>Ошибка загрузки</b></div>
    <div>${escapeHtml(msg)}</div>
    <div class="mini">Проверить backend: /health</div>
  `;
}

function renderPlayer(p) {
  lastPlayerName = p.username || lastPlayerName;

  const cls = currentClass(p);
  const lvl = currentLevel(p);
  const pts = currentPoints(p);
  const hpPct = hpPercent(p);
  const aps = attackPerSecond(p);
  const hints = statHints(p);

  ui.className = "";
  ui.innerHTML = `
    <div class="card">
      <div class="top">
        <div class="name">${escapeHtml(p.username || "-")}</div>
        <div class="class">${escapeHtml(cls)} · ${fmt(lvl)} ур.</div>
      </div>

      <div class="hpbar">
        <div class="hpfill" style="width:${hpPct}%"></div>
        <div class="hptext">❤ ${fmt(p.hp)} / ${fmt(p.max_hp)}</div>
      </div>

      <div class="grid">
        <div class="stat">
          <div class="label">Золото</div>
          <div class="value gold">🪙 ${fmt(p.gold)}</div>
        </div>

        <div class="stat">
          <div class="label">Атака · СкА</div>
          <div class="value">⚔ ${fmt(p.damage, 1)} · ${aps}/с</div>
        </div>

        <div class="stat">
          <div class="label">Броня · МЗ</div>
          <div class="value">🛡 ${fmt(p.armor, 1)} · ${fmt(p.magic_res, 1)}</div>
        </div>

        <div class="stat">
          <div class="label">Очки атрибутов</div>
          <div class="value points">✨ ${fmt(pts)}</div>
        </div>
      </div>

      <div class="btns">
        <button class="btn b-str" data-cmd="!str 1">
          СИЛА ${fmt(p.strength)}
          <small>${escapeHtml(hints.str)}</small>
        </button>

        <button class="btn b-agi" data-cmd="!agi 1">
          ЛОВКОСТЬ ${fmt(p.agility)}
          <small>${escapeHtml(hints.agi)}</small>
        </button>

        <button class="btn b-int" data-cmd="!int 1">
          ИНТЕЛЛЕКТ ${fmt(p.intellect)}
          <small>${escapeHtml(hints.int)}</small>
        </button>
      </div>

      <div class="hint" id="hint">
        Нажми кнопку — команда скопируется. Потом вставь её в чат.
      </div>

      <div class="mini">
        Обновление каждые ${Math.round(POLL_MS / 1000)} сек.
      </div>
    </div>
  `;

  bindButtons();
}

function bindButtons() {
  document.querySelectorAll("[data-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
      copyCommand(btn.dataset.cmd);
    });
  });
}

async function load() {
  if (isLoading) return;

  isLoading = true;

  try {
    const player = await getPlayer();

    if (!player) {
      renderEmpty();
    } else {
      renderPlayer(player);
    }
  } catch (err) {
    renderError(err);
  } finally {
    isLoading = false;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);

  load();
  pollTimer = setInterval(load, POLL_MS);
}

function initTwitch() {
  if (window.Twitch && window.Twitch.ext) {
    window.Twitch.ext.onAuthorized(() => {
      startPolling();
    });

    window.Twitch.ext.onContext((ctx) => {
      if (ctx && ctx.theme) {
        document.body.className = ctx.theme === "light" ? "light" : "dark";
      }
    });

    setTimeout(() => {
      if (!pollTimer) startPolling();
    }, 1500);
  } else {
    startPolling();
  }
}

initTwitch();
