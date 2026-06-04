const API = "https://rep-sunhero.onrender.com";
const panel = document.getElementById("panel");

async function loadPlayer() {
    try {
        const res = await fetch(API + "/api/players");
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        const list = Array.isArray(data) ? data : Object.values(data);

        if (!list || list.length === 0) {
            panel.innerHTML = '<div class="err">Нет игроков. Напишите !join в чат.</div>';
            return;
        }

        render(list[0]);
    } catch (e) {
        panel.innerHTML = '<div class="err">Ошибка загрузки: ' + e.message + '</div>';
    }
}

function render(p) {
    const cl = p.class_levels || { warrior:"-", archer:"-", wizard:"-" };
    panel.innerHTML =
        '<div class="row"><div class="label">Name</div><div class="value">' + (p.username ?? "-") + '</div></div>' +
        '<div class="row"><div class="label">Class</div><div class="value class">' + (p.class ?? "-") + '</div></div>' +
        '<div class="row"><div class="label">Gold</div><div class="value gold">' + (p.gold ?? 0) + '</div></div>' +
        '<div class="row"><div class="label">HP</div><div class="value hp">' + (p.hp ?? 0) + '/' + (p.max_hp ?? 0) + '</div></div>' +
        '<hr>' +
        '<div class="row"><div class="label">Strength</div><div class="value">' + (p.strength ?? 0) + '</div></div>' +
        '<div class="row"><div class="label">Agility</div><div class="value">' + (p.agility ?? 0) + '</div></div>' +
        '<div class="row"><div class="label">Intellect</div><div class="value">' + (p.intellect ?? 0) + '</div></div>' +
        '<div class="row"><div class="label">Damage</div><div class="value">' + (p.damage ?? 0) + '</div></div>' +
        '<hr>' +
        '<div class="row"><div class="label">Warrior Lv</div><div class="value">' + cl.warrior + '</div></div>' +
        '<div class="row"><div class="label">Archer Lv</div><div class="value">' + cl.archer + '</div></div>' +
        '<div class="row"><div class="label">Wizard Lv</div><div class="value">' + cl.wizard + '</div></div>';
}

loadPlayer();
setInterval(loadPlayer, 3000);
