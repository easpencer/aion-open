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
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Vendored, self-contained copy of the shared bridge core (see
// scripts/sync-bridge-core.sh). Explicit dist/index.js path + extension is
// required — a bare directory path won't resolve `main` under ESM.
import { BridgeClient, BRIDGE_CORE_VERSION } from './vendor/aion-health-core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
// Bind to loopback by default — the dev console holds an *authenticated* bridge
// socket, so exposing it on 0.0.0.0 would let any LAN host read health data
// with no pairing code. Override with HOST=0.0.0.0 only behind your own auth.
const HOST = process.env.HOST || '127.0.0.1';

// ---- Bridge Connection State ----

let bridgeUrl = process.env.BRIDGE_URL || '';
let pairingCode = process.env.PAIRING_CODE || '';
let bridge = null;        // shared BridgeClient instance
let connectError = null;

function isConnected() {
  return !!bridge && bridge.isConnected();
}

/** Send a raw protocol message and return the response message. */
function bridgeSend(msg) {
  if (!isConnected()) {
    return Promise.reject(new Error(
      'Not connected to bridge. POST /api/connect first or set BRIDGE_URL + PAIRING_CODE env vars.'
    ));
  }
  return bridge.send(msg);
}

async function connectToBridge(url, code) {
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    throw new Error('Invalid URL scheme. Use ws:// or wss://');
  }
  // Tear down any previous connection. autoReconnect:false — a long-lived dev
  // server shouldn't silently resurrect a connection the user closed via
  // POST /api/disconnect; reconnection is an explicit POST /api/connect.
  if (bridge) { try { bridge.disconnect(); } catch {} }
  connectError = null;
  bridgeUrl = url;
  pairingCode = code;

  bridge = new BridgeClient(url, code, { autoReconnect: false });
  try {
    await bridge.connect();
    console.log(`[aion] Connected to ${url}`);
    // Surface the bridge's de-identify mode (from the auth result) so the dev
    // console can show an accurate privacy badge.
    return { connected: true, deidentify: bridge.deidentify };
  } catch (e) {
    connectError = e.message;
    bridge = null;
    throw e;
  }
}

// ---- CORS ----
// Default to same-origin only (the bundled dev console is served from this
// origin, so it needs no cross-origin grant). Set CORS_ORIGIN to allow a
// specific origin, or "*" to opt into the old wildcard behaviour — do that
// only when the server is bound behind your own auth.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

app.use((req, res, next) => {
  if (CORS_ORIGIN) {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---- REST API Routes ----
// IMPORTANT: Fixed routes (_export, _metadata, _audit) must come BEFORE
// parameterized routes (:resourceType) to avoid Express matching conflicts.

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
  if (bridge) { try { bridge.disconnect(); } catch {} }
  bridge = null;
  res.json({ disconnected: true });
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

// Export: GET /api/_export — MUST be before :resourceType
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

// Metadata: GET /api/_metadata — MUST be before :resourceType
app.get('/api/_metadata', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'metadata' });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Graph: GET /api/_graph — MUST be before :resourceType
app.get('/api/_graph', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'graph' });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Graph Report: GET /api/_graph/report
app.get('/api/_graph/report', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'graph_report' });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.type('text/markdown').send(msg.payload.report);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Audit: GET /api/_audit — MUST be before :resourceType
app.get('/api/_audit', async (req, res) => {
  try {
    const msg = await bridgeSend({ type: 'audit', payload: { limit: req.query.limit ? parseInt(req.query.limit) : 50 } });
    if (msg.type === 'error') return res.status(400).json(msg.payload);
    res.json(msg.payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Query resources: GET /api/:resourceType — MUST be after fixed routes
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

// ---- Start ----

app.listen(PORT, HOST, async () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║          Aion Bridge — Developer Console         ║
  ╚══════════════════════════════════════════════════╝

  Console:  http://${HOST}:${PORT}
  REST API: http://${HOST}:${PORT}/api/{type}
  bridge-core: v${BRIDGE_CORE_VERSION}
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

// Graceful shutdown
function shutdown() {
  console.log('\n[aion] Shutting down...');
  if (bridge) { try { bridge.disconnect(); } catch {} }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
