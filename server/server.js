import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocketService } from './services/socketService.js';

dotenv.config();

const server = http.createServer(app);

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

initSocketService(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CRM Live Chat Server running on http://127.0.0.1:${PORT}`);
  console.log(`📡 WebSocket server ready for real-time events`);
});
