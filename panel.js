const API = "https://rep-sunhero.onrender.com";
const ui  = document.getElementById("ui");

// ── что даёт +1 атрибута (синхронизировано с scr_recalc_stats!) ──
function statHints(p) {
    const c = p.class || "warrior";
    const h = { str:"+10 HP  +1.5 атк", agi:"+1 атк  +увернт", int:"+1 атк  +0.5 МЗ" };
    if (c === "warrior") h.str = "+14 HP  +2 атк  +0.8 брн";
    if (c === "archer")  h.agi = "+2 атк  +скорость  +уворот";
    if (c === "wizard")  h.int = "+2.5 атк  +0.8 МЗ";
    return h;
}

// ── кнопка: копируем команду в буфер (вариант А) ──
function copyCmd(cmd) {
    navigator.clipboard.writeText(cmd).then(() => {
        document.getElementById("hint").textContent = "Скопировано: " + cmd + " — вставь в чат!";
    }).catch(() => {
        document.getElementById("hint").textContent = "Напиши в чат: " + cmd;
    });
}

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
        render(list[0]);   // TODO: потом — выбор своего ника
    } catch (e) {
        ui.innerHTML = '<div class="err">Ошибка: ' + e.message + '</div>';
    }
}

function render(p) {
    const lvl   = (p.class_levels && p.class_levels[p.class]) || 1;
    const pts   = (p.class_attr_points && p.class_attr_points[p.class]) || 0;
    const hpPct = p.max_hp ? Math.round(p.hp / p.max_hp * 100) : 0;
    const h     = statHints(p);
    const aps   = p.attack_spd ? (60 / p.attack_spd).toFixed(1) : "-";

    ui.innerHTML =
      '<div class="row"><span class="label">' + (p.username ?? "-") + '</span>' +
      '<span class="cls">' + (p.class ?? "-") + ' · ' + lvl + ' ур</span></div>' +

      '<div class="hpbar"><div class="hpfill" style="width:' + hpPct + '%"></div>' +
      '<div class="hptext">' + (p.hp ?? 0) + ' / ' + (p.max_hp ?? 0) + '</div></div>' +

      '<div class="row"><span class="label">🪙 Золото</span><span class="value gold">' + (p.gold ?? 0) + '</span></div>' +
      '<div class="row"><span class="label">⚔ Атака · СкА</span><span class="value">' + (p.damage ?? 0) + ' · ' + aps + '/с</span></div>' +
      '<div class="row"><span class="label">🛡 Броня · МЗ</span><span class="value">' + (p.armor ?? 0) + ' · ' + (p.magic_res ?? 0) + '</span></div>' +
      '<div class="row"><span class="label">✨ Очки атрибутов</span><span class="value pts">' + pts + '</span></div>' +

      '<hr>' +
      '<div class="btns">' +
        '<button class="btn b-str" onclick="copyCmd(\'!str 1\')">💪 STR ' + (p.strength ?? 0) + '<small>' + h.str + '</small></button>' +
        '<button class="btn b-agi" onclick="copyCmd(\'!agi 1\')">🏃 AGI ' + (p.agility ?? 0) + '<small>' + h.agi + '</small></button>' +
        '<button class="btn b-int" onclick="copyCmd(\'!int 1\')">🔮 INT ' + (p.intellect ?? 0) + '<small>' + h.int + '</small></button>' +
      '</div>' +
      '<div class="hint" id="hint">кнопка копирует команду — вставь в чат</div>';
}

load();
setInterval(load, 3000);
