// Initialize Gun with public relay
const gun = Gun({ peers: ["https://gun-manhattan.herokuapp.com/gun"] });

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let roomID = null;
let room = null;
const playerID = Math.random().toString(36).substr(2, 5);

// Local game state
const players = {}; // { playerID: { x, y, color, lastUpdate } }

// Utils
function generateRoomID(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < length; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// DOM Elements
const roomDisplay = document.getElementById("roomIDDisplay");
const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const joinRoomInput = document.getElementById("joinRoomID");
const passwordInput = document.getElementById("roomPassword");

// --- CREATE ROOM ---
createRoomBtn.addEventListener("click", async () => {
  const password = passwordInput.value.trim();
  if (!password) return alert("Enter a password");

  roomID = generateRoomID();
  roomDisplay.textContent = roomID;
  room = gun.get(roomID);

  // Save hashed password
  const hash = await hashPassword(password);
  room.get("password").put(hash);

  initRoom();
  console.log("Room created:", roomID);
});

// --- JOIN ROOM ---
joinRoomBtn.addEventListener("click", async () => {
  const inputID = joinRoomInput.value.trim().toUpperCase();
  const password = passwordInput.value.trim();
  if (!inputID || !password) return alert("Enter Room ID and password");

  roomID = inputID;
  roomDisplay.textContent = roomID;
  room = gun.get(roomID);

  room.get("password").once(async (hash) => {
    const inputHash = await hashPassword(password);
    if (hash === inputHash) {
      initRoom();
      console.log("Joined room:", roomID);
    } else {
      alert("Incorrect password!");
      roomID = null;
      room = null;
      roomDisplay.textContent = "None";
    }
  });
});

// --- INIT ROOM ---
function initRoom() {
  // Create this player
  players[playerID] = {
    x: Math.random() * 450,
    y: Math.random() * 350,
    color: getRandomColor(),
    lastUpdate: Date.now(),
  };

  // Listen for all players' updates
  room
    .get("players")
    .map()
    .on((data, id) => {
      if (!data) return delete players[id]; // removed player
      if (
        !players[id] ||
        !players[id].lastUpdate ||
        data.lastUpdate > players[id].lastUpdate
      ) {
        players[id] = data; // sync update if newer
      }
    });

  // Periodically push local player state
  setInterval(() => {
    const now = Date.now();
    room
      .get("players")
      .get(playerID)
      .put({ ...players[playerID], lastUpdate: now });
  }, 50);

  requestAnimationFrame(gameLoop);
}

// --- GAME LOOP ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    const p = players[id];
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 30, 30);
  }

  requestAnimationFrame(gameLoop);
}

// --- PLAYER CONTROLS ---
document.addEventListener("keydown", (e) => {
  const speed = 5;
  if (!players[playerID]) return;
  if (e.key === "ArrowUp") players[playerID].y -= speed;
  if (e.key === "ArrowDown") players[playerID].y += speed;
  if (e.key === "ArrowLeft") players[playerID].x -= speed;
  if (e.key === "ArrowRight") players[playerID].x += speed;

  // Clamp positions
  players[playerID].x = Math.max(
    0,
    Math.min(canvas.width - 30, players[playerID].x),
  );
  players[playerID].y = Math.max(
    0,
    Math.min(canvas.height - 30, players[playerID].y),
  );
});

// --- RANDOM COLOR ---
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
}
