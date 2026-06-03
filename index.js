const express = require("express");
const app = express();

app.use(express.json());

const players = {};

// создать игрока
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
        }
    };
}

// JOIN игрока
app.post("/api/join", (req, res) => {
    const name = req.body.name;

    if (!name) return res.json({ error: "no name" });

    if (!players[name]) {
        players[name] = createPlayer(name);
    }

    res.json(players[name]);
});

// получить всех игроков
app.get("/api/players", (req, res) => {
    res.json(players);
});

app.listen(10000, () => {
    console.log("Server running on port 10000");
});
