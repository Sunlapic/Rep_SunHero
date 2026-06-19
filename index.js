const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
const TWITCH_EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET;
const BOT_SECRET = process.env.BOT_SECRET || "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "vhci9k13zy44jty2n7kdvacmx0bmvw";
const AUTH_REDIRECT_BASE = process.env.AUTH_REDIRECT_BASE || "https://rep-sunhero.onrender.com";

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URL or MONGO_URI is not set");
}

let db;
let playersCollection;
let actionsCollection;

// =============================================
// OAUTH — временное хранилище (одноразовое)
// =============================================
const oauthTokens = {};

// =============================================
// OAUTH — постоянное хранилище последних токенов
// =============================================
const savedAuth = {
  bot: null,
  channel: null
};

/* =========================
   TWITCH JWT / BOT SECRET
========================= */

function getExtensionSecretBuffer() {
  if (!TWITCH_EXTENSION_SECRET) {
    throw new Error("TWITCH_EXTENSION_SECRET is not set");
  }
  return Buffer.from(TWITCH_EXTENSION_SECRET, "base64");
}

function getJwtFromRequest(req) {
  const headerToken = req.headers["x-extension-jwt"];
  if (headerToken) return String(headerToken);
  const auth = req.headers["authorization"];
  if (auth && String(auth).startsWith("Bearer ")) {
    return String(auth).slice("Bearer ".length);
  }
  return "";
}

function verifyExtensionJwt(req, res, next) {
  try {
    const token = getJwtFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "no extension jwt", needIdentity: true });
    }
    const payload = jwt.verify(token, getExtensionSecretBuffer(), { algorithms: ["HS256"] });
    req.ext = payload;
    return next();
  } catch (err) {
    console.error("EXT JWT ERROR:", err.message);
    return res.status(401).json({ error: "invalid extension jwt", needIdentity: true });
  }
}

function requireBotSecret(req, res, next) {
  if (!BOT_SECRET) return next();
  const value = req.headers["x-bot-secret"];
  if (value !== BOT_SECRET) {
    return res.status(403).json({ error: "bad bot secret" });
  }
  return next();
}

function normalizeTwitchId(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\D/g, "").slice(0, 32);
}

/* =========================
   MIDDLEWARE
========================= */

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Accept",
    "Authorization",
    "x-extension-jwt",
    "x-bot-secret"
  ]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.text({ limit: "2mb", type: ["text/*", "application/text"] }));

/* =========================
   PRIVACY POLICY & TERMS OF SERVICE (HTML)
   Добавлено для прохождения Twitch Review
========================= */

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Политика конфиденциальности — SunHero</title>
  <style>body { background:#12121c; color:#ddd; font-family:Arial,sans-serif; padding:40px; line-height:1.6; max-width:800px; margin:auto; } h1,h2 { color:#7c5ce4; } a { color:#bb86fc; }</style>
</head>
<body>
  <h1>Политика конфиденциальности (Privacy Policy)</h1>
  <p><strong>Последнее обновление:</strong> 19 июня 2026</p>
  
  <h2>1. Какие данные мы собираем</h2>
  <p>SunHero собирает следующие данные через Twitch Extension:</p>
  <ul>
    <li>Twitch User ID и username</li>
    <li>Игровые данные персонажа: класс, уровень, очки характеристик, золото, убийства, статистика (сила, ловкость, интеллект и т.д.)</li>
    <li>Данные о присутствии (когда зритель открыл панель расширения)</li>
  </ul>

  <h2>2. Для чего используются данные</h2>
  <p>Данные используются исключительно для:</p>
  <ul>
    <li>Сохранения прогресса вашего персонажа между стримами</li>
    <li>Отображения актуальной статистики в панели расширения</li>
    <li>Обработки действий прокачки (STR/AGI/INT, смена класса, сброс очков)</li>
  </ul>

  <h2>3. Хранение данных</h2>
  <p>Данные хранятся в базе MongoDB Atlas (США). Мы не передаём ваши данные третьим лицам.</p>

  <h2>4. Ваши права</h2>
  <p>Вы можете в любое время запросить удаление всех ваших данных, написав на почту <strong>Serjantos@yandex.ru</strong>.</p>

  <h2>5. Контакты</h2>
  <p>По всем вопросам, связанным с конфиденциальностью, пишите: <strong>Serjantos@yandex.ru</strong></p>

  <hr>
  <p>This policy is also available in English upon request.</p>
</body>
</html>`;

const TOS_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Условия использования — SunHero</title>
  <style>body { background:#12121c; color:#ddd; font-family:Arial,sans-serif; padding:40px; line-height:1.6; max-width:800px; margin:auto; } h1,h2 { color:#7c5ce4; } a { color:#bb86fc; }</style>
</head>
<body>
  <h1>Условия использования (Terms of Service)</h1>
  <p><strong>Последнее обновление:</strong> 19 июня 2026</p>

  <h2>1. Общие положения</h2>
  <p>SunHero предоставляется «как есть» (as is). Мы не даём никаких гарантий бесперебойной работы или сохранности данных.</p>

  <h2>2. Запрещённые действия</h2>
  <ul>
    <li>Использование ботов, скриптов и любой автоматизации для прокачки</li>
    <li>Попытки взлома или злоупотребления API</li>
    <li>Использование расширения в целях, противоречащих правилам Twitch</li>
  </ul>

  <h2>3. Последствия нарушения</h2>
  <p>Нарушение условий может привести к блокировке вашего персонажа или Twitch-аккаунта в рамках расширения без предупреждения.</p>

  <h2>4. Ограничение ответственности</h2>
  <p>Разработчик не несёт ответственности за потерю игрового прогресса, ошибочные действия или любой другой ущерб.</p>

  <h2>5. Изменения условий</h2>
  <p>Мы оставляем за собой право изменять данные условия в любое время. Продолжение использования расширения означает согласие с новыми условиями.</p>

  <hr>
  <p>По вопросам пишите: Serjantos@yandex.ru</p>
</body>
</html>`;

/* =========================
   HELPERS
========================= */

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(name) {
  if (name === undefined || name === null) return "";
  return String(name).trim().slice(0, 64);
}

function createPlayer(name) {
  const username = normalizeName(name);
  return {
    username,
    class: "warrior",
    gold: 0,
    strength: 5,
    agility: 2,
    intellect: 2,
    max_hp: 100,
    hp: 100,
    damage: 10,
    armor: 0,
    magic_res: 0,
    attack_spd: 60,
    attack_cycle_frames_real: 60,
    attack_aps_real: 1,
    crit_chance: 0,
    crit_mult: 1.5,
    kills: 0,
    dodge: 0,
    dodge_chance: 0,
    dodge_percent: 0,
    evasion: 0,
    evasion_percent: 0,
    class_stats: {
      warrior: { strength: 5, agility: 2, intellect: 2 },
      archer:  { strength: 2, agility: 5, intellect: 2 },
      wizard:  { strength: 2, agility: 2, intellect: 5 }
    },
    class_levels:      { warrior: 1, archer: 1, wizard: 1 },
    class_exp:         { warrior: 0, archer: 0, wizard: 0 },
    class_attr_points: { warrior: 0, archer: 0, wizard: 0 },
    class_skill_nodes: { warrior: [], archer: [], wizard: [] },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    const txt = body.trim();
    if (!txt) return {};
    try { body = JSON.parse(txt); } catch { return { __parseError: true }; }
  }
  if (!body || typeof body !== "object") return {};
  return body;
}

function getNameFromBody(body) {
  return normalizeName(body.name || body.username || body.user || body.player || "");
}

function cleanValue(value, depth = 0) {
  if (depth > 10) return null;
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") { if (!Number.isFinite(value)) return 0; return value; }
  if (typeof value === "string") return value.slice(0, 256);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(v => cleanValue(v, depth + 1));
  if (typeof value === "object") {
    const obj = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith("$")) continue;
      if (key.includes(".")) continue;
      const cleaned = cleanValue(value[key], depth + 1);
      if (cleaned !== undefined) obj[key] = cleaned;
    }
    return obj;
  }
  return null;
}

function publicPlayer(player) {
  if (!player) return null;
  const copy = { ...player };
  delete copy._id;

  if (copy.crit_chance === undefined || copy.crit_chance === null) copy.crit_chance = 0;
  if (copy.crit_mult === undefined || copy.crit_mult === null) copy.crit_mult = 1.5;
  if (copy.attack_cycle_frames_real === undefined || copy.attack_cycle_frames_real === null) copy.attack_cycle_frames_real = copy.attack_spd || 60;
  if (copy.attack_aps_real === undefined || copy.attack_aps_real === null) copy.attack_aps_real = 1;

  const skillNodes = (copy.class_skill_nodes && typeof copy.class_skill_nodes === "object")
    ? copy.class_skill_nodes
    : {};

  copy.class_skill_nodes = {
    warrior: Array.isArray(skillNodes.warrior) ? skillNodes.warrior : [],
    archer:  Array.isArray(skillNodes.archer)  ? skillNodes.archer  : [],
    wizard:  Array.isArray(skillNodes.wizard)  ? skillNodes.wizard  : []
  };

  return copy;
}

/* =========================
   ALLOWED UPDATE FIELDS
========================= */

const allowedFields = [
  "class", "gold",
  "strength", "agility", "intellect",
  "hp", "max_hp", "damage", "armor", "magic_res", "attack_spd", "kills",
  "attack_cycle_frames_real", "attack_aps_real",
  "crit_chance", "crit_mult",
  "dodge", "dodge_chance", "dodge_percent", "evasion", "evasion_percent",
  "class_stats", "class_levels", "class_exp", "class_attr_points",
  "class_skill_nodes"
];

/* =========================
   ACTION HELPERS
========================= */

function normalizeActionStat(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["str", "strength", "сил", "сила"].includes(raw)) return "str";
  if (["agi", "agility", "лов", "ловкость"].includes(raw)) return "agi";
  if (["int", "intellect", "инт", "интеллект"].includes(raw)) return "int";
  return "";
}

function normalizeActionAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.floor(n);
  if (rounded < 1) return 1;
  if (rounded > 100) return 100;
  return rounded;
}

function normalizeActionType(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["attr", "stat", "add_stat", "attribute"].includes(raw)) return "attr";
  if (["skill_unlock", "skill", "unlock_skill", "skilltree", "passive_skill"].includes(raw)) return "skill_unlock";
  if (["reclass", "class_change", "change_class"].includes(raw)) return "reclass";
  if (["reset_attrs", "resetstats", "reset_attr_points"].includes(raw)) return "reset_attrs";
  if (["reset_skilltree", "resettree", "resetskills", "resetskilltree"].includes(raw)) return "reset_skilltree";

  return "";
}

function normalizeSkillClass(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["warrior", "archer", "wizard"].includes(raw)) return raw;
  return "";
}

function normalizeNodeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "")
    .slice(0, 64);
}

function publicAction(action) {
  if (!action) return null;
  return {
    id: String(action._id),
    type: action.type,
    stat: action.stat,
    amount: action.amount,
    class: action.class,
    node_id: action.node_id,
    username: action.username,
    twitch_user_id: action.twitch_user_id,
    status: action.status,
    createdAt: action.createdAt
  };
}

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "SunHero API",
    endpoints: [
      "GET /health",
      "GET /auth/bot",
      "GET /auth/channel",
      "GET /oauth/callback",
      "POST /oauth/save",
      "GET /oauth/poll",
      "GET /api/auth/status",
      "GET /api/auth/bot-token",
      "GET /api/players",
      "GET /api/players/admin",
      "GET /api/player/:name",
      "GET /api/me",
      "POST /api/action",
      "GET /api/actions/pending",
      "POST /api/actions/done",
      "POST /api/join",
      "POST /api/update",
      "POST /api/presence",
      "GET /api/presence/active",
      "GET /privacy",           // ← добавлено
      "GET /tos"                // ← добавлено
    ]
  });
});

/* =========================
   HEALTH
========================= */

app.get("/health", async (req, res) => {
  try {
    const count = playersCollection ? await playersCollection.countDocuments() : 0;
    const pendingActions = actionsCollection
      ? await actionsCollection.countDocuments({ status: "pending" })
      : 0;
    const activeSinceIso = new Date(Date.now() - 60 * 1000).toISOString();
    const activePresence = playersCollection
      ? await playersCollection.countDocuments({ presence_last_seen: { $gte: activeSinceIso } })
      : 0;

    res.json({
      ok: true,
      mongo: Boolean(playersCollection),
      players: count,
      pendingActions,
      activePresence,
      twitchSecret: Boolean(TWITCH_EXTENSION_SECRET),
      botSecret: Boolean(BOT_SECRET),
      authBot: Boolean(savedAuth.bot),
      authChannel: Boolean(savedAuth.channel),
      time: nowIso()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "health error" });
  }
});

/* =========================
   OAUTH — /auth/bot
========================= */

app.get("/auth/bot", (req, res) => {
  const session = String(req.query.session || "").slice(0, 64);
  const state = session ? session + "_bot" : String(Date.now()) + "_bot";

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: AUTH_REDIRECT_BASE + "/oauth/callback",
    response_type: "token",
    scope: "chat:read chat:edit",
    state
  });

  console.log("Auth bot: session=" + session + " state=" + state);
  return res.redirect("https://id.twitch.tv/oauth2/authorize?" + params.toString());
});

/* =========================
   OAUTH — /auth/channel
========================= */

app.get("/auth/channel", (req, res) => {
  const session = String(req.query.session || "").slice(0, 64);
  const state = session ? session + "_channel" : String(Date.now()) + "_channel";

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: AUTH_REDIRECT_BASE + "/oauth/callback",
    response_type: "token",
    scope: "moderator:read:chatters",
    state
  });

  console.log("Auth channel: session=" + session + " state=" + state);
  return res.redirect("https://id.twitch.tv/oauth2/authorize?" + params.toString());
});

/* =========================
   OAUTH — /oauth/callback
========================= */

app.get("/oauth/callback", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SunHero Auth</title>
  <style>
    body { background: #12121c; color: #fff; font-family: Arial, sans-serif;
           text-align: center; padding-top: 80px; }
    h2 { color: #7c5ce4; }
    p { color: #888; font-size: 14px; }
    .ok { color: #66ff99; font-size: 18px; }
    .err { color: #ff7777; }
    pre { color: #555; font-size: 11px; text-align: left;
          display: inline-block; max-width: 600px; }
  </style>
</head>
<body>
  <h2>SunHero</h2>
  <p id="msg">Получаем токен...</p>
  <script>
    async function main() {
      var el = document.getElementById("msg");
      try {
        var hash = window.location.hash || "";
        if (hash.startsWith("#")) hash = hash.slice(1);
        var params = new URLSearchParams(hash);
        var token = params.get("access_token") || "";
        var state = params.get("state") || "";
        var scope = params.get("scope") || "";
        if (!token) {
          el.innerHTML = '<span class="err">❌ Ошибка: access_token не найден.</span>';
          return;
        }
        if (!state) {
          el.innerHTML = '<span class="err">❌ Ошибка: state не найден.</span>';
          return;
        }
        var type = "bot";
        var session_id = state;
        if (state.indexOf("_channel") >= 0) {
          type = "channel";
          session_id = state.replace("_channel", "");
        } else if (state.indexOf("_bot") >= 0) {
          type = "bot";
          session_id = state.replace("_bot", "");
        }
        var resp = await fetch("/oauth/save", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ session_id, token: "oauth:" + token, type, scope, state })
        });
        var json = await resp.json();
        if (!resp.ok || !json.ok) {
          el.innerHTML = '<span class="err">❌ Ошибка сохранения.</span><pre>' +
            JSON.stringify(json, null, 2) + '</pre>';
          return;
        }
        el.innerHTML =
          '<div class="ok">✅ Токен получен! Можно закрыть вкладку.</div>' +
          '<p>Тип: <b>' + type + '</b></p>' +
          '<p>Login: <b>' + (json.username || "-") + '</b></p>';
      } catch (e) {
        el.innerHTML = '<span class="err">❌ Ошибка: ' + String(e.message || e) + '</span>';
      }
    }
    main();
  </script>
</body>
</html>
  `);
});

/* =========================
   OAUTH — /oauth/save
========================= */

app.post("/oauth/save",
  express.json({ limit: "2mb" }),
  async (req, res) => {
    try {
      const body = req.body || {};
      const session_id = String(body.session_id || "").slice(0, 64);
      const token      = String(body.token      || "").slice(0, 512);
      const type       = String(body.type       || "bot").slice(0, 16);
      const scope      = String(body.scope      || "");

      console.log("OAuth/save: session=" + session_id + " type=" + type + " token_len=" + token.length);

      if (!session_id || !token) {
        return res.status(400).json({ ok: false, error: "bad params" });
      }
      if (type !== "bot" && type !== "channel") {
        return res.status(400).json({ ok: false, error: "bad type" });
      }

      let username = "";
      const cleanToken = token.replace("oauth:", "");

      try {
        const validateResp = await fetch("https://id.twitch.tv/oauth2/validate", {
          method: "GET",
          headers: { "Authorization": "OAuth " + cleanToken }
        });
        const validateData = await validateResp.json();
        if (validateResp.ok && validateData.login) {
          username = validateData.login;
          console.log("OAuth validated: login=" + username);
        }
      } catch (err) {
        console.error("OAuth validate error:", err.message);
      }

      if (!username) {
        try {
          const helixResp = await fetch("https://api.twitch.tv/helix/users", {
            headers: {
              "Authorization": "Bearer " + cleanToken,
              "Client-Id": TWITCH_CLIENT_ID
            }
          });
          const helixData = await helixResp.json();
          if (helixData.data && helixData.data.length > 0) {
            username = helixData.data[0].login;
            console.log("OAuth Helix username: " + username);
          }
        } catch (err) {
          console.error("OAuth Helix error:", err.message);
        }
      }

      oauthTokens[session_id] = {
        token, type, username, scope,
        expires: Date.now() + 5 * 60 * 1000
      };

      savedAuth[type] = {
        token,
        username,
        scope,
        savedAt: nowIso()
      };

      console.log("OAuth token saved: type=" + type + " session=" + session_id + " username=" + username);

      return res.json({ ok: true, type, username });
    } catch (err) {
      console.error("OAUTH SAVE ERROR:", err);
      return res.status(500).json({ ok: false, error: "oauth save error", message: err.message });
    }
  }
);

/* =========================
   OAUTH — /oauth/poll
========================= */

app.get("/oauth/poll", (req, res) => {
  const session_id = String(req.query.session || "").slice(0, 64);

  for (const key of Object.keys(oauthTokens)) {
    if (oauthTokens[key].expires < Date.now()) {
      delete oauthTokens[key];
    }
  }

  if (!session_id || !oauthTokens[session_id]) {
    return res.json({ ok: true, ready: false });
  }

  const data = oauthTokens[session_id];
  delete oauthTokens[session_id];

  return res.json({
    ok: true,
    ready: true,
    token: data.token,
    type: data.type,
    username: data.username || ""
  });
});

/* =========================
   AUTH STATUS
========================= */

app.get("/api/auth/status", (req, res) => {
  return res.json({
    ok: true,
    bot: savedAuth.bot
      ? { connected: true, login: savedAuth.bot.username || "", savedAt: savedAuth.bot.savedAt || "" }
      : { connected: false },
    channel: savedAuth.channel
      ? { connected: true, login: savedAuth.channel.username || "", savedAt: savedAuth.channel.savedAt || "" }
      : { connected: false }
  });
});

/* =========================
   AUTH BOT TOKEN
========================= */

app.get("/api/auth/bot-token", requireBotSecret, (req, res) => {
  if (!savedAuth.bot || !savedAuth.bot.token) {
    return res.status(404).json({
      ok: false,
      error: "bot token not found. Please complete Bot OAuth first."
    });
  }

  return res.json({
    ok: true,
    bot_name: savedAuth.bot.username || "",
    bot_oauth: savedAuth.bot.token || "",
    savedAt: savedAuth.bot.savedAt || ""
  });
});

/* =========================
   GET ALL PLAYERS (public)
========================= */

app.get("/api/players", async (req, res) => {
  try {
    const players = await playersCollection
      .find({})
      .sort({ updatedAt: -1, username: 1 })
      .limit(100)
      .toArray();
    return res.json(players.map(publicPlayer));
  } catch (err) {
    console.error("PLAYERS ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   GET ALL PLAYERS (admin/launcher)
========================= */

app.get("/api/players/admin", requireBotSecret, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(1000, Math.floor(limitRaw)))
      : 500;

    let sortQuery = { updatedAt: -1, username: 1 };
    const sort = String(req.query.sort || "updated").toLowerCase();
    if (sort === "username") sortQuery = { username: 1 };
    if (sort === "kills")    sortQuery = { kills: -1, username: 1 };
    if (sort === "gold")     sortQuery = { gold:  -1, username: 1 };

    const players = await playersCollection
      .find({})
      .sort(sortQuery)
      .limit(limit)
      .toArray();

    return res.json({ ok: true, count: players.length, players: players.map(publicPlayer) });
  } catch (err) {
    console.error("PLAYERS ADMIN ERROR:", err);
    return res.status(500).json({ ok: false, error: "db error", message: err.message });
  }
});

/* =========================
   GET ONE PLAYER
========================= */

app.get("/api/player/:name", async (req, res) => {
  const name = normalizeName(req.params.name);
  if (!name) return res.status(400).json({ error: "no name" });
  try {
    const player = await playersCollection.findOne({ username: name });
    if (!player) return res.status(404).json({ error: "not found" });
    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("PLAYER ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   GET CURRENT TWITCH PLAYER
========================= */

app.get("/api/me", verifyExtensionJwt, async (req, res) => {
  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);
    if (!twitchUserId) {
      return res.status(401).json({ error: "identity not shared", needIdentity: true });
    }
    const player = await playersCollection.findOne({ twitch_user_id: twitchUserId });
    if (!player) {
      return res.status(404).json({ error: "player not found", needJoin: true });
    }
    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   JOIN PLAYER
========================= */

app.post("/api/join", requireBotSecret, async (req, res) => {
  const body = parseBody(req);
  if (body.__parseError) return res.status(400).json({ error: "invalid json" });

  const name = getNameFromBody(body);
  const twitchUserId = normalizeTwitchId(
    body.twitchUserId || body.twitch_user_id || body.userId || body.user_id || ""
  );

  if (!name) return res.status(400).json({ error: "no name" });
  if (!twitchUserId) return res.status(400).json({ error: "no twitch user id" });

  try {
    const byTwitchId = await playersCollection.findOne({ twitch_user_id: twitchUserId });
    const byUsername = await playersCollection.findOne({ username: name });

    if (byTwitchId && byUsername && String(byTwitchId._id) !== String(byUsername._id)) {
      return res.status(409).json({ error: "twitch id and username belong to different players" });
    }

    const existingPlayer = byTwitchId || byUsername;

    if (existingPlayer) {
      const result = await playersCollection.findOneAndUpdate(
        { _id: existingPlayer._id },
        { $set: { username: name, twitch_user_id: twitchUserId, twitchLinkedAt: nowIso(), updatedAt: nowIso() } },
        { returnDocument: "after" }
      );
      return res.json(publicPlayer(result.value || result));
    }

    const created = createPlayer(name);
    created.twitch_user_id = twitchUserId;
    created.twitchLinkedAt = nowIso();

    const insertResult = await playersCollection.insertOne(created);
    const player = await playersCollection.findOne({ _id: insertResult.insertedId });
    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("JOIN ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   PRESENCE HEARTBEAT
========================= */

app.post("/api/presence", verifyExtensionJwt, async (req, res) => {
  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);
    if (!twitchUserId) {
      return res.status(401).json({ error: "identity not shared", needIdentity: true });
    }
    const player = await playersCollection.findOne({ twitch_user_id: twitchUserId });
    if (!player) {
      return res.status(404).json({ error: "player not found", needJoin: true });
    }
    const now = nowIso();
    const body = parseBody(req);
    const platform = String(body.platform || "unknown").slice(0, 32);

    await playersCollection.updateOne(
      { twitch_user_id: twitchUserId },
      { $set: { presence_online: true, presence_last_seen: now, presence_platform: platform, presence_updatedAt: now } }
    );
    return res.json({ ok: true, username: player.username, lastSeen: now });
  } catch (err) {
    console.error("PRESENCE ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   GET ACTIVE PRESENCE
========================= */

app.get("/api/presence/active", requireBotSecret, async (req, res) => {
  try {
    const timeoutRaw = Number(req.query.timeout || 60);
    const timeoutSec = Number.isFinite(timeoutRaw)
      ? Math.max(10, Math.min(300, Math.floor(timeoutRaw)))
      : 60;

    const activeSinceIso = new Date(Date.now() - timeoutSec * 1000).toISOString();

    const activePlayers = await playersCollection
      .find({ presence_last_seen: { $gte: activeSinceIso } })
      .project({ username: 1, twitch_user_id: 1, presence_last_seen: 1 })
      .toArray();

    return res.json({
      ok: true,
      timeoutSec,
      players: activePlayers.map(p => ({
        username: p.username,
        twitch_user_id: p.twitch_user_id,
        lastSeen: p.presence_last_seen,
        online: true
      }))
    });
  } catch (err) {
    console.error("PRESENCE ACTIVE ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   CREATE ACTION FROM EXTENSION
========================= */

app.post("/api/action", verifyExtensionJwt, async (req, res) => {
  const body = parseBody(req);
  if (body.__parseError) return res.status(400).json({ error: "invalid json" });

  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);
    if (!twitchUserId) {
      return res.status(401).json({ error: "identity not shared", needIdentity: true });
    }

    const player = await playersCollection.findOne({ twitch_user_id: twitchUserId });
    if (!player) return res.status(404).json({ error: "player not found", needJoin: true });

    let actionType = normalizeActionType(body.type || body.action || "");

    if (!actionType) {
      if (body.stat !== undefined || body.attr !== undefined || body.attribute !== undefined) {
        actionType = "attr";
      } else if (body.node_id !== undefined || body.nodeId !== undefined || body.skill_id !== undefined || body.skillId !== undefined) {
        actionType = "skill_unlock";
      } else if (body.new_class !== undefined || body.class !== undefined || body.reclass !== undefined) {
        actionType = "reclass";
      }
    }

    if (!actionType) {
      return res.status(400).json({ error: "bad action type" });
    }

    const pendingCount = await actionsCollection.countDocuments({
      twitch_user_id: twitchUserId,
      status: { $in: ["pending", "processing"] }
    });
    if (pendingCount >= 20) return res.status(429).json({ error: "too many pending actions" });

    let action;

    if (actionType === "attr") {
      const stat   = normalizeActionStat(body.stat || body.attr || body.attribute || "");
      const amount = normalizeActionAmount(body.amount || 1);

      if (!stat) return res.status(400).json({ error: "bad stat" });

      action = {
        type: "attr",
        stat,
        amount,
        username: player.username,
        twitch_user_id: twitchUserId,
        status: "pending",
        source: "extension",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    } else if (actionType === "skill_unlock") {
      const skillClass = normalizeSkillClass(
        body.class || body.player_class || body.skill_class || player.class || ""
      );
      const nodeId = normalizeNodeId(
        body.node_id || body.nodeId || body.skill_id || body.skillId || ""
      );

      if (!skillClass) return res.status(400).json({ error: "bad class" });
      if (!nodeId) return res.status(400).json({ error: "bad node id" });

      action = {
        type: "skill_unlock",
        class: skillClass,
        node_id: nodeId,
        username: player.username,
        twitch_user_id: twitchUserId,
        status: "pending",
        source: "extension",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    } else if (actionType === "reclass") {
      const nextClass = normalizeSkillClass(
        body.new_class || body.class || body.reclass || ""
      );

      if (!nextClass) return res.status(400).json({ error: "bad class" });

      action = {
        type: "reclass",
        class: nextClass,
        username: player.username,
        twitch_user_id: twitchUserId,
        status: "pending",
        source: "extension",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    } else if (actionType === "reset_attrs") {
      action = {
        type: "reset_attrs",
        class: normalizeSkillClass(body.class || player.class || "") || player.class,
        username: player.username,
        twitch_user_id: twitchUserId,
        status: "pending",
        source: "extension",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    } else if (actionType === "reset_skilltree") {
      action = {
        type: "reset_skilltree",
        class: normalizeSkillClass(body.class || player.class || "") || player.class,
        username: player.username,
        twitch_user_id: twitchUserId,
        status: "pending",
        source: "extension",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    } else {
      return res.status(400).json({ error: "bad action type" });
    }

    const insertResult = await actionsCollection.insertOne(action);
    const createdAction = await actionsCollection.findOne({ _id: insertResult.insertedId });
    return res.json({ ok: true, action: publicAction(createdAction) });
  } catch (err) {
    console.error("ACTION CREATE ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   GET PENDING ACTIONS
========================= */

app.get("/api/actions/pending", requireBotSecret, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(50, Math.floor(limitRaw)))
      : 20;

    const staleIso = new Date(Date.now() - 30000).toISOString();

    const actions = await actionsCollection
      .find({
        $or: [
          { status: "pending" },
          { status: "processing", lockedAt: { $lt: staleIso } }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    if (actions.length === 0) return res.json({ ok: true, actions: [] });

    const ids = actions.map(a => a._id);
    await actionsCollection.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "processing", lockedAt: nowIso(), updatedAt: nowIso() } }
    );
    return res.json({ ok: true, actions: actions.map(publicAction) });
  } catch (err) {
    console.error("ACTIONS PENDING ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   MARK ACTION DONE
========================= */

app.post("/api/actions/done", requireBotSecret, async (req, res) => {
  const body = parseBody(req);
  if (body.__parseError) return res.status(400).json({ error: "invalid json" });

  try {
    const id = String(body.id || body.actionId || body.action_id || "").trim();
    if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "bad action id" });

    const ok = body.ok !== false;
    const message = String(body.message || body.result || "").slice(0, 256);

    const result = await actionsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: ok ? "done" : "failed", doneAt: nowIso(), updatedAt: nowIso(), resultMessage: message } },
      { returnDocument: "after" }
    );

    const action = result && result.value !== undefined ? result.value : result;
    if (!action) return res.status(404).json({ error: "action not found" });
    return res.json({ ok: true, action: publicAction(action) });
  } catch (err) {
    console.error("ACTION DONE ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   UPDATE PLAYER
========================= */

app.post("/api/update", async (req, res) => {
  const body = parseBody(req);
  if (body.__parseError) return res.status(400).json({ error: "invalid json" });

  const name = normalizeName(body.name || body.username);
  const data = body.data;

  if (!name || !data || typeof data !== "object") {
    return res.status(400).json({ error: "no data" });
  }

  const safeUpdate = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) safeUpdate[key] = cleanValue(data[key]);
  }
  safeUpdate.updatedAt = nowIso();

  if (Object.keys(safeUpdate).length === 1) {
    return res.status(400).json({ error: "nothing to update" });
  }

  try {
    const updateResult = await playersCollection.findOneAndUpdate(
      { username: name },
      { $set: safeUpdate },
      { returnDocument: "after" }
    );

    const updatedPlayer = updateResult && updateResult.value !== undefined
      ? updateResult.value
      : updateResult;

    if (updatedPlayer) return res.json(publicPlayer(updatedPlayer));

    const newPlayer = createPlayer(name);
    for (const key of Object.keys(safeUpdate)) newPlayer[key] = safeUpdate[key];

    const insertResult = await playersCollection.insertOne(newPlayer);
    const createdPlayer = await playersCollection.findOne({ _id: insertResult.insertedId });
    return res.json(publicPlayer(createdPlayer));
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    return res.status(500).json({ error: "db error", message: err.message });
  }
});

/* =========================
   PRIVACY & TOS ROUTES (ДОБАВЛЕНО)
========================= */

app.get("/privacy", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(PRIVACY_HTML);
});

app.get("/tos", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(TOS_HTML);
});

/* =========================
   START SERVER
========================= */

async function startServer() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db("sunhero");
    playersCollection = db.collection("players");
    actionsCollection = db.collection("actions");

    await playersCollection.createIndex({ username: 1 }, { unique: true });
    await playersCollection.createIndex({ twitch_user_id: 1 }, { unique: true, sparse: true });
    await playersCollection.createIndex({ presence_last_seen: 1 });
    await actionsCollection.createIndex({ status: 1, createdAt: 1 });
    await actionsCollection.createIndex({ twitch_user_id: 1, status: 1 });
    await actionsCollection.createIndex({ createdAt: 1 });

    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log("SunHero API running on port " + PORT);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

startServer();
