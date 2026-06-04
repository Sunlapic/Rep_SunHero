const API = "https://rep-sunhero.onrender.com";
const ui = document.getElementById("ui");

async function load() {
    try {
        const res = await fetch(API + "/api/players");
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        const list = Array.isArray(data) ? data : Object.values(data);

        if (!list || list.length === 0) {
            ui.innerHTML = '<div class="err">Нет игроков. Напишите !join</div>';
            return;
        }

        const p = list[0];

        ui.innerHTML =
            '<div class="row"><div class="label">Name</div><div class="value">' + (p.username ?? "-") + '</div></div>' +
            '<div class="row"><div class="label">Class</div><div class="value">' + (p.class ?? "-") + '</div></div>' +
            '<div class="row"><div class="label">Gold</div><div class="value">' + (p.gold ?? 0) + '</div></div>' +
            '<div class="row"><div class="label">HP</div><div class="value">' + (p.hp ?? 0) + '/' + (p.max_hp ?? 0) + '</div></div>' +
            '<div class="row"><div class="label">STR</div><div class="value">' + (p.strength ?? 0) + '</div></div>' +
            '<div class="row"><div class="label">AGI</div><div class="value">' + (p.agility ?? 0) + '</div></div>' +
            '<div class="row"><div class="label">INT</div><div class="value">' + (p.intellect ?? 0) + '</div></div>';
    } catch (e) {
        ui.innerHTML = '<div class="err">Ошибка: ' + e.message + '</div>';
    }
}

load();
setInterval(load, 3000);
