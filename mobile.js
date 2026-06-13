(function () {
  "use strict";

  var API = "https://rep-sunhero.onrender.com";
  var POLL_MS = 5000;
  var FETCH_TIMEOUT_MS = 12000;

  var ui = document.getElementById("ui");
  var isLoading = false;
  var pollTimer = null;

  function setUI(html, className) {
    if (!ui) return;

    ui.className = className || "box";
    ui.innerHTML = html;
  }

  function text(value) {
    if (value === null || value === undefined) return "";

    return String(value).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return String.fromCharCode(38) + "amp;";
      if (ch === "<") return String.fromCharCode(38) + "lt;";
      if (ch === ">") return String.fromCharCode(38) + "gt;";
      if (ch === '"') return String.fromCharCode(38) + "quot;";
      if (ch === "'") return String.fromCharCode(38) + "#039;";
      return ch;
    });
  }

  function toNum(value, fallback) {
    var n = Number(value);

    if (Number.isFinite && Number.isFinite(n)) return n;
    if (!isNaN(n) && isFinite(n)) return n;

    return fallback || 0;
  }

  function fmt(value, digits) {
    var n = Number(value);

    if ((Number.isFinite && !Number.isFinite(n)) || isNaN(n)) return "-";

    if (Math.floor(n) === n) return String(n);

    return n.toFixed(digits || 0).replace(/\.?0+$/, "");
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getQuery(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  function hpPercent(player) {
    var hp = toNum(player.hp, 0);
    var max = toNum(player.max_hp, 0);

    if (max <= 0) return 0;

    return clamp(Math.round((hp / max) * 100), 0, 100);
  }

  function currentClass(player) {
    return player["class"] || "warrior";
  }

  function currentLevel(player) {
    var cls = currentClass(player);

    if (player.class_levels && player.class_levels[cls] !== undefined) {
      return toNum(player.class_levels[cls], 1);
    }

    return 1;
  }

  function currentPoints(player) {
    var cls = currentClass(player);

    if (player.class_attr_points && player.class_attr_points[cls] !== undefined) {
      return toNum(player.class_attr_points[cls], 0);
    }

    return 0;
  }

  function attackPerSecond(player) {
    var cooldownFrames = toNum(player.attack_spd, 0);

    if (cooldownFrames <= 0) return "-";

    return fmt(60 / cooldownFrames, 1);
  }

  function statHints(player) {
    var cls = currentClass(player);

    var h = {
      str: "+10 HP +1.5 атаки",
      agi: "+1 атака +уворот",
      int: "+1 атака +0.5 маг.защ."
    };

    if (cls === "warrior") {
      h.str = "+14 HP +2 атаки +броня";
    }

    if (cls === "archer") {
      h.agi = "+2 атаки +скорость +уворот";
    }

    if (cls === "wizard") {
      h.int = "+2.5 атаки +маг.защ.";
    }

    return h;
  }

  function showHint(message) {
    var el = document.getElementById("hint");

    if (el) {
      el.textContent = message;
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

  function requestJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var finished = false;

      var timer = setTimeout(function () {
        if (finished) return;

        finished = true;
        reject(new Error("Timeout: сервер не ответил за " + Math.round(timeoutMs / 1000) + " сек."));
      }, timeoutMs);

      if (!window.fetch) {
        clearTimeout(timer);
        reject(new Error("fetch не поддерживается в этом WebView"));
        return;
      }

      fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        cache: "no-store"
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("HTTP " + res.status);
          }

          return res.json();
        })
        .then(function (data) {
          if (finished) return;

          finished = true;
          clearTimeout(timer);
          resolve(data);
        })
        .catch(function (err) {
          if (finished) return;

          finished = true;
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function playerUrl() {
    var forcedName = getQuery("name");

    if (forcedName) {
      return API + "/api/player/" + encodeURIComponent(forcedName) + "?t=" + Date.now();
    }

    return API + "/api/players?t=" + Date.now();
  }

  function loadPlayer() {
    return requestJson(playerUrl(), FETCH_TIMEOUT_MS)
      .then(function (data) {
        if (Array.isArray(data)) {
          if (data.length === 0) return null;
          return data[0];
        }

        if (data && data.error) {
          throw new Error(data.error);
        }

        return data;
      });
  }

  function renderEmpty() {
    setUI(
      '<div>Нет игроков.</div>' +
      '<div>Напишите <b>!join</b> в чат.</div>' +
      '<div class="muted">Ожидание данных от игры...</div>',
      "empty"
    );
  }

  function renderError(err) {
    var msg = err && err.message ? err.message : "unknown error";

    setUI(
      '<div><b>Ошибка мобильной панели</b></div>' +
      '<div style="margin-top:6px;">' + text(msg) + '</div>' +
      '<div class="muted">Если это CSP/fetch — добавь backend в Twitch URL Fetching Domains.</div>' +
      '<div class="muted">Backend: rep-sunhero.onrender.com</div>',
      "error"
    );
  }

  function renderPlayer(player) {
    var cls = currentClass(player);
    var lvl = currentLevel(player);
    var pts = currentPoints(player);
    var hpPct = hpPercent(player);
    var aps = attackPerSecond(player);
    var hints = statHints(player);

    var html = '';

    html += '<div class="card">';

    html += '<div class="top">';
    html += '<div class="name">' + text(player.username || "-") + '</div>';
    html += '<div class="class">' + text(cls) + ' · ' + fmt(lvl) + ' ур.</div>';
    html += '</div>';

    html += '<div class="hpbar">';
    html += '<div class="hpfill" style="width:' + hpPct + '%"></div>';
    html += '<div class="hptext">❤ ' + fmt(player.hp) + ' / ' + fmt(player.max_hp) + '</div>';
    html += '</div>';

    html += '<div class="grid">';

    html += '<div class="stat">';
    html += '<div class="label">Золото</div>';
    html += '<div class="value gold">🪙 ' + fmt(player.gold) + '</div>';
    html += '</div>';

    html += '<div class="stat">';
    html += '<div class="label">Атака · СкА</div>';
    html += '<div class="value">⚔ ' + fmt(player.damage, 1) + ' · ' + aps + '/с</div>';
    html += '</div>';

    html += '<div class="stat">';
    html += '<div class="label">Броня · МЗ</div>';
    html += '<div class="value">🛡 ' + fmt(player.armor, 1) + ' · ' + fmt(player.magic_res, 1) + '</div>';
    html += '</div>';

    html += '<div class="stat">';
    html += '<div class="label">Очки атрибутов</div>';
    html += '<div class="value points">✨ ' + fmt(pts) + '</div>';
    html += '</div>';

    html += '</div>';

    html += '<div class="btns">';

    html += '<button class="btn b-str" data-cmd="!str 1">';
    html += 'СИЛА ' + fmt(player.strength);
    html += '<small>' + text(hints.str) + '</small>';
    html += '</button>';

    html += '<button class="btn b-agi" data-cmd="!agi 1">';
    html += 'ЛОВКОСТЬ ' + fmt(player.agility);
    html += '<small>' + text(hints.agi) + '</small>';
    html += '</button>';

    html += '<button class="btn b-int" data-cmd="!int 1">';
    html += 'ИНТЕЛЛЕКТ ' + fmt(player.intellect);
    html += '<small>' + text(hints.int) + '</small>';
    html += '</button>';

    html += '</div>';

    html += '<div class="hint" id="hint">';
    html += 'Нажми кнопку — команда скопируется. Потом вставь её в чат.';
    html += '</div>';

    html += '<div class="muted">Обновление каждые ' + Math.round(POLL_MS / 1000) + ' сек.</div>';

    html += '</div>';

    setUI(html, "");

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

  function load() {
    if (isLoading) return;

    isLoading = true;

    loadPlayer()
      .then(function (player) {
        if (!player) {
          renderEmpty();
        } else {
          renderPlayer(player);
        }
      })
      .catch(function (err) {
        renderError(err);
      })
      .then(function () {
        isLoading = false;
      });
  }

  function start() {
    setUI(
      '<div class="ok">JS запущен.</div>' +
      '<div class="muted">Пробую загрузить данные игроков...</div>',
      "box"
    );

    load();

    if (pollTimer) {
      clearInterval(pollTimer);
    }

    pollTimer = setInterval(load, POLL_MS);
  }

  window.onerror = function (message, source, line, column) {
    setUI(
      '<div><b>JS ERROR</b></div>' +
      '<div>' + text(message) + '</div>' +
      '<div class="muted">line: ' + text(line) + ', column: ' + text(column) + '</div>',
      "error"
    );
  };

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason ? event.reason : "unhandled rejection";
    var msg = reason && reason.message ? reason.message : String(reason);

    setUI(
      '<div><b>PROMISE ERROR</b></div>' +
      '<div>' + text(msg) + '</div>',
      "error"
    );
  });

  if (!ui) {
    return;
  }

  if (window.Twitch && window.Twitch.ext) {
    try {
      window.Twitch.ext.onAuthorized(function () {
        start();
      });

      window.Twitch.ext.onContext(function (ctx) {
        if (!ctx) return;

        if (ctx.theme === "light") {
          document.body.style.background = "#f4efe3";
          document.body.style.color = "#201522";
        } else {
          document.body.style.background = "#0e0c16";
          document.body.style.color = "#f8e7b8";
        }
      });

      setTimeout(function () {
        if (!pollTimer) {
          start();
        }
      }, 1500);
    } catch (e) {
      start();
    }
  } else {
    start();
  }
})();
