/**
 * WebSocket Collaboration Server
 *
 * Real-time collaboration server for code editor synchronization
 * Handles code edits, cursor positions, and participant management
 */

import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';

interface Client {
  ws: WebSocket;
  user_id: string;
  user_name: string;
  session_id: string;
  color: string;
}

interface CodeSession {
  code: string;
  language: string;
  clients: Map<string, Client>;
}

const sessions: Map<string, CodeSession> = new Map();

const server = createServer();
const wss = new WebSocketServer({ server });

// Generate random color for cursor
function generateColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.pathname.split('/').pop() || '';

  let client: Client | null = null;

  console.log(`New connection to session: ${sessionId}`);

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'sync_request':
          handleSyncRequest(ws, sessionId, message);
          break;

        case 'code_edit':
          handleCodeEdit(sessionId, message);
          break;

        case 'cursor_move':
          handleCursorMove(sessionId, message);
          break;

        case 'language_change':
          handleLanguageChange(sessionId, message);
          break;

        case 'code_execute':
          handleCodeExecute(sessionId, message);
          break;

        case 'participant_join':
          client = handleParticipantJoin(ws, sessionId, message);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    if (client) {
      handleParticipantLeave(sessionId, client);
    }
    console.log(`Client disconnected from session: ${sessionId}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

/**
 * Handle sync request - send current session state
 */
function handleSyncRequest(ws: WebSocket, sessionId: string, message: any): void {
  let session = sessions.get(sessionId);

  if (!session) {
    // Create new session
    session = {
      code: '',
      language: 'javascript',
      clients: new Map(),
    };
    sessions.set(sessionId, session);
  }

  const cursors = Array.from(session.clients.values()).map((client) => ({
    user_id: client.user_id,
    user_name: client.user_name,
    color: client.color,
    position: { line: 1, column: 1 },
  }));

  ws.send(
    JSON.stringify({
      type: 'sync_response',
      payload: {
        code: session.code,
        language: session.language,
        cursors,
      },
      sender_id: 'server',
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Handle participant join
 */
function handleParticipantJoin(ws: WebSocket, sessionId: string, message: any): Client {
  const session = sessions.get(sessionId);
  if (!session) return null!;

  const client: Client = {
    ws,
    user_id: message.sender_id,
    user_name: message.payload?.user_name || 'Anonymous',
    session_id: sessionId,
    color: generateColor(),
  };

  session.clients.set(message.sender_id, client);

  // Broadcast to other clients
  broadcast(sessionId, message.sender_id, {
    type: 'participant_join',
    payload: {
      user_id: client.user_id,
      user_name: client.user_name,
      color: client.color,
    },
    sender_id: 'server',
    timestamp: new Date().toISOString(),
  });

  return client;
}

/**
 * Handle participant leave
 */
function handleParticipantLeave(sessionId: string, client: Client): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.clients.delete(client.user_id);

  // Broadcast to remaining clients
  broadcast(sessionId, client.user_id, {
    type: 'participant_leave',
    payload: {
      user_id: client.user_id,
    },
    sender_id: 'server',
    timestamp: new Date().toISOString(),
  });

  // Clean up empty sessions
  if (session.clients.size === 0) {
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up`);
  }
}

/**
 * Handle code edit
 */
function handleCodeEdit(sessionId: string, message: any): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Apply edit to session code
  const edit = message.payload;

  // Simple implementation - in production, use operational transformation
  if (edit.type === 'insert' || edit.type === 'replace') {
    // For simplicity, we're not implementing full OT here
    // In production, use libraries like ShareDB or Yjs
  }

  // Broadcast to all clients except sender
  broadcast(sessionId, message.sender_id, message);
}

/**
 * Handle cursor move
 */
function handleCursorMove(sessionId: string, message: any): void {
  // Broadcast cursor position to all clients except sender
  broadcast(sessionId, message.sender_id, message);
}

/**
 * Handle language change
 */
function handleLanguageChange(sessionId: string, message: any): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.language = message.payload.language;

  // Broadcast to all clients
  broadcast(sessionId, message.sender_id, message);
}

/**
 * Handle code execution request
 */
function handleCodeExecute(sessionId: string, message: any): void {
  // In production, this would call a secure sandbox API
  // For now, we'll just broadcast the execution request

  // Simulate execution result
  setTimeout(() => {
    const result = {
      type: 'execution_result',
      payload: {
        timestamp: new Date().toISOString(),
        output: 'Code execution would be handled by a secure backend sandbox.',
        runtime_ms: 150,
        exit_code: 0,
      },
      sender_id: 'server',
      timestamp: new Date().toISOString(),
    };

    broadcast(sessionId, '', result);
  }, 1500);
}

/**
 * Broadcast message to all clients in session except sender
 */
function broadcast(sessionId: string, excludeUserId: string, message: any): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const messageStr = JSON.stringify(message);

  session.clients.forEach((client) => {
    if (client.user_id !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket collaboration server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

export { wss, sessions };
