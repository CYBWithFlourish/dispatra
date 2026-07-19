const WebSocket = require('ws');
const { getSubscriber } = require('./redis');

let wss;
const clients = new Map();

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const id = Math.random().toString(36).slice(2);
    clients.set(id, { ws, role: null, location: null });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribe') {
          clients.set(id, {
            ...clients.get(id),
            role: msg.role || 'rider',
            location: msg.location || null,
          });
        }
      } catch { }
    });

    ws.on('close', () => clients.delete(id));
    ws.on('error', () => clients.delete(id));

    ws.send(JSON.stringify({ type: 'connected', id }));
  });

  const subscriber = getSubscriber();
  subscriber.subscribe('job:created', 'job:accepted', 'job:completed', 'job:cancelled');
  subscriber.on('message', (channel, data) => {
    broadcast(channel, JSON.parse(data));
  });

  return wss;
}

function broadcast(channel, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type: channel, data });
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

function getClientCount() { return clients.size; }

module.exports = { setupWebSocket, broadcast, getClientCount };
