const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).slice(2);

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // HOST
    if (data.type === "host") {
      rooms[data.roomId] = {
        password: data.password,
        clients: [ws],
        board: [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ],

        moveHistory: [],
        currentTurn: ws.id,
        winner: null,
        players: {
          [ws.id]: { role: "host", symbol: null },
        },
        scores: {},
        winningLine: null,
      };

      ws.roomId = data.roomId;

      ws.send(JSON.stringify({ type: "hosted", id: ws.id }));

      broadcastRoom(rooms[data.roomId]);
      return;
    }

    // JOIN
    if (data.type === "join") {
      const room = rooms[data.roomId];

      if (!room) {
        ws.send(JSON.stringify({ type: "error", msg: "Room not found" }));
        return;
      }

      if (room.password !== data.password) {
        ws.send(JSON.stringify({ type: "error", msg: "Wrong password" }));
        return;
      }

      room.clients.push(ws);
      ws.roomId = data.roomId;

      const hostId = Object.keys(room.players)[0];
      const guestId = ws.id;

      const random = Math.random() < 0.5;
      room.scores[hostId] = 0;
      room.scores[guestId] = 0;
      if (random) {
        room.players[hostId].symbol = "X";
        room.players[guestId] = { role: "guest", symbol: "O" };
        room.currentTurn = hostId;
      } else {
        room.players[hostId].symbol = "O";
        room.players[guestId] = { role: "guest", symbol: "X" };
        room.currentTurn = guestId;
      }

      ws.send(JSON.stringify({ type: "joined", id: ws.id }));

      broadcastRoom(room);
      return;
    }

    // MOVE
    if (data.type === "move") {
      const room = rooms[ws.roomId];
      if (!room || room.winner) return;

      const { row, col } = data;
      const playerId = ws.id;

      if (room.currentTurn !== playerId) return;
      if (room.board[row][col] !== null) return;

      room.board[row][col] = playerId;
      room.moveHistory.push({ playerId, row, col });

      const ids = Object.keys(room.players);
      room.currentTurn = ids.find((id) => id !== playerId);

      const winningLine = checkWin(room.board, playerId);

      if (winningLine) {
        room.winner = playerId;
        room.winningLine = winningLine;
        room.scores[playerId]++;

        // auto reset after 2 seconds
        setTimeout(() => {
          room.board = [
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ];
          room.moveHistory = [];
          room.winner = null;
          room.winningLine = null;

          // X always starts next round
          const ids = Object.keys(room.players);
          const xPlayer = ids.find((id) => room.players[id].symbol === "X");
          room.currentTurn = xPlayer;

          broadcastRoom(room);
        }, 2000);
      }

      if (!room.winner && isBoardFull(room.board)) {
        undoOldestMove(room);
      }

      broadcastRoom(room);
      return;
    }
  });

  ws.on("close", () => {
    const room = rooms[ws.roomId];
    if (!room) return;
    delete room.players[ws.id];
    room.clients = room.clients.filter((c) => c !== ws);
    if (room.clients.length === 0) delete rooms[ws.roomId];
  });
});

function isBoardFull(board) {
  return board.flat().every((cell) => cell !== null);
}

function checkWin(board, playerId) {
  const lines = [
    // rows
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    // cols
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    // diagonals
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  ];

  for (let line of lines) {
    if (line.every(([r, c]) => board[r][c] === playerId)) {
      return line; // return winning cells
    }
  }

  return null;
}

function undoOldestMove(room) {
  if (room.moveHistory.length === 0) return;

  const oldest = room.moveHistory.shift();

  room.board[oldest.row][oldest.col] = "UNDO";
  broadcastRoom(room);

  setTimeout(() => {
    room.board[oldest.row][oldest.col] = null;
    broadcastRoom(room);
  }, 500);
}

function broadcastRoom(room) {
  room.clients.forEach((c) => {
    c.send(
      JSON.stringify({
        type: "gameState",
        board: room.board,
        currentTurn: room.currentTurn,
        winner: room.winner,
        players: room.players,
        winningLine: room.winningLine,
        scores: room.scores,
      }),
    );
  });
}

server.listen(8080, () => {
  console.log("Server running on port 8080");
});
