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

/* =======================
   CREATE PLAYER
======================= */
function createPlayer(name) {
    return {
        username: name,
        class: "wizard",

        gold: 0,

        strength: 5,
        agility: 10,
        intellect: 5,

        max_hp: 100,
        hp: 100,
        damage: 10,

       class_stats: {
    warrior: {
        strength: 5,
        agility: 5,
        intellect: 5
    },

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

        res.json(player);

    } catch (err) {
        console.error(err);
        res.json({ error: "db error" });
    }
});

/* =======================
   GET ALL PLAYERS
======================= */
app.get("/api/players", async (req, res) => {
    try {
        const players = await playersCollection.find().toArray();
        res.json(players);
    } catch (err) {
        res.json({ error: "db error" });
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

        res.json(player);

    } catch (err) {
        res.json({ error: "db error" });
    }
});

/* =======================
   UPDATE PLAYER
======================= */
app.post("/api/update", async (req, res) => {
    const { name, data } = req.body;

    if (!name || !data) {
        return res.json({ error: "no data" });
    }
   const now = Date.now();

    if (lastUpdate[name] && now - lastUpdate[name] < 500) {
        return res.json({ error: "too fast" });
    }

    lastUpdate[name] = now;

    try {
        // разрешаем обновлять только эти поля (защита)
        const allowedFields = [
    "gold",
    "strength",
    "agility",
    "intellect",
    "hp",
    "max_hp",
    "damage",
    "class",

    "class_levels",
    "class_exp",
    "class_attr_points",

    "class_stats" // характеристики каждого класса
];

        let safeUpdate = {};

        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                safeUpdate[key] = data[key];
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

        res.json(result.value);

    } catch (err) {
        console.error(err);
        res.json({ error: "db error" });
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
