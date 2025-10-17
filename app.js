// app.js
const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const chess = new Chess();
let players = {};
let moveHistory = [];
let capturedPieces = { w: [], b: [] };
let timers = { w: 180, b: 180 }; // 10 minutes each
let interval = null;
let gameOver = false;
let gameStarted = false;
let countdownTimer = null;

const startTimer = () => {
  if (interval) clearInterval(interval);
  if (gameOver || !gameStarted) return;

  interval = setInterval(() => {
    const turn = chess.turn();
    if (!turn) return;
    
    timers[turn] = Math.max(0, timers[turn] - 1);
    io.emit("timerUpdate", timers);

    if (timers[turn] <= 0) {
      clearInterval(interval);
      gameOver = true;
      const winner = turn === "w" ? "⚫ Black wins on time! ⏱️" : "⚪ White wins on time! ⏱️";
      io.emit("gameOver", { result: winner });
    }
  }, 1000);
};

const resetAll = () => {
  chess.reset();
  moveHistory = [];
  capturedPieces = { w: [], b: [] };
  timers = { w: 600, b: 600 };
  gameOver = false;
  gameStarted = false;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
};

const broadcastGameState = () => {
  io.emit("boardState", chess.fen());
  io.emit("turn", chess.turn());
  io.emit("timerUpdate", timers);
  io.emit("capturedPieces", capturedPieces);
  io.emit("moveHistory", moveHistory);
  io.emit("gameStatus", { 
    gameOver, 
    gameStarted,
    result: null 
  });
};

app.get("/", (req, res) => {
  res.render("index", { title: "Chess Game" });
});

io.on("connection", (socketClient) => {
  console.log("New connection:", socketClient.id);

  // Assign roles
  if (!players.white) {
    players.white = socketClient.id;
    socketClient.emit("playerRole", "w");
    console.log("Assigned WHITE to", socketClient.id);
  } else if (!players.black) {
    players.black = socketClient.id;
    socketClient.emit("playerRole", "b");
    console.log("Assigned BLACK to", socketClient.id);
    
    // Both players joined - show countdown
    io.emit("gameCountdown", { seconds: 3 });
    
    // Start countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.emit("gameCountdown", { seconds: countdown });
      } else {
        clearInterval(countdownInterval);
        io.emit("gameCountdown", { seconds: 0 });
      }
    }, 1000);
    
    // Start game after 5 seconds
    countdownTimer = setTimeout(() => {
      gameStarted = true;
      console.log("Game starting now!");
      
      io.emit("gameStatus", { 
        gameOver: false, 
        gameStarted: true,
        result: null 
      });
      
      startTimer();
    }, 5000);
    
  } else {
    socketClient.emit("spectatorRole");
    console.log("Assigned SPECTATOR to", socketClient.id);
  }

  // Send initial state
  socketClient.emit("boardState", chess.fen());
  socketClient.emit("turn", chess.turn());
  socketClient.emit("timerUpdate", timers);
  socketClient.emit("capturedPieces", capturedPieces);
  socketClient.emit("moveHistory", moveHistory);
  socketClient.emit("gameStatus", { 
    gameOver, 
    gameStarted,
    result: gameOver ? "Game finished" : null 
  });

  socketClient.on("disconnect", () => {
    console.log("Disconnected:", socketClient.id);
    if (socketClient.id === players.white) {
      delete players.white;
      gameStarted = false;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
      }
      io.emit("playerDisconnected", { player: "white" });
    } else if (socketClient.id === players.black) {
      delete players.black;
      gameStarted = false;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
      }
      io.emit("playerDisconnected", { player: "black" });
    }
  });

  socketClient.on("move", (move) => {
    try {
      if (!gameStarted) {
        socketClient.emit("invalidMove", { reason: "Game hasn't started yet" });
        return;
      }

      if (gameOver) {
        socketClient.emit("invalidMove", { reason: "Game is over" });
        return;
      }

      // Verify it's the correct player's turn
      if (chess.turn() === "w" && socketClient.id !== players.white) {
        socketClient.emit("invalidMove", { reason: "Not your turn" });
        return;
      }
      if (chess.turn() === "b" && socketClient.id !== players.black) {
        socketClient.emit("invalidMove", { reason: "Not your turn" });
        return;
      }

      const result = chess.move(move);
      if (result) {
        // Handle captured pieces
        if (result.captured) {
          capturedPieces[result.color].push(result.captured);
        }

        moveHistory.push(result.san);

        // Broadcast updated state to all clients
        io.emit("boardState", chess.fen());
        io.emit("moveHistory", moveHistory);
        io.emit("capturedPieces", capturedPieces);
        io.emit("turn", chess.turn());
        io.emit("moveSuccess");

        // Restart timer for next player
        if (!gameOver && gameStarted) {
          startTimer();
        }

        // Check game over conditions
        if (chess.isGameOver()) {
          gameOver = true;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          
          let message = "";
          if (chess.isCheckmate()) {
            const winnerIs = result.color === "w" ? "White" : "Black";
            message = `🏆 ${winnerIs} wins by checkmate!`;
          } else if (chess.isDraw()) {
            if (chess.isStalemate()) {
              message = "🤝 Draw by stalemate!";
            } else if (chess.isThreefoldRepetition()) {
              message = "🤝 Draw by repetition!";
            } else if (chess.isInsufficientMaterial()) {
              message = "🤝 Draw by insufficient material!";
            } else {
              message = "🤝 Game drawn!";
            }
          } else {
            message = "Game over!";
          }
          io.emit("gameOver", { result: message });
        }
      } else {
        socketClient.emit("invalidMove", { reason: "Illegal move" });
      }
    } catch (err) {
      console.error("Error handling move:", err);
      socketClient.emit("invalidMove", { reason: "Invalid move" });
    }
  });

  socketClient.on("resetGame", () => {
    console.log("Resetting game...");
    resetAll();
    broadcastGameState();
    
    // If both players are still connected, start countdown again
    if (players.white && players.black) {
      io.emit("gameCountdown", { seconds: 3 });
      
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          io.emit("gameCountdown", { seconds: countdown });
        } else {
          clearInterval(countdownInterval);
          io.emit("gameCountdown", { seconds: 0 });
        }
      }, 1000);
      
      countdownTimer = setTimeout(() => {
        gameStarted = true;
        io.emit("gameStatus", { 
          gameOver: false, 
          gameStarted: true,
          result: null 
        });
        startTimer();
      }, 5000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});