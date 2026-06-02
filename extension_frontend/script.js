const API = "https://rep-sunhero.onrender.com";

async function join() {
  await fetch(API + "/api/join", { method: "POST" });
  loadStats();
}

async function loadStats() {
  const res = await fetch(API + "/api/players");
  const data = await res.json();

  document.getElementById("stats").innerText =
    JSON.stringify(data, null, 2);
}

loadStats();
