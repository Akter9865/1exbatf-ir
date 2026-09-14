import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// Helper to synthesize a pleasant WhatsApp-like incoming message chime
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1000, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Ignore audio permission restrictions before user interaction
  }
}

export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [incomingAlert, setIncomingAlert] = useState(null);

  useEffect(() => {
    const socketBase = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
    let s = null;

    try {
      s = io(socketBase, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000
      });

      setSocket(s);

      if (isAuthenticated) {
        s.emit('join_admin_room');
      }

      s.on('new_message', (data) => {
        // If message is from visitor, play chime and trigger alert
        if (data.message && data.message.sender_type === 'visitor') {
          playNotificationChime();
          setIncomingAlert({
            title: 'New Customer Message',
            message: data.message.text || 'Sent an attachment',
            conversationId: data.conversationId,
            timestamp: new Date()
          });
        }
      });

      s.on('connect_error', () => {
        // Quiet socket connection error on serverless environments
      });
    } catch (e) {
      console.warn('Socket provider initialization error:', e);
    }

    return () => {
      if (s) s.disconnect();
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, incomingAlert, clearAlert: () => setIncomingAlert(null), playNotificationChime }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
