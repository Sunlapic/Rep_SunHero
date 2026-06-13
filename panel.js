(function () {
  "use strict";

  var API = "https://rep-sunhero.onrender.com";
  var POLL_MS = 5000;
  var TIMEOUT_MS = 12000;

  var ui = document.getElementById("ui");

  var twitchToken = "";
  var twitchReady = false;

  var isLoading = false;
  var pollTimer = null;

  var firstLoadDone = false;
  var lastRenderKey = "";
  var lastErrorKey = "";

  function setUI(html, className) {
    if (!ui) {
      ui = document.getElementById("ui");
    }

    if (!ui) return;

    ui.className = className || "box";
    ui.innerHTML = html;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

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

  function playerKey(p) {
    /*
      Если эти данные не изменились — панель НЕ перерисовывается.
      Поэтому больше не будет мигания каждые 5 секунд.
    */
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

      strength: p.strength,
      agility: p.agility,
      intellect: p.intellect,

      class_levels: p.class_levels,
      class_attr_points: p.class_attr_points,
      class_exp: p.class_exp,

      kills: p.kills
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

  function requestJsonWithJwt(url, done, fail) {
    var xhr = new XMLHttpRequest();
    var finished = false;

    function endError(message) {
      if (finished) return;

      finished = true;
      fail(new Error(message));
    }

    function endOk(data) {
      if (finished) return;

      finished = true;
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
        if (xhr.readyState !== 4 || finished) {
          return;
        }

        var data = null;

        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = null;
        }

        /*
          Важно:
          Даже если backend вернул 401 или 404,
          мы всё равно пытаемся прочитать JSON.
          Там могут быть поля:
          needIdentity: true
          needJoin: true
        */
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

    if (lastRenderKey === key) {
      return;
    }

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

    if (lastRenderKey === key) {
      return;
    }

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
      ? "Timeout: сервер долго отвечает. Возможно Render просыпается."
      : (err && err.message ? err.message : "unknown error");

    var key = "error:" + msg;

    if (lastErrorKey === key && firstLoadDone) {
      return;
    }

    lastErrorKey = key;
    lastRenderKey = key;

    setUI(
      '<div><b>Ошибка загрузки</b></div>' +
      '<div>' + escapeHtml(msg) + '</div>' +
      '<div class="mini">Backend: rep-sunhero.onrender.com</div>',
      "error"
    );
  }

  function renderPlayer(p) {
    var key = playerKey(p);

    /*
      Если данные не изменились — вообще ничего не трогаем.
      Это убирает мигание.
    */
    if (lastRenderKey === key) {
      return;
    }

    lastRenderKey = key;
    lastErrorKey = "";

    var cls = currentClass(p);
    var lvl = currentLevel(p);
    var pts = currentPoints(p);
    var hpPct = hpPercent(p);
    var aps = attackPerSecond(p);
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

        '<div class="grid">' +

          '<div class="stat">' +
            '<div class="label">Золото</div>' +
            '<div class="value gold">🪙 ' + fmt(p.gold) + '</div>' +
          '</div>' +

          '<div class="stat">' +
            '<div class="label">Атака · СкА</div>' +
            '<div class="value">⚔ ' + fmt(p.damage, 1) + ' · ' + aps + '/с</div>' +
          '</div>' +

          '<div class="stat">' +
            '<div class="label">Броня · МЗ</div>' +
            '<div class="value">🛡 ' + fmt(p.armor, 1) + ' · ' + fmt(p.magic_res, 1) + '</div>' +
          '</div>' +

          '<div class="stat">' +
            '<div class="label">Очки атрибутов</div>' +
            '<div class="value points">✨ ' + fmt(pts) + '</div>' +
          '</div>' +

        '</div>' +

        '<div class="btns">' +

          '<button class="btn b-str" data-cmd="!str 1">' +
            'СИЛА ' + fmt(p.strength) +
            '<small>' + escapeHtml(hints.str) + '</small>' +
          '</button>' +

          '<button class="btn b-agi" data-cmd="!agi 1">' +
            'ЛОВКОСТЬ ' + fmt(p.agility) +
            '<small>' + escapeHtml(hints.agi) + '</small>' +
          '</button>' +

          '<button class="btn b-int" data-cmd="!int 1">' +
            'ИНТЕЛЛЕКТ ' + fmt(p.intellect) +
            '<small>' + escapeHtml(hints.int) + '</small>' +
          '</button>' +

        '</div>' +

        '<div class="hint" id="hint">' +
          'Нажми кнопку — команда скопируется. Потом вставь её в чат.' +
        '</div>' +

        '<div class="mini">' +
          'Панель обновляется в фоне. Перерисовка только при изменении данных.' +
        '</div>' +

      '</div>',
      ""
    );

    bindButtons();
  }

  function bindButtons() {
    var buttons = document.querySelectorAll("[data-cmd]");

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        copyCommand(this.getAttribute("data-cmd"));
      });
    }
  }

  function loadMe() {
    requestJsonWithJwt(
      API + "/api/me?t=" + Date.now(),
      function (data) {
        isLoading = false;
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
        isLoading = false;
        firstLoadDone = true;
        renderError(err);
      }
    );
  }

  function load() {
    if (isLoading) {
      return;
    }

    if (!twitchReady || !twitchToken) {
      return;
    }

    /*
      Если Twitch говорит, что зритель ещё не разрешил identity,
      показываем кнопку запроса разрешения.
    */
    if (!isViewerLinked()) {
      renderNeedIdentity();
      return;
    }

    isLoading = true;

    /*
      Загрузочный экран показываем только один раз.
      Дальше обновление идёт тихо в фоне без мигания.
    */
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
    if (pollTimer) {
      clearInterval(pollTimer);
    }

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
    });

    window.Twitch.ext.onContext(function (ctx) {
      if (ctx && ctx.theme) {
        document.body.className = ctx.theme === "light" ? "light" : "dark";
      }
    });

    /*
      Защита от вечной загрузки, если onAuthorized не пришёл.
    */
    setTimeout(function () {
      if (!twitchReady) {
        renderError(new Error("Twitch authorization timeout"));
      }
    }, 8000);
  }

  window.onerror = function (message, source, line, column) {
    renderError(new Error(String(message) + " line:" + line + " column:" + column));
  };

  initTwitch();
})();
