// public/js/chessgame.js
const socket = io();
const chess = new Chess();

const boardElement = document.getElementById("chessboard");
const moveListElement = document.getElementById("moveHistory");
const statusText = document.getElementById("statusText");
const roleText = document.getElementById("roleText");
const resetBtn = document.getElementById("resetBtn");
const moveCount = document.getElementById("moveCount");
const notification = document.getElementById("notification");

const leftCard = document.getElementById("leftCard");
const rightCard = document.getElementById("rightCard");
const leftTimer = document.getElementById("leftTimer");
const rightTimer = document.getElementById("rightTimer");
const leftCaptured = document.getElementById("leftCaptured");
const rightCaptured = document.getElementById("rightCaptured");
const leftPlayerName = document.getElementById("leftPlayerName");
const rightPlayerName = document.getElementById("rightPlayerName");

const countdownDisplay = document.getElementById("countdownDisplay");
const statusDisplay = document.getElementById("statusDisplay");
const countdownNumber = document.getElementById("countdownNumber");

let draggedElement = null;
let sourceSquare = null;
let playerRole = null;
let gameOver = false;
let gameStarted = false;
let currentTurn = "w";

const unicode = {
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
};

resetBtn.addEventListener("click", () => {
  socket.emit("resetGame");
  resetBtn.disabled = true;
  showNotification("Starting new game...", "success");
});

function showNotification(message, type = "error") {
  notification.textContent = message;
  notification.className = "notification show " + (type === "success" ? "success" : "");
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

function algebraicFromCoords(row, col) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function renderBoard() {
  const board = chess.board();
  boardElement.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const squareDiv = document.createElement("div");
      const isLight = (r + c) % 2 === 0;
      squareDiv.className = "square " + (isLight ? "light" : "dark");
      squareDiv.dataset.row = r;
      squareDiv.dataset.col = c;
      squareDiv.dataset.square = algebraicFromCoords(r, c);

      const piece = board[r][c];
      if (piece) {
        const pieceEl = document.createElement("div");
        pieceEl.className = "piece";
        pieceEl.innerText = unicode[piece.color][piece.type] || "";
        pieceEl.draggable = playerRole === piece.color && !gameOver && gameStarted;
        pieceEl.dataset.square = algebraicFromCoords(r, c);
        pieceEl.dataset.color = piece.color;

        // Drag events
        pieceEl.addEventListener("dragstart", handleDragStart);
        pieceEl.addEventListener("dragend", handleDragEnd);

        squareDiv.appendChild(pieceEl);
      }

      // Drop events
      squareDiv.addEventListener("dragover", handleDragOver);
      squareDiv.addEventListener("dragleave", handleDragLeave);
      squareDiv.addEventListener("drop", handleDrop);

      boardElement.appendChild(squareDiv);
    }
  }

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }

  updateActivePlayerUI();
}

function handleDragStart(e) {
  if (!gameStarted || gameOver) {
    e.preventDefault();
    return;
  }

  draggedElement = e.target;
  sourceSquare = e.target.dataset.square;
  e.target.classList.add("dragging");
  
  // Set drag data
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", sourceSquare);
  
  // Add selection to source square
  e.target.parentElement.classList.add("selected");
}

function handleDragEnd(e) {
  if (draggedElement) {
    draggedElement.classList.remove("dragging");
    draggedElement.parentElement.classList.remove("selected");
  }
  draggedElement = null;
  sourceSquare = null;
  
  // Remove all drag-over effects
  document.querySelectorAll(".square").forEach(sq => {
    sq.classList.remove("drag-over");
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  
  if (!sourceSquare || !gameStarted || gameOver) return;
  
  const targetSquare = e.currentTarget.dataset.square;
  
  if (sourceSquare === targetSquare) return;
  
  const move = {
    from: sourceSquare,
    to: targetSquare,
    promotion: "q"
  };
  
  socket.emit("move", move);
}

function renderMoveList(history) {
  moveListElement.innerHTML = "";
  
  if (history.length === 0) {
    moveListElement.innerHTML = '<div style="color: rgba(255,255,255,0.4); text-align: center; padding: 1rem;">No moves yet</div>';
    moveCount.textContent = "0 moves";
    return;
  }

  for (let i = 0; i < history.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = history[i] || "";
    const blackMove = history[i + 1] || "";
    
    const row = document.createElement("div");
    row.className = "move-row";
    row.innerHTML = `
      <span style="color:#94a3b8; font-weight: 600; margin-right: 0.5rem;">${moveNumber}.</span>
      <span style="color:#f1f5f9; margin-right: 1rem;">${whiteMove}</span>
      <span style="color:#cbd5e1;">${blackMove}</span>
    `;
    moveListElement.appendChild(row);
  }
  
  moveCount.textContent = `${history.length} move${history.length !== 1 ? 's' : ''}`;
  moveListElement.scrollTop = moveListElement.scrollHeight;
}

function getPieceGlyph(pieceChar) {
  const map = { 
    p: "♟", 
    r: "♜", 
    n: "♞", 
    b: "♝", 
    q: "♛", 
    k: "♚" 
  };
  return map[pieceChar] || "";
}

function updateCapturedUI(capturedPieces) {
  const whiteCaptured = (capturedPieces.w || []).map(p => 
    `<span class="captured-piece">${getPieceGlyph(p)}</span>`
  ).join("");
  
  const blackCaptured = (capturedPieces.b || []).map(p => 
    `<span class="captured-piece">${getPieceGlyph(p)}</span>`
  ).join("");

  if (playerRole === "b") {
    leftCaptured.innerHTML = blackCaptured;
    rightCaptured.innerHTML = whiteCaptured;
  } else {
    leftCaptured.innerHTML = blackCaptured;
    rightCaptured.innerHTML = whiteCaptured;
  }
}

function updateTimersUI(timers) {
  const w = timers.w || 0;
  const b = timers.b || 0;
  
  const wMins = Math.floor(w / 60);
  const wSecs = w % 60;
  const bMins = Math.floor(b / 60);
  const bSecs = b % 60;
  
  const whiteTime = `${wMins}:${String(wSecs).padStart(2, "0")}`;
  const blackTime = `${bMins}:${String(bSecs).padStart(2, "0")}`;

  if (playerRole === "b") {
    leftTimer.textContent = blackTime;
    rightTimer.textContent = whiteTime;
    
    if (b < 30 && currentTurn === "b" && !gameOver) {
      leftTimer.classList.add("warning");
    } else {
      leftTimer.classList.remove("warning");
    }
    
    if (w < 30 && currentTurn === "w" && !gameOver) {
      rightTimer.classList.add("warning");
    } else {
      rightTimer.classList.remove("warning");
    }
  } else {
    leftTimer.textContent = blackTime;
    rightTimer.textContent = whiteTime;
    
    if (b < 30 && currentTurn === "b" && !gameOver) {
      leftTimer.classList.add("warning");
    } else {
      leftTimer.classList.remove("warning");
    }
    
    if (w < 30 && currentTurn === "w" && !gameOver) {
      rightTimer.classList.add("warning");
    } else {
      rightTimer.classList.remove("warning");
    }
  }
}

function updateActivePlayerUI() {
  leftCard.classList.remove("active");
  rightCard.classList.remove("active");
  
  if (playerRole === "b") {
    if (currentTurn === "b") {
      leftCard.classList.add("active");
    } else {
      rightCard.classList.add("active");
    }
  } else {
    if (currentTurn === "b") {
      leftCard.classList.add("active");
    } else {
      rightCard.classList.add("active");
    }
  }
}

function updatePlayerNames() {
  if (playerRole === "b") {
    leftPlayerName.textContent = "⚫ You (Black)";
    rightPlayerName.textContent = "⚪ Opponent (White)";
  } else if (playerRole === "w") {
    leftPlayerName.textContent = "⚫ Opponent (Black)";
    rightPlayerName.textContent = "⚪ You (White)";
  } else {
    leftPlayerName.textContent = "⚫ Black Player";
    rightPlayerName.textContent = "⚪ White Player";
  }
}

// Socket events
socket.on("playerRole", (role) => {
  playerRole = role;
  roleText.textContent = `Role: ${role === "w" ? "White Player" : "Black Player"}`;
  updatePlayerNames();
  renderBoard();
});

socket.on("spectatorRole", () => {
  playerRole = null;
  roleText.textContent = "Role: Spectator";
  updatePlayerNames();
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("turn", (turn) => {
  currentTurn = turn;
  if (!gameOver && gameStarted) {
    statusText.textContent = `${turn === "w" ? "White" : "Black"}'s turn`;
  }
  updateActivePlayerUI();
});

socket.on("invalidMove", (data) => {
  const reason = data?.reason || "Invalid move";
  showNotification(`❌ ${reason}`, "error");
  renderBoard(); // Re-render to reset piece positions
});

socket.on("moveSuccess", () => {
  // Move was successful, board will be updated via boardState event
});

socket.on("timerUpdate", (timers) => {
  updateTimersUI(timers);
});

socket.on("moveHistory", (history) => {
  renderMoveList(history);
});

socket.on("capturedPieces", (captured) => {
  updateCapturedUI(captured);
});

socket.on("gameCountdown", ({ seconds }) => {
  if (seconds > 0) {
    countdownDisplay.style.display = "block";
    statusDisplay.style.display = "none";
    countdownNumber.textContent = seconds;
  } else {
    countdownDisplay.style.display = "none";
    statusDisplay.style.display = "block";
  }
});

socket.on("gameStatus", ({ gameOver: isOver, gameStarted: isStarted, result }) => {
  gameOver = isOver;
  gameStarted = isStarted;
  
  console.log("Game Status:", { isOver, isStarted, result });
  
  if (isOver && result) {
    statusText.textContent = result;
    statusText.style.color = "#10b981";
    showNotification(result, "success");
    resetBtn.disabled = false;
  } else if (!isStarted) {
    statusText.textContent = "Waiting for opponent...";
    statusText.style.color = "#fbbf24";
  } else if (isStarted && !isOver) {
    statusText.textContent = `${currentTurn === "w" ? "White" : "Black"}'s turn`;
    statusText.style.color = "#fff";
    resetBtn.disabled = true;
  }
  renderBoard();
});

socket.on("playerDisconnected", ({ player }) => {
  gameStarted = false;
  gameOver = false;
  statusText.textContent = `${player === "white" ? "White" : "Black"} player disconnected`;
  statusText.style.color = "#ef4444";
  showNotification(`${player === "white" ? "White" : "Black"} player disconnected`, "error");
});

socket.on("gameOver", ({ result }) => {
  gameOver = true;
  statusText.textContent = result;
  statusText.style.color = "#10b981";
  showNotification(result, "success");
  resetBtn.disabled = false;
  leftCard.classList.remove("active");
  rightCard.classList.remove("active");
  leftTimer.classList.remove("warning");
  rightTimer.classList.remove("warning");
});

// Initial render
renderBoard();
renderMoveList([]);
updateTimersUI({ w: 600, b: 600 });
updatePlayerNames();