let ioInstance = null;

export function initSocketService(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // console.log(`🔌 Client connected: ${socket.id}`);

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conv_${conversationId}`);
        // console.log(`Socket ${socket.id} joined conv_${conversationId}`);
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conv_${conversationId}`);
      }
    });

    // Admin dashboard room
    socket.on('join_admin_room', () => {
      socket.join('admin_dashboard');
      // console.log(`Admin socket ${socket.id} joined admin_dashboard`);
    });

    // Typing indicators
    socket.on('typing_start', ({ conversationId, senderName, senderType }) => {
      socket.to(`conv_${conversationId}`).emit('typing_start', { conversationId, senderName, senderType });
      if (senderType === 'visitor') {
        io.to('admin_dashboard').emit('typing_start', { conversationId, senderName, senderType });
      }
    });

    socket.on('typing_stop', ({ conversationId, senderType }) => {
      socket.to(`conv_${conversationId}`).emit('typing_stop', { conversationId, senderType });
      if (senderType === 'visitor') {
        io.to('admin_dashboard').emit('typing_stop', { conversationId, senderType });
      }
    });

    // Mark messages as read in real-time
    socket.on('mark_read', ({ conversationId, readBy }) => {
      socket.to(`conv_${conversationId}`).emit('messages_marked_read', { conversationId, readBy });
      if (readBy === 'visitor') {
        io.to('admin_dashboard').emit('messages_marked_read', { conversationId, readBy });
      }
    });

    socket.on('disconnect', () => {
      // console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function emitNewMessage(conversationId, message, conversationData) {
  if (!ioInstance) return;

  // Broadcast to specific conversation room (both visitor and viewing agent)
  ioInstance.to(`conv_${conversationId}`).emit('new_message', {
    conversationId,
    message
  });

  // Broadcast to all admins to update inbox list, unread badges, notifications
  ioInstance.to('admin_dashboard').emit('conversation_updated', {
    conversationId,
    lastMessage: message,
    conversation: conversationData
  });
}

export function emitConversationStatusChanged(conversationId, status) {
  if (!ioInstance) return;
  ioInstance.to(`conv_${conversationId}`).emit('status_changed', { conversationId, status });
  ioInstance.to('admin_dashboard').emit('status_changed', { conversationId, status });
}

export function emitContactUpdated(contactId, updatedData) {
  if (!ioInstance) return;
  ioInstance.to('admin_dashboard').emit('contact_updated', { contactId, ...updatedData });
}
