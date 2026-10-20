const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable cross-origin resource sharing safely
app.use(cors({ origin: '*' }));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, // Closes dead connections quickly
  pingInterval: 25000
});

// High-performance server memory cache for canvas tracking
let boardState = new Map();

// Base health check endpoint for Render monitoring
app.get('/', (req, res) => {
  res.status(200).json({ status: "online", activeObjects: boardState.size });
});

io.on('connection', (socket) => {
  console.log(`[Connected] User Session ID: ${socket.id}`);

  // 1. CATCH-UP LOGIC: Instantly feed current state to users who join late
  try {
    const currentShapes = Array.from(boardState.values());
    socket.emit('initial-board-state', currentShapes);
  } catch (error) {
    console.error(`[Error] Failed sending initial state to ${socket.id}:`, error.message);
  }

  // 2. DRAW & EDIT SYNC: Save elements to cache memory and broadcast instantly
  socket.on('draw-shape', (data) => {
    try {
      if (data && data.object && data.object.id) {
        boardState.set(data.object.id, data.object);
        socket.broadcast.emit('remote-draw-shape', data);
      }
    } catch (error) {
      console.error('[Error] Syncing draw-shape action failed:', error.message);
    }
  });

  // 3. DELETE SYNC: Instantly scrub elements from memory and tell other screens
  socket.on('delete-shape', (data) => {
    try {
      if (data && data.id) {
        boardState.delete(data.id);
        socket.broadcast.emit('remote-delete-shape', data);
      }
    } catch (error) {
      console.error('[Error] Syncing delete-shape action failed:', error.message);
    }
  });

  // 4. CONNECTION CLEANUP
  socket.on('disconnect', (reason) => {
    console.log(`[Disconnected] User Session ID: ${socket.id} (Reason: ${reason})`);
  });
});

// Dynamic port assignment optimized for free cloud containers
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Antgravity Server running flawlessly on port ${PORT}`);
});
