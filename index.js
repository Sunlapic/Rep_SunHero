const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

// 📦 хранилище игроков (пока в памяти)
let players = {};

// 🔘 JOIN кнопка (Twitch Extension)
app.post("/api/join", (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.json({ error: "no username" });
    }

    // если игрока нет — создаём
    if (!players[username]) {
        players[username] = {
            username: username,
            class: "warrior",
            level: 1,
            hp: 100,
            max_hp: 100,
            gold: 0,
            damage: 10
        };
    }

    res.json(players[username]);
});

// 📊 получить одного игрока
app.get("/api/player", (req, res) => {
    const username = req.query.username;
    res.json(players[username] || null);
});

// 📋 список всех игроков (для GameMaker)
app.get("/api/players", (req, res) => {
    res.json(players);
});

// 🚀 запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
