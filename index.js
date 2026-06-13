const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URL or MONGO_URI is not set");
}

let db;
let playersCollection;
const TWITCH_EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET;
const BOT_SECRET = process.env.BOT_SECRET || "";

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

  "class_stats",
  "class_levels",
  "class_exp",
  "class_attr_points"
];

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
  "POST /api/join",
  "POST /api/update"
]
  });
});

app.get("/health", async (req, res) => {
  try {
    const count = playersCollection
      ? await playersCollection.countDocuments()
      : 0;

    res.json({
      ok: true,
      mongo: Boolean(playersCollection),
      players: count,
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

app.post("/api/join", async (req, res) => {
  const body = parseBody(req);

  if (body.__parseError) {
    return res.status(400).json({ error: "invalid json" });
  }

  const name = getNameFromBody(body);

  if (!name) {
    return res.status(400).json({ error: "no name" });
  }

  try {
    const created = createPlayer(name);

    const result = await playersCollection.findOneAndUpdate(
      { username: name },
      {
        $setOnInsert: created,
        $set: { updatedAt: nowIso() }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    return res.json(publicPlayer(result.value || result));
  } catch (err) {
    console.error("JOIN ERROR:", err);

    return res.status(500).json({
      error: "db error"
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
      error: "db error"
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
      error: "db error"
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
      error: "db error"
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
    const basePlayer = createPlayer(name);

    const result = await playersCollection.findOneAndUpdate(
      { username: name },
      {
        $setOnInsert: basePlayer,
        $set: safeUpdate
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    return res.json(publicPlayer(result.value || result));
  } catch (err) {
    console.error("UPDATE ERROR:", err);

    return res.status(500).json({
      error: "db error"
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

    await playersCollection.createIndex(
      { username: 1 },
      { unique: true }
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
