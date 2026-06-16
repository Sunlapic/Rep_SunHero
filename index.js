const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URL or MONGO_URI is not set");
}

let db;
let playersCollection;
let actionsCollection;

// =============================================
// OAUTH — временное хранилище токенов
// =============================================
const oauthTokens = {}; // { session_id: { token, type, expires } }

// Страница которая ловит токен из URL fragment
app.get("/oauth/callback", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SunHero Auth</title>
    <style>
        body { background: #12121c; color: #fff;
               font-family: Arial; text-align: center;
               padding-top: 100px; }
        h2   { color: #7c5ce4; }
        p    { color: #888; }
    </style>
</head>
<body>
    <h2>SunHero</h2>
    <p id="msg">Получаем токен...</p>
    <script>
        var hash   = window.location.hash.substring(1);
        var params = new URLSearchParams(hash);
        var token  = params.get("access_token");
        var state  = params.get("state"); // содержит session_id и type

        if (token && state) {
            var parts   = state.split("_");
            var session = parts[0];
            var type    = parts[1] || "bot";

            fetch("/oauth/save", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    session_id: session,
                    token:      "oauth:" + token,
                    type:       type
                })
            }).then(function() {
                document.getElementById("msg").textContent =
                    "✅ Токен получен! Можно закрыть вкладку.";
            });
        } else {
            document.getElementById("msg").textContent =
                "❌ Ошибка: токен не получен.";
        }
    </script>
</body>
</html>
    `);
});

// Сохраняем токен от JS страницы
app.post("/oauth/save", (req, res) => {
    const body       = req.body;
    const session_id = String(body.session_id || "").slice(0, 32);
    const token      = String(body.token      || "").slice(0, 512);
    const type       = String(body.type       || "bot").slice(0, 16);

    if (!session_id || !token) {
        return res.status(400).json({ error: "bad params" });
    }

    // Храним 5 минут
    oauthTokens[session_id] = {
        token,
        type,
        expires: Date.now() + 5 * 60 * 1000
    };

    console.log("OAuth token saved: type=" + type + " session=" + session_id);
    return res.json({ ok: true });
});

// GameMaker опрашивает — готов ли токен?
app.get("/oauth/poll", requireBotSecret, (req, res) => {
    const session_id = String(req.query.session || "").slice(0, 32);

    // Чистим просроченные
    for (const key of Object.keys(oauthTokens)) {
        if (oauthTokens[key].expires < Date.now()) {
            delete oauthTokens[key];
        }
    }

    if (!oauthTokens[session_id]) {
        return res.json({ ok: false, ready: false });
    }

    const data = oauthTokens[session_id];
    delete oauthTokens[session_id]; // одноразовый

    return res.json({
        ok:    true,
        ready: true,
        token: data.token,
        type:  data.type
    });
});

const TWITCH_EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET;
const BOT_SECRET = process.env.BOT_SECRET || "";

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

  if (headerToken) {
    return String(headerToken);
  }

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
      return res.status(401).json({
        error: "no extension jwt",
        needIdentity: true
      });
    }

    const payload = jwt.verify(token, getExtensionSecretBuffer(), {
      algorithms: ["HS256"]
    });

    req.ext = payload;

    return next();
  } catch (err) {
    console.error("EXT JWT ERROR:", err.message);

    return res.status(401).json({
      error: "invalid extension jwt",
      needIdentity: true
    });
  }
}

function requireBotSecret(req, res, next) {
  if (!BOT_SECRET) {
    return next();
  }

  const value = req.headers["x-bot-secret"];

  if (value !== BOT_SECRET) {
    return res.status(403).json({
      error: "bad bot secret"
    });
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

    kills: 0,

    dodge: 0,
    dodge_chance: 0,
    dodge_percent: 0,
    evasion: 0,
    evasion_percent: 0,

    class_stats: {
      warrior: { strength: 5, agility: 2, intellect: 2 },
      archer: { strength: 2, agility: 5, intellect: 2 },
      wizard: { strength: 2, agility: 2, intellect: 5 }
    },

    class_levels: {
      warrior: 1,
      archer: 1,
      wizard: 1
    },

    class_exp: {
      warrior: 0,
      archer: 0,
      wizard: 0
    },

    class_attr_points: {
      warrior: 0,
      archer: 0,
      wizard: 0
    },

    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function parseBody(req) {
  let body = req.body;

  if (typeof body === "string") {
    const txt = body.trim();

    if (!txt) return {};

    try {
      body = JSON.parse(txt);
    } catch {
      return { __parseError: true };
    }
  }

  if (!body || typeof body !== "object") return {};

  return body;
}

function getNameFromBody(body) {
  return normalizeName(
    body.name ||
    body.username ||
    body.user ||
    body.player ||
    ""
  );
}

function cleanValue(value, depth = 0) {
  if (depth > 10) return null;

  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, 256);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map(v => cleanValue(v, depth + 1));
  }

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
  return copy;
}

/* =========================
   ALLOWED UPDATE FIELDS
========================= */

const allowedFields = [
  "class",
  "gold",

  "strength",
  "agility",
  "intellect",

  "hp",
  "max_hp",
  "damage",
  "armor",
  "magic_res",
  "attack_spd",
  "kills",

  "dodge",
  "dodge_chance",
  "dodge_percent",
  "evasion",
  "evasion_percent",

  "class_stats",
  "class_levels",
  "class_exp",
  "class_attr_points"
];

/* =========================
   ACTION HELPERS
========================= */

function normalizeActionStat(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (
    raw === "str" ||
    raw === "strength" ||
    raw === "сил" ||
    raw === "сила"
  ) {
    return "str";
  }

  if (
    raw === "agi" ||
    raw === "agility" ||
    raw === "лов" ||
    raw === "ловкость"
  ) {
    return "agi";
  }

  if (
    raw === "int" ||
    raw === "intellect" ||
    raw === "инт" ||
    raw === "интеллект"
  ) {
    return "int";
  }

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

function publicAction(action) {
  if (!action) return null;

  return {
    id: String(action._id),
    type: action.type,
    stat: action.stat,
    amount: action.amount,
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
      "GET /api/players",
      "GET /api/player/:name",
      "GET /api/me",
      "POST /api/action",
      "GET /api/actions/pending",
      "POST /api/actions/done",
      "POST /api/join",
      "POST /api/update",
      "POST /api/presence",          // ✅ НОВОЕ
      "GET /api/presence/active"     // ✅ НОВОЕ
    ]
  });
});

// ✅ ИЗМЕНЕНО: добавлен activePresence
app.get("/health", async (req, res) => {
  try {
    const count = playersCollection
      ? await playersCollection.countDocuments()
      : 0;

    const pendingActions = actionsCollection
      ? await actionsCollection.countDocuments({ status: "pending" })
      : 0;

    // Считаем игроков, активных за последние 60 секунд
    const activeSinceIso = new Date(Date.now() - 60 * 1000).toISOString();
    const activePresence = playersCollection
      ? await playersCollection.countDocuments({
          presence_last_seen: { $gte: activeSinceIso }
        })
      : 0;

    res.json({
      ok: true,
      mongo: Boolean(playersCollection),
      players: count,
      pendingActions,
      activePresence,           // ✅ НОВОЕ
      twitchSecret: Boolean(process.env.TWITCH_EXTENSION_SECRET),
      botSecret: Boolean(process.env.BOT_SECRET),
      time: nowIso()
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "health error"
    });
  }
});

/* =========================
   JOIN PLAYER
========================= */

app.post("/api/join", requireBotSecret, async (req, res) => {
  const body = parseBody(req);

  if (body.__parseError) {
    return res.status(400).json({ error: "invalid json" });
  }

  const name = getNameFromBody(body);

  const twitchUserId = normalizeTwitchId(
    body.twitchUserId ||
    body.twitch_user_id ||
    body.userId ||
    body.user_id ||
    ""
  );

  if (!name) {
    return res.status(400).json({ error: "no name" });
  }

  if (!twitchUserId) {
    return res.status(400).json({
      error: "no twitch user id"
    });
  }

  try {
    const byTwitchId = await playersCollection.findOne({
      twitch_user_id: twitchUserId
    });

    const byUsername = await playersCollection.findOne({
      username: name
    });

    if (
      byTwitchId &&
      byUsername &&
      String(byTwitchId._id) !== String(byUsername._id)
    ) {
      return res.status(409).json({
        error: "twitch id and username belong to different players"
      });
    }

    const existingPlayer = byTwitchId || byUsername;

    if (existingPlayer) {
      const result = await playersCollection.findOneAndUpdate(
        { _id: existingPlayer._id },
        {
          $set: {
            username: name,
            twitch_user_id: twitchUserId,
            twitchLinkedAt: nowIso(),
            updatedAt: nowIso()
          }
        },
        {
          returnDocument: "after"
        }
      );

      return res.json(publicPlayer(result.value || result));
    }

    const created = createPlayer(name);

    created.twitch_user_id = twitchUserId;
    created.twitchLinkedAt = nowIso();

    const insertResult = await playersCollection.insertOne(created);

    const player = await playersCollection.findOne({
      _id: insertResult.insertedId
    });

    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("JOIN ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   GET ALL PLAYERS
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

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   GET ONE PLAYER
========================= */

app.get("/api/player/:name", async (req, res) => {
  const name = normalizeName(req.params.name);

  if (!name) {
    return res.status(400).json({ error: "no name" });
  }

  try {
    const player = await playersCollection.findOne({ username: name });

    if (!player) {
      return res.status(404).json({ error: "not found" });
    }

    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("PLAYER ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   GET CURRENT TWITCH PLAYER
========================= */

app.get("/api/me", verifyExtensionJwt, async (req, res) => {
  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);

    if (!twitchUserId) {
      return res.status(401).json({
        error: "identity not shared",
        needIdentity: true
      });
    }

    const player = await playersCollection.findOne({
      twitch_user_id: twitchUserId
    });

    if (!player) {
      return res.status(404).json({
        error: "player not found",
        needJoin: true
      });
    }

    return res.json(publicPlayer(player));
  } catch (err) {
    console.error("ME ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   ✅ НОВОЕ: PRESENCE HEARTBEAT
   Зритель сообщает, что он онлайн
========================= */

app.post("/api/presence", verifyExtensionJwt, async (req, res) => {
  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);

    // Зритель не дал доступ к своему ID
    if (!twitchUserId) {
      return res.status(401).json({
        error: "identity not shared",
        needIdentity: true
      });
    }

    // Ищем игрока по Twitch ID
    const player = await playersCollection.findOne({
      twitch_user_id: twitchUserId
    });

    // Игрока нет — он ещё не сделал !join
    if (!player) {
      return res.status(404).json({
        error: "player not found",
        needJoin: true
      });
    }

    const now = nowIso();
    const body = parseBody(req);
    const platform = String(body.platform || "unknown").slice(0, 32);

    // Обновляем данные присутствия
    await playersCollection.updateOne(
      { twitch_user_id: twitchUserId },
      {
        $set: {
          presence_online: true,
          presence_last_seen: now,
          presence_platform: platform,
          presence_updatedAt: now
        }
      }
    );

    return res.json({
      ok: true,
      username: player.username,
      lastSeen: now
    });
  } catch (err) {
    console.error("PRESENCE ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   ✅ НОВОЕ: GET ACTIVE PRESENCE
   GameMaker забирает список онлайн-игроков
========================= */

app.get("/api/presence/active", requireBotSecret, async (req, res) => {
  try {
    // Таймаут в секундах, по умолчанию 60
    const timeoutRaw = Number(req.query.timeout || 60);
    const timeoutSec = Number.isFinite(timeoutRaw)
      ? Math.max(10, Math.min(300, Math.floor(timeoutRaw)))
      : 60;

    // ISO-строка момента отсечки (сейчас минус таймаут)
    const activeSinceIso = new Date(Date.now() - timeoutSec * 1000).toISOString();

    // Все игроки, у которых presence_last_seen >= отсечки
    const activePlayers = await playersCollection
      .find({
        presence_last_seen: { $gte: activeSinceIso }
      })
      .project({
        username: 1,
        twitch_user_id: 1,
        presence_last_seen: 1
      })
      .toArray();

    const players = activePlayers.map(p => ({
      username: p.username,
      twitch_user_id: p.twitch_user_id,
      lastSeen: p.presence_last_seen,
      online: true
    }));

    return res.json({
      ok: true,
      timeoutSec,
      players
    });
  } catch (err) {
    console.error("PRESENCE ACTIVE ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   CREATE ACTION FROM EXTENSION
   Кнопка панели создаёт действие в очереди
========================= */

app.post("/api/action", verifyExtensionJwt, async (req, res) => {
  const body = parseBody(req);

  if (body.__parseError) {
    return res.status(400).json({ error: "invalid json" });
  }

  try {
    const twitchUserId = normalizeTwitchId(req.ext && req.ext.user_id);

    if (!twitchUserId) {
      return res.status(401).json({
        error: "identity not shared",
        needIdentity: true
      });
    }

    const stat = normalizeActionStat(
      body.stat ||
      body.attr ||
      body.attribute ||
      ""
    );

    const amount = normalizeActionAmount(body.amount || 1);

    if (!stat) {
      return res.status(400).json({
        error: "bad stat"
      });
    }

    const player = await playersCollection.findOne({
      twitch_user_id: twitchUserId
    });

    if (!player) {
      return res.status(404).json({
        error: "player not found",
        needJoin: true
      });
    }

    const pendingCount = await actionsCollection.countDocuments({
      twitch_user_id: twitchUserId,
      status: { $in: ["pending", "processing"] }
    });

    if (pendingCount >= 20) {
      return res.status(429).json({
        error: "too many pending actions"
      });
    }

    const action = {
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

    const insertResult = await actionsCollection.insertOne(action);

    const createdAction = await actionsCollection.findOne({
      _id: insertResult.insertedId
    });

    return res.json({
      ok: true,
      action: publicAction(createdAction)
    });
  } catch (err) {
    console.error("ACTION CREATE ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   GET PENDING ACTIONS FOR GAMEMAKER
   GameMaker забирает очередь действий
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
          {
            status: "processing",
            lockedAt: { $lt: staleIso }
          }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    if (actions.length === 0) {
      return res.json({
        ok: true,
        actions: []
      });
    }

    const ids = actions.map(a => a._id);

    await actionsCollection.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: "processing",
          lockedAt: nowIso(),
          updatedAt: nowIso()
        }
      }
    );

    return res.json({
      ok: true,
      actions: actions.map(publicAction)
    });
  } catch (err) {
    console.error("ACTIONS PENDING ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   MARK ACTION DONE
   GameMaker сообщает, что действие выполнено
========================= */

app.post("/api/actions/done", requireBotSecret, async (req, res) => {
  const body = parseBody(req);

  if (body.__parseError) {
    return res.status(400).json({ error: "invalid json" });
  }

  try {
    const id = String(
      body.id ||
      body.actionId ||
      body.action_id ||
      ""
    ).trim();

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "bad action id"
      });
    }

    const ok = body.ok !== false;

    const message = String(
      body.message ||
      body.result ||
      ""
    ).slice(0, 256);

    const result = await actionsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: ok ? "done" : "failed",
          doneAt: nowIso(),
          updatedAt: nowIso(),
          resultMessage: message
        }
      },
      {
        returnDocument: "after"
      }
    );

    const action = result && result.value !== undefined
      ? result.value
      : result;

    if (!action) {
      return res.status(404).json({
        error: "action not found"
      });
    }

    return res.json({
      ok: true,
      action: publicAction(action)
    });
  } catch (err) {
    console.error("ACTION DONE ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
});

/* =========================
   UPDATE PLAYER
========================= */

app.post("/api/update", async (req, res) => {
  const body = parseBody(req);

  if (body.__parseError) {
    return res.status(400).json({ error: "invalid json" });
  }

  const name = normalizeName(body.name || body.username);
  const data = body.data;

  if (!name || !data || typeof data !== "object") {
    return res.status(400).json({
      error: "no data"
    });
  }

  const safeUpdate = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      safeUpdate[key] = cleanValue(data[key]);
    }
  }

  safeUpdate.updatedAt = nowIso();

  if (Object.keys(safeUpdate).length === 1) {
    return res.status(400).json({
      error: "nothing to update"
    });
  }

  try {
    const updateResult = await playersCollection.findOneAndUpdate(
      { username: name },
      {
        $set: safeUpdate
      },
      {
        returnDocument: "after"
      }
    );

    const updatedPlayer = updateResult && updateResult.value !== undefined
      ? updateResult.value
      : updateResult;

    if (updatedPlayer) {
      return res.json(publicPlayer(updatedPlayer));
    }

    const newPlayer = createPlayer(name);

    for (const key of Object.keys(safeUpdate)) {
      newPlayer[key] = safeUpdate[key];
    }

    const insertResult = await playersCollection.insertOne(newPlayer);

    const createdPlayer = await playersCollection.findOne({
      _id: insertResult.insertedId
    });

    return res.json(publicPlayer(createdPlayer));
  } catch (err) {
    console.error("UPDATE ERROR:", err);

    return res.status(500).json({
      error: "db error",
      message: err.message
    });
  }
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

    await playersCollection.createIndex(
      { username: 1 },
      { unique: true }
    );

    await playersCollection.createIndex(
      { twitch_user_id: 1 },
      { unique: true, sparse: true }
    );

    // ✅ НОВОЕ: индекс для быстрого поиска по presence_last_seen
    await playersCollection.createIndex(
      { presence_last_seen: 1 }
    );

    await actionsCollection.createIndex(
      { status: 1, createdAt: 1 }
    );

    await actionsCollection.createIndex(
      { twitch_user_id: 1, status: 1 }
    );

    await actionsCollection.createIndex(
      { createdAt: 1 }
    );

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
