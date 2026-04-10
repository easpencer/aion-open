#!/usr/bin/env node
/**
 * Aion Bridge Server — REST API + Developer Console
 *
 * Wraps the phone's WebSocket bridge in standard HTTP endpoints so any tool
 * can query health data: curl, Postman, your own apps, or the web console.
 *
 * Usage:
 *   BRIDGE_URL=wss://192.168.1.42:8420 PAIRING_CODE=123456 npm start
 *
 * Then:
 *   curl http://localhost:3000/api/Observation?category=vital-signs
 *   curl http://localhost:3000/api/Condition
 *   curl http://localhost:3000/api/Observation/obs-123
 *   curl -X POST http://localhost:3000/api/analyze -d '{"question":"BP trend?"}'
 *   open http://localhost:3000   # Developer console
 */

import express from 'express';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ---- Bridge Connection State ----

let bridgeUrl = process.env.BRIDGE_URL || '';
let pairingCode = process.env.PAIRING_CODE || '';
let ws = null;
let authenticated = false;
let pending = new Map();
let counter = 0;
let connectError = null;

function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN && authenticated;
}

function bridgeSend(msg) {
  return new Promise((resolve, reject) => {
    if (!isConnected()) {
      reject(new Error('Not connected to bridge. POST /api/connect first or set BRIDGE_URL + PAIRING_CODE env vars.'));
      return;
    }
    const id = `rest-${++counter}`;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Bridge request timed out (30s)'));
    }, 30000);
    pending.set(id, { resolve: (m) => { clearTimeout(timeout); resolve(m); }, reject: (e) => { clearTimeout(timeout); reject(e); } });
    ws.send(JSON.stringify({ ...msg, id }));
  });
}

function connectToBridge(url, code) {
  return new Promise((resolve, reject) => {
    // Validate URL scheme
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      reject(new Error('Invalid URL scheme. Use ws:// or wss://'));
      return;
    }
    if (ws) { try { ws.close(); } catch {} }
    authenticated = false;
    connectError = null;
    bridgeUrl = url;
    pairingCode = code;

    const timeout = setTimeout(() => reject(new Error('Connection timed out (10s)')), 10000);

    try {
      ws = new WebSocket(url, { rejectUnauthorized: false });
    } catch (e) {
      clearTimeout(timeout);
      connectError = e.message;
      reject(e);
      return;
    }

    ws.on('open', () => {
      const authId = `auth-${++counter}`;
      pending.set(authId, {
        resolve: (msg) => {
          clearTimeout(timeout);
          if (msg.payload?.authenticated) {
            authenticated = true;
            connectError = null;
            console.log(`[aion] Connected to ${url}`);
            resolve({ connected: true, deidentify: msg.payload.deidentify });
          } else {
            connectError = 'Authentication failed — wrong pairing code';
            reject(new Error(connectError));
          }
        },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      ws.send(JSON.stringify({ type: 'auth', id: authId, payload: { pairingCode: code } }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch {}
    });

    ws.on('error', (e) => {
      connectError = e.message;
      if (!authenticated) { clearTimeout(timeout); reject(e); }
    });

    ws.on('close', () => {
      authenticated = false;
      for (const [, { reject }] of pending) reject(new Error('Connection closed'));
      pending.clear();
    });
  });
}

// ---- REST API Routes ----

// Status
app.get('/api/status', (req, res) => {
  res.json({
    connected: isConnected(),
    bridgeUrl: bridgeUrl || null,
    error: connectError,
  });
});

// Connect (from web console or curl)
app.post('/api/connect', async (req, res) => {
  const { url, code } = req.body;
  if (!url || !code) return res.status(400).json({ error: 'url and code are required' });
  try {
    const result = await connectToBridge(url, code);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Disconnect
app.post('/api/disconnect', (req, res) => {
  if (ws) { try { ws.close(); } catch {} }
  ws = null;
  authenticated = false;
  res.json({ disconnected: true });
});

// Query resources: GET /api/:resourceType
app.get('/api/:resourceType', async (req, res) => {
  try {
    const msg = await bridgeSend({
      type: 'query',
      payload: {
        resourceType: req.params.resourceType,
        category: req.query.category || undefined,
        coding: req.query.coding || undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined,
        sortOrder: req.query.sort || undefined,
        dateRange: req.query.start || req.query.end ? {
          start: req.query.start || undefined,
          end: req.query.end || undefined,
        } : undefined,
      },
    });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Get single resource: GET /api/:resourceType/:id
app.get('/api/:resourceType/:id', async (req, res) => {
  try {
    const msg = await bridgeSend({
      type: 'get',
      payload: { resourceType: req.params.resourceType, id: req.params.id },
    });
    if (msg.type === 'error') {
      const status = msg.payload?.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json(msg.payload);
    }
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Analyze: POST /api/analyze
app.post('/api/analyze', async (req, res) => {
  try {
    const msg = await bridgeSend({
      type: 'analyze',
      payload: { question: req.body.question, provider: req.body.provider, model: req.body.model },
    });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Export: GET /api/_export?resourceType=Observation&format=bundle
app.get('/api/_export', async (req, res) => {
  try {
    const msg = await bridgeSend({
      type: 'export',
      payload: { resourceType: req.query.resourceType || undefined, format: req.query.format || 'bundle' },
    });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Metadata: GET /api/_metadata
app.get('/api/_metadata', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'metadata' });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Audit: GET /api/_audit
app.get('/api/_audit', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'audit', payload: { limit: req.query.limit ? parseInt(req.query.limit) : 50 } });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- Start ----

app.listen(PORT, async () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║          Aion Bridge — Developer Console         ║
  ╠══════════════════════════════════════════════════╣
  ║                                                  ║
  ║  Console:  http://localhost:${String(PORT).padEnd(24)}║
  ║  REST API: http://localhost:${String(PORT).padEnd(8)}/api/{type}     ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);

  // Auto-connect if env vars provided
  if (bridgeUrl && pairingCode) {
    try {
      await connectToBridge(bridgeUrl, pairingCode);
      console.log(`  Connected to bridge: ${bridgeUrl}\n`);
    } catch (e) {
      console.log(`  Failed to connect: ${e.message}`);
      console.log(`  Start the bridge on your phone, then POST /api/connect\n`);
    }
  } else {
    console.log('  No BRIDGE_URL set. Open the console to connect, or:');
    console.log('  BRIDGE_URL=wss://phone-ip:8420 PAIRING_CODE=123456 npm start\n');
  }
});
