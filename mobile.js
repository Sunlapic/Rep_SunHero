const API = "https://rep-sunhero.onrender.com";
const ui  = document.getElementById("ui");

// подсказки по классу (синхронизированы с scr_recalc_stats)
function statHints(p) {
    const c = p.class || "warrior";
    const h = { str:"+10 HP +1.5 атк", agi:"+1 атк +уворот", int:"+1 атк +0.5 МЗ" };
    if (c === "warrior") h.str = "+14 HP +2 атк +брн";
    if (c === "archer")  h.agi = "+2 атк +скорость +уворот";
    if (c === "wizard")  h.int = "+2.5 атк +МЗ";
    return h;
}

function copyCmd(cmd) {
    navigator.clipboard.writeText(cmd).then(() => {
        document.getElementById("hint").textContent = "✓ " + cmd + " — вставь в чат!";
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
            ui.innerHTML = '<div class="err">Нет игроков.<br>Напишите !join в чат</div>';
            return;
        }
        render(list[0]);
    } catch (e) {
        ui.innerHTML = '<div class="err">Ошибка: ' + e.message + '</div>';
    }
}

function render(p) {
    const lvl   = (p.class_levels && p.class_levels[p.class]) || 1;
    const pts   = (p.class_attr_points && p.class_attr_points[p.class]) || 0;
    const hpPct = p.max_hp ? Math.round(p.hp / p.max_hp * 100) : 0;
    const h     = statHints(p);

    ui.innerHTML =
      '<div class="who"><b>' + (p.username ?? "-") + '</b> ' +
      '<span>' + (p.class ?? "-") + '·' + lvl + '</span></div>' +

      '<div class="hpbar"><div class="hpfill" style="width:' + hpPct + '%"></div>' +
      '<div class="hptext">' + (p.hp ?? 0) + '/' + (p.max_hp ?? 0) + '</div></div>' +

      // статы в 2 колонки — компактно для узкого экрана
      '<div class="grid">' +
        '<span class="l">🪙 <span class="gold">' + (p.gold ?? 0) + '</span></span>' +
        '<span class="l">⚔ <span class="w">' + (p.damage ?? 0) + '</span></span>' +
        '<span class="l">🛡 <span class="w">' + (p.armor ?? 0) + '·' + (p.magic_res ?? 0) + '</span></span>' +
        '<span class="l">✨ <span class="pts">' + pts + ' очк</span></span>' +
      '</div>' +

      // кнопки СТОЛБИКОМ — широкие, под палец
      '<div class="btns">' +
        '<button class="btn b-str" onclick="copyCmd(\'!str 1\')">💪 СИЛА ' + (p.strength ?? 0) +
            ' <small>' + h.str + '</small></button>' +
        '<button class="btn b-agi" onclick="copyCmd(\'!agi 1\')">🏃 ЛОВКОСТЬ ' + (p.agility ?? 0) +
            ' <small>' + h.agi + '</small></button>' +
        '<button class="btn b-int" onclick="copyCmd(\'!int 1\')">🔮 ИНТЕЛЛЕКТ ' + (p.intellect ?? 0) +
            ' <small>' + h.int + '</small></button>' +
      '</div>' +
      '<div class="hint" id="hint">кнопка копирует команду для чата</div>';
}

load();
setInterval(load, 3000);
