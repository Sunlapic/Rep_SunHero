const API = "https://rep-sunhero.onrender.com";

const username = "test_user";

async function join() {
  await fetch(API + "/api/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: username
    })
  });

  loadStats();
}

async function loadStats() {
  const res = await fetch(API + "/api/players");
  const data = await res.json();

  document.getElementById("stats").innerText =
    JSON.stringify(data, null, 2);
}

loadStats();
