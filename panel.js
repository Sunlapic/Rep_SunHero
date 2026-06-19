(function () {
  "use strict";

  var API = "https://rep-sunhero.onrender.com";
  var POLL_MS = 5000;
  var TIMEOUT_MS = 12000;

  var ui = document.getElementById("ui");

  var twitchToken = "";
  var twitchReady = false;

  var pollTimer = null;
  var currentXhr = null;

  var firstLoadDone = false;
  var lastRenderKey = "";
  var lastErrorKey = "";

  var presenceTimer = null; // ✅ НОВОЕ

  var currentView = "stats";
  var currentPlayerData = null;

  function setUI(html, className) {
    if (!ui) {
      ui = document.getElementById("ui");
    }

    if (!ui) return;

    ui.className = className || "box";
    ui.innerHTML = html;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === '"') return "&quot;";
      if (ch === "'") return "&#039;";
      return ch;
    });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function toNum(value, fallback) {
    var n = Number(value);

    if (isFinite(n) && !isNaN(n)) {
      return n;
    }

    return fallback || 0;
  }

  function fmt(value, digits) {
    var n = Number(value);

    if (!isFinite(n) || isNaN(n)) {
      return "-";
    }

    if (Math.floor(n) === n) {
      return String(n);
    }

    return n.toFixed(digits || 0).replace(/\.?0+$/, "");
  }

  function hpPercent(p) {
    var hp = toNum(p.hp, 0);
    var max = toNum(p.max_hp, 0);

    if (max <= 0) {
      return 0;
    }

    return clamp(Math.round((hp / max) * 100), 0, 100);
  }

  function attackPerSecond(p) {
    var cooldownFrames = toNum(p.attack_spd, 0);

    if (cooldownFrames <= 0) {
      return "-";
    }

    return fmt(60 / cooldownFrames, 1);
  }

  function firstNumber(p, names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var key = names[i];

      if (p && p[key] !== undefined && p[key] !== null) {
        var n = Number(p[key]);

        if (isFinite(n) && !isNaN(n)) {
          return n;
        }
      }
    }

    return fallback || 0;
  }

  function dodgePercent(p) {
    var raw = firstNumber(p, [
      "dodge_percent",
      "dodgePercent",
      "dodge_chance",
      "dodgeChance",
      "evasion_percent",
      "evasionPercent",
      "evasion",
      "dodge"
    ], 0);

    if (raw > 0 && raw <= 1) {
      raw = raw * 100;
    }

    return fmt(raw, 1) + "%";
  }

  function critPercent(p) {
    var raw = firstNumber(p, [
      "crit_chance",
      "critChance",
      "crit_percent",
      "critPercent"
    ], 0);

    if (raw > 0 && raw <= 1) {
      raw = raw * 100;
    }

    return fmt(raw, 1) + "%";
  }

  function currentClass(p) {
    return p["class"] || "warrior";
  }

  function currentLevel(p) {
    var cls = currentClass(p);

    if (p.class_levels && p.class_levels[cls] !== undefined) {
      return toNum(p.class_levels[cls], 1);
    }

    return 1;
  }

  function currentPoints(p) {
    var cls = currentClass(p);

    if (p.class_attr_points && p.class_attr_points[cls] !== undefined) {
      return toNum(p.class_attr_points[cls], 0);
    }

    return 0;
  }

  function statHints(p) {
    var cls = currentClass(p);

    var h = {
      str: "+10 HP +1.5 атаки",
      agi: "+1 атака +уворот",
      int: "+1 атака +0.5 маг. защиты"
    };

    if (cls === "warrior") {
      h.str = "+14 HP +2 атаки +броня";
    }

    if (cls === "archer") {
      h.agi = "+2 атаки +скорость +уворот";
    }

    if (cls === "wizard") {
      h.int = "+2.5 атаки +маг. защита";
    }

    return h;
  }

  function arrayHas(arr, value) {
    if (!Array.isArray(arr)) return false;

    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i]) === String(value)) {
        return true;
      }
    }

    return false;
  }

  function skillTreeDefs() {
    return {
      warrior: [
        { id: "war_tank_1",    title: "Железная кожа I",  desc: "+4 брони",                              branch: "tank",    tier: 1, cost: 1, requires: [] },
        { id: "war_tank_2",    title: "Стойкое тело",     desc: "+50 HP",                                branch: "tank",    tier: 2, cost: 1, requires: ["war_tank_1"] },
        { id: "war_tank_3",    title: "Железная кожа II", desc: "+6 брони, +3 маг. защиты",             branch: "tank",    tier: 3, cost: 1, requires: ["war_tank_2"] },
        { id: "war_tank_4",    title: "Колосс",           desc: "+90 HP, +8 брони",                      branch: "tank",    tier: 4, cost: 1, requires: ["war_tank_3"] },

        { id: "war_berserk_1", title: "Тяжёлый удар",     desc: "+5 урона",                              branch: "berserk", tier: 1, cost: 1, requires: [] },
        { id: "war_berserk_2", title: "Боевой ритм",      desc: "Атака быстрее на 2 кадра",             branch: "berserk", tier: 2, cost: 1, requires: ["war_berserk_1"] },
        { id: "war_berserk_3", title: "Палач",            desc: "+6 урона, +0.20 крит. урона",          branch: "berserk", tier: 3, cost: 1, requires: ["war_berserk_2"] },
        { id: "war_berserk_4", title: "Кровавая ярость",  desc: "+12 урона, атака быстрее на 3 кадра",  branch: "berserk", tier: 4, cost: 1, requires: ["war_berserk_3"] },

        { id: "war_duel_1",    title: "Острый клинок I",  desc: "+3% шанса крита",                       branch: "duel",    tier: 1, cost: 1, requires: [] },
        { id: "war_duel_2",    title: "Устойчивая стойка",desc: "+4% уворота",                           branch: "duel",    tier: 2, cost: 1, requires: ["war_duel_1"] },
        { id: "war_duel_3",    title: "Острый клинок II", desc: "+5% шанса крита",                       branch: "duel",    tier: 3, cost: 1, requires: ["war_duel_2"] },
        { id: "war_duel_4",    title: "Мастер дуэли",     desc: "+0.25 крит. урона, +6% уворота",       branch: "duel",    tier: 4, cost: 1, requires: ["war_duel_3"] }
      ],

      archer: [
        { id: "arc_speed_1",   title: "Быстрые пальцы I", desc: "Атака быстрее на 2 кадра",             branch: "speed", tier: 1, cost: 1, requires: [] },
        { id: "arc_speed_2",   title: "Быстрые пальцы II",desc: "Атака быстрее на 3 кадра",             branch: "speed", tier: 2, cost: 1, requires: ["arc_speed_1"] },
        { id: "arc_speed_3",   title: "Лёгкая тетива",    desc: "+1 к скорости стрелы",                  branch: "speed", tier: 3, cost: 1, requires: ["arc_speed_2"] },
        { id: "arc_speed_4",   title: "Стальной дождь",   desc: "Атака быстрее на 4 кадра, +1 к скорости стрелы", branch: "speed", tier: 4, cost: 1, requires: ["arc_speed_3"] },

        { id: "arc_crit_1",    title: "Орлиный глаз I",   desc: "+4% шанса крита",                       branch: "crit",  tier: 1, cost: 1, requires: [] },
        { id: "arc_crit_2",    title: "Зазубренные наконечники", desc: "+0.15 крит. урона",             branch: "crit",  tier: 2, cost: 1, requires: ["arc_crit_1"] },
        { id: "arc_crit_3",    title: "Орлиный глаз II",  desc: "+6% шанса крита",                       branch: "crit",  tier: 3, cost: 1, requires: ["arc_crit_2"] },
        { id: "arc_crit_4",    title: "Сердцеед",         desc: "+4% шанса крита, +0.25 крит. урона",   branch: "crit",  tier: 4, cost: 1, requires: ["arc_crit_3"] },

        { id: "arc_range_1",   title: "Длинный лук",      desc: "+28 к дальности атаки",                 branch: "range", tier: 1, cost: 1, requires: [] },
        { id: "arc_range_2",   title: "Устойчивая стойка",desc: "+70 к дальности полёта стрелы",        branch: "range", tier: 2, cost: 1, requires: ["arc_range_1"] },
        { id: "arc_range_3",   title: "Соколиный взор",   desc: "+42 к дальности атаки",                 branch: "range", tier: 3, cost: 1, requires: ["arc_range_2"] },
        { id: "arc_range_4",   title: "Снайпер",          desc: "+60 к дальности атаки, +120 к дальности стрелы, +3% крита", branch: "range", tier: 4, cost: 1, requires: ["arc_range_3"] }
      ],

      wizard: [
        { id: "wiz_fire_1",    title: "Пламя души",       desc: "+6 урона",                              branch: "fire",  tier: 1, cost: 1, requires: [] },
        { id: "wiz_fire_2",    title: "Воспламенение",    desc: "+4% шанса крита",                       branch: "fire",  tier: 2, cost: 1, requires: ["wiz_fire_1"] },
        { id: "wiz_fire_3",    title: "Мастер огня",      desc: "+10 урона",                             branch: "fire",  tier: 3, cost: 1, requires: ["wiz_fire_2"] },
        { id: "wiz_fire_4",    title: "Катаклизм",        desc: "+12 урона, +0.30 крит. урона",         branch: "fire",  tier: 4, cost: 1, requires: ["wiz_fire_3"] },

        { id: "wiz_range_1",   title: "Дальний каст",     desc: "+24 к дальности атаки",                 branch: "range", tier: 1, cost: 1, requires: [] },
        { id: "wiz_range_2",   title: "Дальний фокус",    desc: "+80 к дальности фаербола",              branch: "range", tier: 2, cost: 1, requires: ["wiz_range_1"] },
        { id: "wiz_range_3",   title: "Быстрое пламя",    desc: "+1.5 к скорости фаербола",              branch: "range", tier: 3, cost: 1, requires: ["wiz_range_2"] },
        { id: "wiz_range_4",   title: "Арканный размах",  desc: "+50 к дальности атаки, +130 к дальности фаербола", branch: "range", tier: 4, cost: 1, requires: ["wiz_range_3"] },

        { id: "wiz_ward_1",    title: "Магический покров",desc: "+4 маг. защиты",                        branch: "ward",  tier: 1, cost: 1, requires: [] },
        { id: "wiz_ward_2",    title: "Арканное тело",    desc: "+40 HP",                                branch: "ward",  tier: 2, cost: 1, requires: ["wiz_ward_1"] },
        { id: "wiz_ward_3",    title: "Отражающий барьер",desc: "+6 маг. защиты, +3 брони",             branch: "ward",  tier: 3, cost: 1, requires: ["wiz_ward_2"] },
        { id: "wiz_ward_4",    title: "Щит архимага",     desc: "+10 маг. защиты, +3% шанса крита",     branch: "ward",  tier: 4, cost: 1, requires: ["wiz_ward_3"] }
      ]
    };
  }

  function branchTitle(cls, branch) {
    var map = {
      warrior: {
        tank: "Ветка ТАНКА",
        berserk: "Ветка БЕРСЕРКА",
        duel: "Ветка ДУЭЛЯНТА"
      },
      archer: {
        speed: "Ветка СКОРОСТРЕЛА",
        crit: "Ветка КРИТА",
        range: "Ветка ДАЛЬНОБОЙНОСТИ"
      },
      wizard: {
        fire: "Ветка ОГНЯ",
        range: "Ветка ДАЛЬНОСТИ",
        ward: "Ветка ЗАЩИТЫ"
      }
    };

    if (map[cls] && map[cls][branch]) {
      return map[cls][branch];
    }

    return branch;
  }

  function currentSkillNodes(p) {
    var cls = currentClass(p);

    if (!p || !p.class_skill_nodes || !Array.isArray(p.class_skill_nodes[cls])) {
      return [];
    }

    return p.class_skill_nodes[cls];
  }

  function currentTreeDefs(p) {
    var defs = skillTreeDefs();
    var cls = currentClass(p);

    if (defs && defs[cls]) {
      return defs[cls];
    }

    return [];
  }

  function skillPointsEarned(p) {
    return Math.max(0, Math.floor(currentLevel(p) / 5));
  }

  function skillPointsSpent(p) {
    var opened = currentSkillNodes(p);
    var defs = currentTreeDefs(p);
    var spent = 0;

    for (var i = 0; i < defs.length; i++) {
      if (arrayHas(opened, defs[i].id)) {
        spent += toNum(defs[i].cost, 1);
      }
    }

    return spent;
  }

  function skillPointsFree(p) {
    return Math.max(0, skillPointsEarned(p) - skillPointsSpent(p));
  }

  function requirementsMet(opened, node) {
    var reqs = node.requires || [];

    for (var i = 0; i < reqs.length; i++) {
      if (!arrayHas(opened, reqs[i])) {
        return false;
      }
    }

    return true;
  }

  function nodeState(p, node) {
    var opened = currentSkillNodes(p);

    if (arrayHas(opened, node.id)) {
      return "opened";
    }

    if (!requirementsMet(opened, node)) {
      return "locked_req";
    }

    if (skillPointsFree(p) < toNum(node.cost, 1)) {
      return "locked_points";
    }

    return "available";
  }

  function viewTabsHtml(view) {
    function tabStyle(active) {
      return active
        ? "background:linear-gradient(135deg,#7c3aed,#a855f7);border:1px solid rgba(255,255,255,0.22);"
        : "background:linear-gradient(135deg,#2b2238,#3a2e50);border:1px solid rgba(255,255,255,0.12);";
    }

    return (
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
        '<button class="btn" data-view="stats" style="' + tabStyle(view === "stats") + '">Персонаж</button>' +
        '<button class="btn" data-view="skills" style="' + tabStyle(view === "skills") + '">Дерево скилов</button>' +
      '</div>'
    );
  }

  function playerKey(p) {
    return JSON.stringify({
      view: currentView,
      username: p.username,
      class: p["class"],

      gold: p.gold,

      hp: p.hp,
      max_hp: p.max_hp,

      damage: p.damage,
      armor: p.armor,
      magic_res: p.magic_res,
      attack_spd: p.attack_spd,
      crit_chance: p.crit_chance,
      crit_mult: p.crit_mult,

      dodge: p.dodge,
      dodge_chance: p.dodge_chance,
      dodge_percent: p.dodge_percent,
      evasion: p.evasion,
      evasion_percent: p.evasion_percent,

      strength: p.strength,
      agility: p.agility,
      intellect: p.intellect,

      class_levels: p.class_levels,
      class_exp: p.class_exp,
      class_attr_points: p.class_attr_points,
      class_skill_nodes: p.class_skill_nodes,

      kills: p.kills,
      updatedAt: p.updatedAt
    });
  }

  function showHint(text) {
    var el = document.getElementById("hint");

    if (el) {
      el.textContent = text;
    }
  }

  function copyCommand(cmd) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd)
          .then(function () {
            showHint("✓ Скопировано: " + cmd + " — вставь в чат");
          })
          .catch(function () {
            fallbackCopy(cmd);
          });

        return;
      }

      fallbackCopy(cmd);
    } catch (e) {
      fallbackCopy(cmd);
    }
  }

  function fallbackCopy(cmd) {
    try {
      var ta = document.createElement("textarea");

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
    } catch (e) {
      showHint("Напиши в чат: " + cmd);
    }
  }

  /* =========================
     ✅ НОВОЕ: PRESENCE HEARTBEAT
     Сообщаем бэкенду что зритель онлайн
  ========================= */

  function sendPresence() {
    if (!twitchReady || !twitchToken) return;
    if (!isViewerLinked()) return;

    var xhr = new XMLHttpRequest();

    try {
      xhr.open("POST", API + "/api/presence", true);
      xhr.timeout = 8000;

      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("x-extension-jwt", twitchToken);

      xhr.send(JSON.stringify({ platform: "panel" }));
    } catch (e) {}
  }

  function startPresence() {
    if (presenceTimer) return;

    sendPresence();
    presenceTimer = setInterval(sendPresence, 15000);
  }

  // ✅ КОНЕЦ НОВОЕ

  function sendAction(stat, amount) {
    if (!twitchReady || !twitchToken) {
      showHint("Twitch ещё не готов. Попробуй через секунду.");
      return;
    }

    var xhr = new XMLHttpRequest();
    var finished = false;

    function done(message) {
      if (finished) return;

      finished = true;
      showHint(message);
    }

    try {
      xhr.open("POST", API + "/api/action", true);
      xhr.timeout = TIMEOUT_MS;

      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("x-extension-jwt", twitchToken);

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;

        var data = null;

        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
          done("✓ Команда отправлена в игру");

          setTimeout(function () {
            lastRenderKey = "";
            load();
          }, 2000);

          return;
        }

        if (data && data.needJoin) {
          done("Сначала напиши !join в чат");
          return;
        }

        if (data && data.needIdentity) {
          done("Нужно разрешить Twitch ID");
          return;
        }

        if (data && data.error === "too many pending actions") {
          done("Слишком много команд в очереди. Подожди.");
          return;
        }

        if (data && data.error) {
          done("Ошибка: " + data.error);
          return;
        }

        done("Ошибка отправки команды");
      };

      xhr.onerror = function () {
        done("Ошибка сети");
      };

      xhr.ontimeout = function () {
        done("Timeout отправки");
      };

      xhr.send(JSON.stringify({
        stat: stat,
        amount: amount || 1
      }));
    } catch (e) {
      done("Ошибка: " + e.message);
    }
  }

  function sendSkillUnlock(playerClass, nodeId) {
    if (!twitchReady || !twitchToken) {
      showHint("Twitch ещё не готов. Попробуй через секунду.");
      return;
    }

    var xhr = new XMLHttpRequest();
    var finished = false;

    function done(message) {
      if (finished) return;

      finished = true;
      showHint(message);
    }

    try {
      xhr.open("POST", API + "/api/action", true);
      xhr.timeout = TIMEOUT_MS;

      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("x-extension-jwt", twitchToken);

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;

        var data = null;

        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
          done("✓ Узел дерева отправлен в игру");

          setTimeout(function () {
            lastRenderKey = "";
            load();
          }, 2500);

          return;
        }

        if (data && data.needJoin) {
          done("Сначала напиши !join в чат");
          return;
        }

        if (data && data.needIdentity) {
          done("Нужно разрешить Twitch ID");
          return;
        }

        if (data && data.error === "too many pending actions") {
          done("Слишком много команд в очереди. Подожди.");
          return;
        }

        if (data && data.error) {
          done("Ошибка: " + data.error);
          return;
        }

        done("Ошибка отправки узла");
      };

      xhr.onerror = function () {
        done("Ошибка сети");
      };

      xhr.ontimeout = function () {
        done("Timeout отправки");
      };

      xhr.send(JSON.stringify({
        type: "skill_unlock",
        "class": playerClass,
        node_id: nodeId
      }));
    } catch (e) {
      done("Ошибка: " + e.message);
    }
  }

  function requestJsonWithJwt(url, done, fail) {
    if (currentXhr) {
      try {
        currentXhr.abort();
      } catch (e) {}

      currentXhr = null;
    }

    var xhr = new XMLHttpRequest();
    currentXhr = xhr;

    var finished = false;

    function cleanup() {
      if (currentXhr === xhr) {
        currentXhr = null;
      }
    }

    function endError(message) {
      if (finished) return;

      finished = true;
      cleanup();
      fail(new Error(message));
    }

    function endOk(data) {
      if (finished) return;

      finished = true;
      cleanup();
      done(data);
    }

    try {
      xhr.open("GET", url, true);
      xhr.timeout = TIMEOUT_MS;

      xhr.setRequestHeader("Accept", "application/json");

      if (twitchToken) {
        xhr.setRequestHeader("x-extension-jwt", twitchToken);
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || finished) return;

        var data = null;

        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = null;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          if (data) {
            endOk(data);
            return;
          }

          endError("HTTP " + xhr.status);
          return;
        }

        if (!data) {
          endError("JSON parse error");
          return;
        }

        endOk(data);
      };

      xhr.onerror = function () {
        endError("Network error / CORS / CSP");
      };

      xhr.ontimeout = function () {
        endError("Timeout: сервер не ответил за " + Math.round(TIMEOUT_MS / 1000) + " сек.");
      };

      xhr.onabort = function () {
        cleanup();
      };

      xhr.send(null);
    } catch (e) {
      endError(e.message || "XHR error");
    }
  }

  function isViewerLinked() {
    try {
      if (!window.Twitch || !window.Twitch.ext || !window.Twitch.ext.viewer) {
        return false;
      }

      return Boolean(window.Twitch.ext.viewer.isLinked);
    } catch (e) {
      return false;
    }
  }

  function renderNeedIdentity() {
    var key = "need-identity";

    if (lastRenderKey === key) return;

    lastRenderKey = key;
    lastErrorKey = "";

    setUI(
      '<div><b>Нужно разрешение Twitch</b></div>' +
      '<div class="mini">Чтобы показать именно твоего персонажа, разреши расширению видеть твой Twitch ID.</div>' +
      '<div class="btns">' +
      '<button class="btn b-open" id="identityBtn">Разрешить Twitch ID</button>' +
      '</div>' +
      '<div class="hint" id="hint">После разрешения панель загрузит твоего персонажа автоматически.</div>',
      "empty"
    );

    var btn = document.getElementById("identityBtn");

    if (btn) {
      btn.addEventListener("click", function () {
        try {
          showHint("Открываю окно разрешения Twitch...");

          if (window.Twitch && window.Twitch.ext && window.Twitch.ext.actions) {
            window.Twitch.ext.actions.requestIdShare();
          } else {
            showHint("Twitch helper недоступен.");
          }
        } catch (e) {
          renderError(e);
        }
      });
    }
  }

  function renderNeedJoin() {
    var key = "need-join";

    if (lastRenderKey === key) return;

    lastRenderKey = key;
    lastErrorKey = "";

    setUI(
      '<div><b>Персонаж не найден</b></div>' +
      '<div class="mini">Твой Twitch ID получен, но персонаж ещё не привязан.</div>' +
      '<div class="mini">Напиши в чат команду:</div>' +
      '<div class="btns">' +
      '<button class="btn b-open" data-cmd="!join">Скопировать !join</button>' +
      '</div>' +
      '<div class="hint" id="hint">После команды !join панель сама обновится.</div>',
      "empty"
    );

    bindButtons();
  }

  function renderError(err) {
    var msg = err && err.name === "AbortError"
      ? "Timeout: сервер долго отвечает."
      : (err && err.message ? err.message : "unknown error");

    var key = "error:" + msg;

    if (lastErrorKey === key && firstLoadDone) return;

    lastErrorKey = key;
    lastRenderKey = key;

    setUI(
      '<div><b>Ошибка загрузки</b></div>' +
      '<div>' + escapeHtml(msg) + '</div>',
      "error"
    );
  }

  function renderSkillTree(p) {
    var key = playerKey(p);

    if (lastRenderKey === key) return;

    lastRenderKey = key;
    lastErrorKey = "";

    var cls = currentClass(p);
    var lvl = currentLevel(p);
    var earned = skillPointsEarned(p);
    var spent = skillPointsSpent(p);
    var free = skillPointsFree(p);
    var opened = currentSkillNodes(p);
    var defs = currentTreeDefs(p);

    var branchOrder = [];
    var branchMap = {};

    for (var i = 0; i < defs.length; i++) {
      var br = defs[i].branch;

      if (!branchMap[br]) {
        branchMap[br] = [];
        branchOrder.push(br);
      }

      branchMap[br].push(defs[i]);
    }

    var branchesHtml = "";

    for (var bi = 0; bi < branchOrder.length; bi++) {
      var branch = branchOrder[bi];
      var nodes = branchMap[branch];

      branchesHtml +=
        '<div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.08);">' +
          '<div style="color:#fbbf24;font-weight:900;font-size:16px;text-align:center;margin-bottom:8px;">' +
            escapeHtml(branchTitle(cls, branch)) +
          '</div>';

      for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        var state = nodeState(p, node);

        var bg = "#2a2236";
        var border = "rgba(255,255,255,0.10)";
        var titleColor = "#ffffff";
        var badge = "Закрыто";
        var lockMsg = "Узел пока недоступен.";

        if (state === "opened") {
          bg = "linear-gradient(135deg,#14532d,#22c55e)";
          border = "rgba(134,239,172,0.45)";
          badge = "Открыто";
          lockMsg = "Этот узел уже открыт.";
        } else if (state === "available") {
          bg = "linear-gradient(135deg,#92400e,#f59e0b)";
          border = "rgba(251,191,36,0.45)";
          badge = "Открыть";
          lockMsg = "";
        } else if (state === "locked_req") {
          bg = "linear-gradient(135deg,#2b2238,#3a2e50)";
          border = "rgba(255,255,255,0.10)";
          badge = "Нужен предыдущий узел";
          lockMsg = "Сначала открой предыдущий узел в этой ветке.";
        } else if (state === "locked_points") {
          bg = "linear-gradient(135deg,#2b2238,#3a2e50)";
          border = "rgba(255,255,255,0.10)";
          badge = "Нужно очко";
          lockMsg = "Недостаточно очков пассивок.";
        }

        branchesHtml +=
          '<button class="btn" ' +
            'data-skill-node="' + escapeHtml(node.id) + '" ' +
            'data-skill-class="' + escapeHtml(cls) + '" ' +
            'data-skill-state="' + escapeHtml(state) + '" ' +
            'data-lockmsg="' + escapeHtml(lockMsg) + '" ' +
            'style="margin-top:8px;text-align:left;min-height:72px;padding:10px 12px;background:' + bg + ';border:1px solid ' + border + ';">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
                '<div style="font-size:16px;font-weight:900;color:' + titleColor + ';">' + escapeHtml(node.title) + '</div>' +
                '<div style="font-size:12px;color:#f8e7b8;white-space:nowrap;">T' + escapeHtml(node.tier) + '</div>' +
              '</div>' +
              '<div style="font-size:13px;opacity:0.92;margin-top:4px;color:#f8e7b8;line-height:1.25;">' + escapeHtml(node.desc) + '</div>' +
              '<div style="font-size:12px;opacity:0.9;margin-top:6px;color:#fff;">' +
                badge + ' · Цена: ' + fmt(node.cost || 1) +
              '</div>' +
          '</button>';
      }

      branchesHtml += '</div>';
    }

    setUI(
      '<div class="card">' +

        viewTabsHtml("skills") +

        '<div class="top">' +
          '<div class="name">' + escapeHtml(p.username || "-") + '</div>' +
          '<div class="class">' + escapeHtml(cls) + ' · ' + fmt(lvl) + ' ур.</div>' +
        '</div>' +

        '<div class="stat-list">' +

          '<div class="stat-line">' +
            '<div class="stat-name">Очки дерева</div>' +
            '<div class="stat-value">🌿 ' + fmt(free) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Получено</div>' +
            '<div class="stat-value">' + fmt(earned) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Потрачено</div>' +
            '<div class="stat-value">' + fmt(spent) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Открыто узлов</div>' +
            '<div class="stat-value">' + fmt(opened.length) + '</div>' +
          '</div>' +

        '</div>' +

        '<div class="mini">1 очко пассивок даётся каждые 5 уровней текущего класса.</div>' +
        '<div class="mini">Сменишь класс — откроется дерево этого класса.</div>' +

        branchesHtml +

        '<div class="hint" id="hint">Нажми доступный узел, чтобы отправить его в игру.</div>' +

      '</div>',
      ""
    );

    bindButtons();
  }

  function renderPlayer(p) {
    var key = playerKey(p);

    if (lastRenderKey === key) return;

    lastRenderKey = key;
    lastErrorKey = "";

    var cls = currentClass(p);
    var lvl = currentLevel(p);
    var pts = currentPoints(p);
    var hpPct = hpPercent(p);
    var aps = attackPerSecond(p);
    var dodge = dodgePercent(p);
    var crit = critPercent(p);
    var hints = statHints(p);
    var passivePts = skillPointsFree(p);

    setUI(
      '<div class="card">' +

        viewTabsHtml("stats") +

        '<div class="top">' +
          '<div class="name">' + escapeHtml(p.username || "-") + '</div>' +
          '<div class="class">' + escapeHtml(cls) + ' · ' + fmt(lvl) + ' ур.</div>' +
        '</div>' +

        '<div class="hpbar">' +
          '<div class="hpfill" style="width:' + hpPct + '%"></div>' +
          '<div class="hptext">❤ ' + fmt(p.hp) + ' / ' + fmt(p.max_hp) + '</div>' +
        '</div>' +

        '<div class="stat-list">' +

          '<div class="stat-line">' +
            '<div class="stat-name">Золото</div>' +
            '<div class="stat-value gold">🪙 ' + fmt(p.gold) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Атака</div>' +
            '<div class="stat-value">⚔ ' + fmt(p.damage, 1) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Шанс крита</div>' +
            '<div class="stat-value">✹ ' + crit + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Скорость атаки</div>' +
            '<div class="stat-value">' + aps + '/с</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Защита</div>' +
            '<div class="stat-value">🛡 ' + fmt(p.armor, 1) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Маг. защита</div>' +
            '<div class="stat-value">✦ ' + fmt(p.magic_res, 1) + '</div>' +
          '</div>' +

          '<div class="stat-line">' +
            '<div class="stat-name">Уворот</div>' +
            '<div class="stat-value">💨 ' + dodge + '</div>' +
          '</div>' +

        '</div>' +

        '<div class="attr-points-box">' +
          '<div class="attr-points-label">Очки атрибутов</div>' +
          '<div class="attr-points-value">✨ ' + fmt(pts) + '</div>' +
          '<div class="attr-points-label" style="margin-top:8px;">Очки пассивок</div>' +
          '<div class="attr-points-value">🌿 ' + fmt(passivePts) + '</div>' +
        '</div>' +

        '<div class="attr-title">Атрибуты</div>' +

        '<div class="btns">' +

          '<button class="btn b-str" data-stat="str" data-amount="1">' +
            'СИЛА ' + fmt(p.strength) +
            '<small>' + escapeHtml(hints.str) + '</small>' +
          '</button>' +

          '<button class="btn b-agi" data-stat="agi" data-amount="1">' +
            'ЛОВКОСТЬ ' + fmt(p.agility) +
            '<small>' + escapeHtml(hints.agi) + '</small>' +
          '</button>' +

          '<button class="btn b-int" data-stat="int" data-amount="1">' +
            'ИНТЕЛЛЕКТ ' + fmt(p.intellect) +
            '<small>' + escapeHtml(hints.int) + '</small>' +
          '</button>' +

        '</div>' +

        '<div class="hint" id="hint">' +
          'Нажми кнопку — команда отправится в игру.' +
        '</div>' +

      '</div>',
      ""
    );

    bindButtons();
  }

  function renderCurrentView(p) {
    currentPlayerData = p;

    if (currentView === "skills") {
      renderSkillTree(p);
      return;
    }

    renderPlayer(p);
  }

  function bindButtons() {
    var actionButtons = document.querySelectorAll("[data-stat]");

    for (var i = 0; i < actionButtons.length; i++) {
      actionButtons[i].addEventListener("click", function () {
        var stat = this.getAttribute("data-stat");
        var amount = Number(this.getAttribute("data-amount") || 1);

        sendAction(stat, amount);
      });
    }

    var commandButtons = document.querySelectorAll("[data-cmd]");

    for (var j = 0; j < commandButtons.length; j++) {
      commandButtons[j].addEventListener("click", function () {
        copyCommand(this.getAttribute("data-cmd"));
      });
    }

    var viewButtons = document.querySelectorAll("[data-view]");

    for (var k = 0; k < viewButtons.length; k++) {
      viewButtons[k].addEventListener("click", function () {
        var view = this.getAttribute("data-view") || "stats";

        if (view !== "stats" && view !== "skills") {
          view = "stats";
        }

        currentView = view;
        lastRenderKey = "";

        if (currentPlayerData) {
          renderCurrentView(currentPlayerData);
        } else {
          load();
        }
      });
    }

    var skillButtons = document.querySelectorAll("[data-skill-node]");

    for (var s = 0; s < skillButtons.length; s++) {
      skillButtons[s].addEventListener("click", function () {
        var state = this.getAttribute("data-skill-state") || "";
        var lockMsg = this.getAttribute("data-lockmsg") || "";
        var nodeId = this.getAttribute("data-skill-node") || "";
        var playerClass = this.getAttribute("data-skill-class") || "";

        if (state === "opened") {
          showHint("Этот узел уже открыт.");
          return;
        }

        if (state !== "available") {
          showHint(lockMsg || "Узел пока недоступен.");
          return;
        }

        sendSkillUnlock(playerClass, nodeId);
      });
    }
  }

  function loadMe() {
    requestJsonWithJwt(
      API + "/api/me?t=" + Date.now(),
      function (data) {
        firstLoadDone = true;

        if (!data) {
          renderError(new Error("empty response"));
          return;
        }

        if (data.error) {
          if (data.needIdentity) {
            renderNeedIdentity();
            return;
          }

          if (data.needJoin) {
            renderNeedJoin();
            return;
          }

          renderError(new Error(data.error));
          return;
        }

        renderCurrentView(data);
      },
      function (err) {
        firstLoadDone = true;

        if (lastRenderKey && firstLoadDone) {
          return;
        }

        renderError(err);
      }
    );
  }

  function load() {
    if (!twitchReady || !twitchToken) return;

    if (!isViewerLinked()) {
      renderNeedIdentity();
      return;
    }

    if (!firstLoadDone) {
      setUI(
        '<div>Загрузка твоего персонажа...</div>' +
        '<div class="mini">Проверяю Twitch ID</div>',
        "loading"
      );
    }

    loadMe();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);

    load();

    pollTimer = setInterval(function () {
      load();
    }, POLL_MS);
  }

  function initTwitch() {
    if (!window.Twitch || !window.Twitch.ext) {
      renderError(new Error("Twitch helper не найден. Открой панель через Twitch Extension."));
      return;
    }

    window.Twitch.ext.onAuthorized(function (auth) {
      twitchToken = auth && auth.token ? auth.token : "";
      twitchReady = true;

      startPolling();
      startPresence(); // ✅ НОВОЕ: запускаем heartbeat после авторизации
    });

    window.Twitch.ext.onContext(function (ctx) {
      if (ctx && ctx.theme) {
        document.body.className = ctx.theme === "light" ? "light" : "dark";
      }
    });

    setTimeout(function () {
      if (!twitchReady) {
        renderError(new Error("Twitch authorization timeout"));
      }
    }, 8000);
  }

  window.onerror = function (message, source, line, column) {
    renderError(new Error(String(message) + " line:" + line + " column:" + column));
  };

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      load();
      sendPresence(); // ✅ НОВОЕ: вернулся на вкладку — сразу пингуем
    }
  });

  window.addEventListener("focus", function () {
    load();
    sendPresence(); // ✅ НОВОЕ: фокус на окне — сразу пингуем
  });

  initTwitch();
})();
