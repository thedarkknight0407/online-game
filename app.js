const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const roomDisplay = document.getElementById("roomIDDisplay");
const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const joinRoomInput = document.getElementById("joinRoomID");
const passwordInput = document.getElementById("roomPassword");

let peer = null;
let conn = null; // Connection to host (for clients)
let connections = {}; // DataConnections (for host)
let isHost = false;
let roomID = null;
let password = null;
const playerID = Math.random().toString(36).substr(2, 5);

const players = {}; // { playerID: {x,y,color} }

// --- UTILS ---
function generateRoomID(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < length; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
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
  if (!players[playerID]) return;
  const speed = 5;
  if (e.key === "ArrowUp") players[playerID].y -= speed;
  if (e.key === "ArrowDown") players[playerID].y += speed;
  if (e.key === "ArrowLeft") players[playerID].x -= speed;
  if (e.key === "ArrowRight") players[playerID].x += speed;
  players[playerID].x = Math.max(
    0,
    Math.min(canvas.width - 30, players[playerID].x),
  );
  players[playerID].y = Math.max(
    0,
    Math.min(canvas.height - 30, players[playerID].y),
  );

  if (isHost) {
    // Broadcast host player positions to all clients
    for (let cID in connections) {
      connections[cID].send(players);
    }
  } else if (conn) {
    // Send client position to host
    conn.send({
      playerID,
      x: players[playerID].x,
      y: players[playerID].y,
      color: players[playerID].color,
    });
  }
});

// --- CREATE ROOM ---
createRoomBtn.addEventListener("click", () => {
  password = passwordInput.value.trim();
  if (!password) return alert("Enter a password");

  isHost = true;
  roomID = generateRoomID();
  roomDisplay.textContent = roomID;

  peer = new Peer(roomID, { host: "0.peerjs.com", port: 443, secure: true });
  players[playerID] = {
    x: Math.random() * 450,
    y: Math.random() * 350,
    color: getRandomColor(),
  };

  peer.on("open", (id) => {
    console.log("Host ready. Room ID:", id);
  });

  // When a client connects
  peer.on("connection", (c) => {
    // Store connection
    connections[c.peer] = c;

    c.on("data", (data) => {
      // Validate password
      if (data.type === "join") {
        if (data.password !== password) {
          c.send({ type: "error", msg: "Incorrect password" });
          c.close();
          return;
        }
        // Add new player to game
        players[data.playerID] = {
          x: Math.random() * 450,
          y: Math.random() * 350,
          color: getRandomColor(),
        };
        // Send initial game state
        c.send(players);
      } else {
        // Update client player positions
        if (players[data.playerID]) {
          players[data.playerID] = data;
          // Broadcast updated positions to all other clients
          for (let cid in connections) {
            if (cid !== c.peer) connections[cid].send(players);
          }
        }
      }
    });

    c.on("close", () => {
      // Remove disconnected player
      for (let pid in players) {
        if (pid === c.peer) delete players[pid];
      }
      delete connections[c.peer];
    });
  });

  requestAnimationFrame(gameLoop);
});

// --- JOIN ROOM ---
joinRoomBtn.addEventListener("click", () => {
  roomID = joinRoomInput.value.trim().toUpperCase();
  password = passwordInput.value.trim();
  if (!roomID || !password) return alert("Enter Room ID and password");

  peer = new Peer(); // Let PeerJS generate an ID

  conn = peer.connect(roomID);

  players[playerID] = {
    x: Math.random() * 450,
    y: Math.random() * 350,
    color: getRandomColor(),
  };

  conn.on("open", () => {
    // Send join request with password
    conn.send({ type: "join", playerID, password });
  });

  conn.on("data", (data) => {
    if (data.type === "error") return alert(data.msg);
    // Update all players state
    for (let id in data) {
      players[id] = data[id];
    }
  });

  peer.on("connection", (c) => {
    // Optionally handle P2P connections from host
    c.on("data", (data) => {
      for (let id in data) players[id] = data[id];
    });
  });

  requestAnimationFrame(gameLoop);
});
