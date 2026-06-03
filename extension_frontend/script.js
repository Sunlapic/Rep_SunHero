const API = "https://rep-sunhero.onrender.com";

let current = null;

async function join() {
    const name = "sun_" + Math.floor(Math.random()*10000);

    const res = await fetch(API + "/api/join", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ name })
    });

    current = await res.json();
    render();
}

function render() {
    if (!current) return;

    const hpPercent = (current.hp / current.max_hp) * 100;

    document.getElementById("player").innerHTML = `
        <div class="card">

            <h3>${current.username}</h3>

            <div class="hpbar">
                <div class="hpfill" style="width:${hpPercent}%"></div>
            </div>

            <div class="row"><span>Class</span><span>${current.class}</span></div>
            <div class="row gold"><span>Gold</span><span>${current.gold}</span></div>

            <hr>

            <div class="row"><span>STR</span><span>${current.strength}</span></div>
            <div class="row"><span>AGI</span><span>${current.agility}</span></div>
            <div class="row"><span>INT</span><span>${current.intellect}</span></div>

            <hr>

            <div class="row"><span>Warrior</span><span>${current.class_levels.warrior}</span></div>
            <div class="row"><span>Archer</span><span>${current.class_levels.archer}</span></div>
            <div class="row"><span>Wizard</span><span>${current.class_levels.wizard}</span></div>

        </div>
    `;
}
