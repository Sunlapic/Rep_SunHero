const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const players = {};

function createPlayer(name) {
    return {
        username: name,
        class: "wizard",
        gold: 6084,

        strength: 5,
        agility: 1001004,
        intellect: 5,
        max_hp: 175,
        hp: 175,
        damage: 1001047,

        class_levels: {
            warrior: 2,
            archer: 9999999,
            wizard: 9
        },

        class_exp: {
            warrior: 130,
            archer: 1030,
            wizard: 320
        },

        class_attr_points: {
            warrior: 3,
            archer: 28999995,
            wizard: 24
        }
    };
}

app.post("/api/join", (req, res) => {
    const name = req.body.name;
    if (!name) return res.json({ error: "no name" });

    if (!players[name]) {
        players[name] = createPlayer(name);
    }

    res.json(players[name]);
});

app.get("/api/players", (req, res) => {
    res.json(players);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
