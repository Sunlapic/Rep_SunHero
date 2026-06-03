const express = require("express");
const app = express();

app.use(express.json());

const players = {};

// GET players
app.get("/api/players", (req, res) => {
    res.json(players);
});

// JOIN player
app.post("/api/join", (req, res) => {
    const name = req.body.name;

    if (!name) return res.json({ error: "no name" });

    if (!players[name]) {
        players[name] = {
            class: "warrior",
            level: 1,
            gold: 0,
            hp: 100,
            max_hp: 100
        };
    }

    res.json(players[name]);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
