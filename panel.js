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

  function playerKey(p) {
    return JSON.stringify({
      username: p.username,
      class: p["class"],

      gold: p.gold,

      hp: p.hp,
      max_hp: p.max_hp,

      damage: p.damage,
      armor: p.armor,
      magic_res: p.magic_res,
      attack_spd: p.attack_spd,

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
    // Не отправляем если токен не готов
    if (!twitchReady || !twitchToken) return;

    // Не отправляем если зритель не дал Twitch ID
    if (!isViewerLinked()) return;

    var xhr = new XMLHttpRequest();

    try {
      xhr.open("POST", API + "/api/presence", true);
      xhr.timeout = 8000;

      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("x-extension-jwt", twitchToken);

      // Тихий запрос — ответ нас не интересует, ошибки не показываем
      xhr.send(JSON.stringify({ platform: "panel" }));
    } catch (e) {
      // Тихо игнорируем — heartbeat фоновый
    }
  }

  function startPresence() {
    // Не запускаем дважды
    if (presenceTimer) return;

    // Первый ping сразу
    sendPresence();

    // Потом каждые 15 секунд
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
    var hints = statHints(p);

    setUI(
      '<div class="card">' +

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

        renderPlayer(data);
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
