const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const MONGO_URI =
"mongodb+srv://serjantos1991_db_user:rnoC2mmDmdSZfOYC@cluster0.r9xsnkm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

let db;
let playersCollection;

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

/* =======================
   DATABASE (RAM)
======================= */
const players = {};

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
   JOIN PLAYER
======================= */
app.post("/api/join", (req, res) => {
    const name = req.body.name;

    if (!name) {
        return res.json({ error: "no name" });
    }

    if (!players[name]) {
        players[name] = createPlayer(name);
    }

    res.json(players[name]);
});

/* =======================
   GET ALL PLAYERS
======================= */
app.get("/api/players", (req, res) => {
    res.json(players);
});

/* =======================
   GET ONE PLAYER
======================= */
app.get("/api/player/:name", (req, res) => {
    const name = req.params.name;

    if (!players[name]) {
        return res.json({ error: "not found" });
    }

    res.json(players[name]);
});

/* =======================
   UPDATE PLAYER (для GameMaker)
======================= */
app.post("/api/update", (req, res) => {
    const { name, data } = req.body;

    if (!name || !players[name]) {
        return res.json({ error: "no player" });
    }

    players[name] = {
        ...players[name],
        ...data
    };

    res.json(players[name]);
});

/* =======================
   SERVER START
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
        console.error(err);
    }
}

startServer();
