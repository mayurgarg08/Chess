# Real-Time Multiplayer Chess

A two-player online chess game that runs in the browser. The server uses **Node.js, Express and Socket.IO**, and every move is validated server-side with **chess.js**. The first two people to connect play as White and Black. Anyone who joins after them watches as a spectator.

## Features

- **Real-time play:** moves are broadcast to every connected client over WebSockets
- **Server-side validation:** the server rejects illegal moves and moves made out of turn
- **Automatic roles:** first connection plays White, second plays Black, everyone else spectates
- **Drag-and-drop board** with Unicode pieces. You can only drag your own pieces, and only on your turn.
- **Countdown** before the game starts, once both players have joined
- **Chess clocks** for each player, with a win on time when a clock runs out
- **Move history** in SAN notation and a **captured pieces** tray
- **Game-over detection:** checkmate, stalemate, threefold repetition, insufficient material
- **Reset game** button, plus handling for when a player disconnects
- Styled with Tailwind CSS (CDN)

## Tech stack

Node.js · Express · Socket.IO · chess.js · EJS · Tailwind CSS · Vanilla JavaScript

## How it works

```
Browser (chessgame.js)  ──"move"──▶  Server (app.js)
                                      │ chess.move() validates
                                      ▼
All clients  ◀── boardState (FEN), turn, timerUpdate,
                 moveHistory, capturedPieces, gameOver
```

The server keeps a single `Chess` instance as the source of truth. Clients only render the FEN they receive.

## Project structure

```
app.js                 Express + Socket.IO server and game logic
views/index.ejs        game page (board, clocks, history, captured pieces)
public/js/chessgame.js client-side rendering, drag & drop, socket events
```

## Getting started

### Prerequisites
- Node.js 18+

```bash
git clone https://github.com/mayurgarg08/Chess.git
cd Chess
npm install
npm start          # runs app.js with nodemon on http://localhost:3000
```

Open http://localhost:3000 in **two browser windows** (or on two devices on the same network) to play. A third window joins as a spectator.

Set `PORT` in your environment to use a different port.

## Author

**Mayur Garg** · [GitHub](https://github.com/mayurgarg08) · [LinkedIn](https://www.linkedin.com/in/mayur-garg-428a291b4/)
