"use strict";
/**
 * WebSocket client for the Aion FHIR bridge.
 *
 * Connects to the phone's bridge server, authenticates with the pairing code,
 * and exposes typed request/response helpers. Used by the MCP server and the
 * dev-console REST API; the Electron companion uses {@link BufferedBridgeClient}
 * (a subclass adding offline buffering) from ./buffered-bridge-client.
 *
 * Uses the `ws` package (Node.js), not the browser WebSocket global.
 *
 * @module @aion-health/core/bridge-client
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeClient = void 0;
const ws_1 = __importDefault(require("ws"));
class BridgeClient {
    url;
    pairingCode;
    ws = null;
    pending = new Map();
    counter = 0;
    connected = false;
    pingInterval = null;
    pongTimeout = null;
    reconnecting = false;
    /** Set only by disconnect()/disconnectClean() — suppresses all reconnect. */
    intentionalClose = false;
    /** True once any connection has successfully authenticated. Distinguishes
     *  "initial connect never opened" from "a good connection dropped". */
    hasAuthedOnce = false;
    /** De-identify mode reported by the bridge in the auth result (undefined until authed). */
    deidentify;
    reconnectAttempts = 0;
    autoReconnect;
    pingEnabled;
    reconnectOnInitialFailure;
    static PING_INTERVAL_MS = 30_000;
    static PONG_TIMEOUT_MS = 10_000;
    static CONNECT_TIMEOUT_MS = 30_000;
    static REQUEST_TIMEOUT_MS = 60_000;
    constructor(url, pairingCode, options = {}) {
        this.url = url;
        this.pairingCode = pairingCode;
        this.autoReconnect = options.autoReconnect ?? true;
        this.pingEnabled = options.ping ?? true;
        this.reconnectOnInitialFailure = options.reconnectOnInitialFailure ?? false;
    }
    isConnected() {
        return this.connected && this.ws?.readyState === ws_1.default.OPEN;
    }
    async connect() {
        this.intentionalClose = false;
        this.reconnectAttempts = 0;
        return this.doConnect();
    }
    /** Tear down any existing socket and its listeners before opening a new one.
     *  Prevents an orphaned WebSocket (leak + ghost 'close'→reconnect + stale
     *  pending rejections) when connect is called while one is already in flight. */
    teardownSocket() {
        if (!this.ws)
            return;
        const old = this.ws;
        this.ws = null;
        this.stopPing();
        old.removeAllListeners();
        // terminate() on a socket still mid-handshake emits an 'error' ("closed
        // before the connection was established"). With listeners removed that would
        // be an unhandled 'error' → process crash, so attach a swallow first.
        old.on('error', () => { });
        try {
            old.terminate();
        }
        catch { /* already gone */ }
    }
    async doConnect() {
        // Reentrancy guard: if a socket is already open or mid-handshake, drop it
        // cleanly first so listeners from the old socket can't fire against new state.
        this.teardownSocket();
        return new Promise((resolve, reject) => {
            // settle() gates the connect promise to exactly one resolve/reject.
            // emitErrorOnce() gates the onError observer hook to one call per attempt,
            // so an auth failure and a socket error can't double-fire (which would
            // double-count failures in consumers). Reconnect is driven solely by the
            // 'close' handler, never from here.
            let settled = false;
            let errorEmitted = false;
            const emitErrorOnce = (err) => {
                if (errorEmitted)
                    return;
                errorEmitted = true;
                this.onError(err);
            };
            const ws = new ws_1.default(this.url, {
                rejectUnauthorized: false,
                checkServerIdentity: () => { return undefined; },
                minVersion: 'TLSv1.2',
            });
            this.ws = ws;
            const timeout = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                try {
                    ws.close();
                }
                catch { /* noop */ }
                reject(new Error(`Connection to ${this.url} timed out after ${BridgeClient.CONNECT_TIMEOUT_MS / 1000}s`));
            }, BridgeClient.CONNECT_TIMEOUT_MS);
            ws.on('open', async () => {
                // Ignore events from a socket that's been superseded by a newer connect.
                if (this.ws !== ws)
                    return;
                try {
                    const resp = await this.send({
                        type: 'auth',
                        payload: { pairingCode: this.pairingCode },
                    });
                    if (resp.payload?.authenticated) {
                        this.connected = true;
                        this.hasAuthedOnce = true;
                        this.reconnectAttempts = 0;
                        // The bridge reports its de-identify mode in the auth result; expose
                        // it so consumers (e.g. the dev console) can reflect the real state.
                        this.deidentify = resp.payload?.deidentify;
                        this.onConnected();
                        if (this.pingEnabled)
                            this.startPing();
                        clearTimeout(timeout);
                        if (!settled) {
                            settled = true;
                            resolve();
                        }
                    }
                    else {
                        // Wrong pairing code: surface it to observers and stop — retrying the
                        // same bad code would just spam the bridge's auth rate-limiter. The
                        // caller must re-issue connect() with a corrected code (which clears
                        // intentionalClose). Closing the socket triggers onDisconnected.
                        clearTimeout(timeout);
                        const authErr = new Error('Authentication failed — check pairing code');
                        this.intentionalClose = true;
                        emitErrorOnce(authErr);
                        try {
                            ws.close();
                        }
                        catch { /* noop */ }
                        if (!settled) {
                            settled = true;
                            reject(authErr);
                        }
                    }
                }
                catch (err) {
                    clearTimeout(timeout);
                    emitErrorOnce(err instanceof Error ? err : new Error(String(err)));
                    try {
                        ws.close();
                    }
                    catch { /* noop */ }
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                }
            });
            ws.on('message', (data) => {
                if (this.ws !== ws)
                    return;
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id && this.pending.has(msg.id)) {
                        const { resolve } = this.pending.get(msg.id);
                        this.pending.delete(msg.id);
                        resolve(msg);
                    }
                    else {
                        this.onMessage(msg);
                    }
                }
                catch { /* ignore parse errors */ }
            });
            ws.on('error', (err) => {
                if (this.ws !== ws)
                    return;
                // Reject the connect promise on a pre-open failure, but DO NOT touch
                // reconnect state — the 'close' handler decides whether to retry. This
                // is the only place the connect promise's caller hears about the error;
                // the onError hook is for *observers* (e.g. UI), not the promise path.
                clearTimeout(timeout);
                // The `ws` library often emits an error with an EMPTY message when a
                // wss:// client hits a plain-ws server (TLS handshake gets a non-TLS
                // reply) or the peer resets mid-handshake. Surface the error `code`
                // and a hint so the failure isn't an uninformative "WebSocket error:".
                if (!settled) {
                    settled = true;
                    const code = err.code;
                    const detail = err.message || (code ? `${code}` : '')
                        || 'no details — usually a TLS mismatch (the server may be plain ws://) or the bridge isn’t listening';
                    reject(new Error(`WebSocket error: ${detail}`));
                }
                emitErrorOnce(err);
            });
            ws.on('close', () => {
                if (this.ws !== ws)
                    return; // superseded socket — ignore
                this.connected = false;
                this.stopPing();
                for (const [, { reject }] of this.pending)
                    reject(new Error('Connection closed'));
                this.pending.clear();
                this.onDisconnected();
                // Reconnect when: not deliberately closed, autoReconnect on, and either
                // we've connected successfully before OR the caller opted into retrying
                // failed initial connects (long-lived daemons).
                const shouldRetry = this.autoReconnect && !this.intentionalClose &&
                    (this.hasAuthedOnce || this.reconnectOnInitialFailure);
                if (shouldRetry)
                    this.scheduleReconnect();
            });
        });
    }
    // ---- Subclass hooks (no-ops by default) ----
    /** Called after auth succeeds. Subclasses flush buffers / emit state here. */
    onConnected() { }
    /** Called after the socket closes (any reason). */
    onDisconnected() { }
    /** Called on socket error. */
    onError(_err) { }
    /** Called for unsolicited messages (no matching request id), e.g. `change` pushes. */
    onMessage(_msg) { }
    startPing() {
        this.stopPing();
        // Register pong handler once for this connection
        this.ws?.on('pong', () => {
            if (this.pongTimeout) {
                clearTimeout(this.pongTimeout);
                this.pongTimeout = null;
            }
        });
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                this.ws.ping();
                // If no PONG arrives within timeout, the connection is dead — force close
                this.pongTimeout = setTimeout(() => {
                    process.stderr.write('[bridge-client] PONG timeout — connection appears dead, forcing reconnect\n');
                    this.ws?.terminate(); // triggers 'close' event → scheduleReconnect
                }, BridgeClient.PONG_TIMEOUT_MS);
            }
        }, BridgeClient.PING_INTERVAL_MS);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }
    scheduleReconnect() {
        if (this.intentionalClose)
            return;
        if (this.reconnecting) {
            // Connection dropped DURING an active reconnect attempt. The current
            // scheduled timeout will still fire and retry, so just bump the attempt
            // counter to track the failure (increases next backoff).
            this.reconnectAttempts++;
            return;
        }
        this.reconnecting = true;
        // Exponential backoff: 1s → 2s → 4s → … → 60s max. No hard cap — keep
        // retrying indefinitely so the client recovers when the phone comes online.
        const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 6)), 60_000);
        this.reconnectAttempts++;
        process.stderr.write(`[bridge-client] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...\n`);
        setTimeout(async () => {
            this.reconnecting = false;
            try {
                await this.doConnect();
                process.stderr.write('[bridge-client] Reconnected successfully.\n');
            }
            catch {
                // doConnect may fail before opening the socket (DNS, TLS), so close
                // handler might not fire. Schedule manually if nothing else will.
                if (!this.intentionalClose && !this.reconnecting) {
                    this.scheduleReconnect();
                }
            }
        }, delay);
    }
    async send(msg) {
        const id = `req-${++this.counter}`;
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
                reject(new Error('Not connected to bridge'));
                return;
            }
            const timeout = setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error('Request timed out (60s)'));
                }
            }, BridgeClient.REQUEST_TIMEOUT_MS);
            this.pending.set(id, {
                resolve: (m) => { clearTimeout(timeout); resolve(m); },
                reject: (err) => { clearTimeout(timeout); reject(err); },
            });
            try {
                this.ws.send(JSON.stringify({ ...msg, id }));
            }
            catch (err) {
                this.pending.delete(id);
                clearTimeout(timeout);
                reject(new Error(`Send failed: ${err.message}`));
            }
        });
    }
    // ---- Typed helpers ----
    async get(resourceType, id) {
        const resp = await this.send({ type: 'get', payload: { resourceType, id } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Get failed');
        return resp.payload?.resource;
    }
    async query(resourceType, options) {
        const resp = await this.send({ type: 'query', payload: { resourceType, ...options } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Query failed');
        return (resp.payload?.entry || []).map((e) => e.resource);
    }
    async analyze(question, options) {
        const resp = await this.send({ type: 'analyze', payload: { question, ...(options ?? {}) } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Analysis failed');
        return resp.payload?.answer || '';
    }
    /** Natural-language health knowledge-graph report (markdown). */
    async graphReport() {
        const resp = await this.send({ type: 'graph_report' });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Graph report failed');
        return resp.payload?.report || '';
    }
    async exportBundle(resourceType) {
        const resp = await this.send({ type: 'export', payload: { format: 'bundle', resourceType } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Export failed');
        return resp.payload?.data || resp.payload || {};
    }
    async metadata() {
        const resp = await this.send({ type: 'metadata' });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Metadata failed');
        return resp.payload;
    }
    async audit(limit = 50) {
        const resp = await this.send({ type: 'audit', payload: { limit } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Audit failed');
        return resp.payload;
    }
    async count(resourceType) {
        const resp = await this.send({ type: 'count', payload: resourceType ? { resourceType } : {} });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Count failed');
        return resp.payload?.count ?? 0;
    }
    async ingest(resources, source) {
        const resp = await this.send({ type: 'ingest', payload: { resources, ...(source ? { source } : {}) } });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Ingest failed');
        return resp.payload;
    }
    async subscribe(resourceTypes) {
        const resp = await this.send({
            type: 'subscribe',
            payload: resourceTypes ? { resourceTypes } : undefined,
        });
        if (resp.type === 'error')
            throw new Error(resp.payload?.message || 'Subscribe failed');
    }
    async unsubscribe() {
        await this.send({ type: 'unsubscribe' });
    }
    disconnect() {
        this.intentionalClose = true;
        this.connected = false;
        this.stopPing();
        this.ws?.close();
    }
    /** Like disconnect(), but waits for the WebSocket close handshake to complete
     *  so the remote side (iOS/Android bridge) has fully torn down the session
     *  before the caller proceeds. Use this after a test connection so the bridge
     *  is in a clean state when the real client connects. */
    disconnectClean() {
        return new Promise((resolve) => {
            if (!this.ws || this.ws.readyState === ws_1.default.CLOSED) {
                this.connected = false;
                this.stopPing();
                resolve();
                return;
            }
            this.intentionalClose = true;
            this.connected = false;
            this.stopPing();
            this.ws.once('close', () => resolve());
            this.ws.close();
            // Safety timeout — resolve after 3s even if the server never sends a close frame
            setTimeout(resolve, 3000);
        });
    }
}
exports.BridgeClient = BridgeClient;
