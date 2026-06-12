const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

/* =======================
   MONGO URI (через env!)
======================= */
const MONGO_URI = process.env.MONGO_URL;

/* =======================
   DB
======================= */
let db;
let playersCollection;
const lastUpdate = {};

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());
app.use(express.text()); // ← FIX: Добавлено для чтения запросов от http_post_string()

/* =======================
   CREATE PLAYER
======================= */
function createPlayer(name) {
    return {
        username: name,
        class: "warrior",

        gold: 0,

        strength: 5,
        agility: 2,
        intellect: 2,

        max_hp: 100,
        hp: 100,
        damage: 10,

        class_stats: {
            warrior: {
                strength: 5,
                agility: 2,
                intellect: 2            },

            archer: {
                strength: 2,
                agility: 5,
                intellect: 2
            },

            wizard: {
                strength: 2,
                agility: 2,
                intellect: 5
            }
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
        }
    };
}

/* =======================
   JOIN PLAYER (MongoDB)
======================= */
app.post("/api/join", async (req, res) => {
    const name = req.body.name;

    if (!name) {
        return res.json({ error: "no name" });
    }

    try {
        let player = await playersCollection.findOne({ username: name });

        if (!player) {
            player = createPlayer(name);
            await playersCollection.insertOne(player);
        }

        return res.json(player);

    } catch (err) {
        console.error(err);
        return res.json({ error: "db error" });
    }
});

/* =======================
   GET ALL PLAYERS
======================= */
app.get("/api/players", async (req, res) => {
    try {
        const players = await playersCollection.find().toArray();
        return res.json(players);
    } catch (err) {
        return res.json({ error: "db error" });
    }
});

/* =======================
   GET ONE PLAYER
======================= */
app.get("/api/player/:name", async (req, res) => {
    const name = req.params.name;

    try {
        const player = await playersCollection.findOne({ username: name });

        if (!player) {
            return res.json({ error: "not found" });
        }

        return res.json(player);

    } catch (err) {
        console.error(err);
        return res.json({ error: "db error" });
    }
});

/* =======================
   UPDATE PLAYER (С полной поддержкой text и json от GameMaker)
======================= */
app.post("/api/update", async (req, res) => {
    let body = req.body;

    // FIX: Если GameMaker прислал данные в виде текстовой строки, 
    // парсим её в полноценный JavaScript объект
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return res.json({ error: "invalid json string" });
        }
    }

    const { name, data } = body;

    if (!name || !data) {
        return res.json({ error: "no data" });
    }

    const now = Date.now();

    // Защита от спама на сервере
    if (lastUpdate[name] && now - lastUpdate[name] < 500) {
        return res.json({ error: "too fast" });
    }

    lastUpdate[name] = now;

    try {
        const allowedFields = [
    "gold",
    "strength",
    "agility",
    "intellect",
    "hp",
    "max_hp",
    "damage",
    "class",
    "armor",
    "magic_res",
    "attack_spd",
    "kills",
    "class_levels",
    "class_exp",
    "class_attr_points",
    "class_stats"
];

        let safeUpdate = {};

        // Очистка дробных чисел из GameMaker (875.0 -> 875)
        const cleanGameMakerNumbers = (val) => {
            if (typeof val === "number") {
                return Number.isInteger(val) ? val : Math.round(val); 
            }
            if (val && typeof val === "object" && !Array.isArray(val)) {
                let cleanedObj = {};
                for (const k in val) {
                    cleanedObj[k] = cleanGameMakerNumbers(val[k]);
                }
                return cleanedObj;
            }
            return val;
        };

        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                safeUpdate[key] = cleanGameMakerNumbers(data[key]);
            }
        }

        if (Object.keys(safeUpdate).length === 0) {
            return res.json({ error: "nothing to update" });
        }

        const result = await playersCollection.findOneAndUpdate(
            { username: name },
            { $set: safeUpdate },
            { returnDocument: "after" }
        );

        if (!result) {
            console.log("UPDATE FAILED: Player not found in DB");
            return res.json({ error: "player not found" });
        }

        // Универсальный фикс для старых и новых версий драйвера MongoDB
        const updatedDocument = result.value ? result.value : result;

        return res.json(updatedDocument);

    } catch (err) {
        console.error("UPDATE ERROR:", err);
        return res.json({ error: "db error" });
    }
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 10000;

async function startServer() {
    try {
        const client = new MongoClient(MONGO_URI);

        await client.connect();

        db = client.db("sunhero");
        playersCollection = db.collection("players");

        console.log("MongoDB connected");

        app.listen(PORT, () => {
            console.log("Server running on port " + PORT);
        });

    } catch (err) {
        console.error("MongoDB connection error:", err);
    }
}

startServer();
