"use strict";
/**
 * BufferedBridgeClient — bridge client with an offline observation buffer.
 *
 * Used by the Aion Desktop Electron companion. Extends {@link BridgeClient}
 * with:
 *   - an EventEmitter surface (`state` / `error` / `ingested`)
 *   - a 24-hour offline buffer persisted to disk (atomic tmp+rename), so a
 *     crash / power loss / OS reboot doesn't drop captured activity
 *   - `sendObservations()` that buffers when offline and flushes on reconnect
 *
 * The base class owns connection / auth / ping / reconnect; this subclass only
 * adds buffering and event emission via the protected hooks.
 *
 * IMPORTANT: `buffer` and `_persistBuffer()` are part of the public contract —
 * the Electron main process reaches into them directly from its crash-flush
 * (`uncaughtException` / `before-quit`) handlers. Do not rename them.
 *
 * @module @aion-health/core/buffered-bridge-client
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferedBridgeClient = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const bridge_client_1 = require("./bridge-client");
const MAX_BUFFER = 24 * 60; // up to 24 hours of hourly batches (~1440 observations)
class BufferedBridgeClient extends bridge_client_1.BridgeClient {
    events = new events_1.EventEmitter();
    /** Offline buffer of pending batches. Public: the crash-flush handler appends here. */
    buffer = [];
    bufferPath = null;
    state = 'disconnected';
    /** Guards against overlapping flushes when a reconnect flaps. */
    flushing = false;
    constructor(url = '', pairingCode = '') {
        // Long-lived daemon: auto-reconnect + ping liveness, and keep retrying even
        // if the very first connect never opened (phone offline at launch) so it
        // recovers when the phone comes online.
        super(url, pairingCode, { autoReconnect: true, ping: true, reconnectOnInitialFailure: true });
        // Guard: an EventEmitter throws on an 'error' event with no listener, which
        // would crash the host process. A no-op default ensures a transient socket
        // error before the consumer attaches its handler can never take the app down.
        this.events.on('error', () => { });
    }
    on(event, cb) {
        this.events.on(event, cb);
        return this;
    }
    // ---- Connection (fire-and-forget, state via events — matches legacy API) ----
    connectTo(url, pairingCode) {
        this.url = url;
        this.pairingCode = pairingCode;
        this.setState('connecting');
        // Base connect() is async. We only swallow the rejection here to avoid an
        // unhandled-promise warning — the actual 'error' event is emitted once by
        // the base onError hook (below), so we must NOT re-emit it here (that would
        // double-count failures in consumers like main.js's autoConnectFailures).
        // State falls back to 'disconnected' via the onDisconnected hook when the
        // socket closes.
        void this.connect().catch(() => { });
    }
    getState() {
        return {
            state: this.state,
            bridgeUrl: this.url,
            bufferedBatches: this.buffer.length,
        };
    }
    setState(state) {
        this.state = state;
        this.events.emit('state', state);
    }
    // ---- Base-class hooks ----
    onConnected() {
        this.setState('connected');
        void this._flushBuffer();
    }
    onDisconnected() {
        this.setState('disconnected');
    }
    onError(err) {
        this.events.emit('error', err);
    }
    // ---- Offline buffer ----
    /**
     * Set the path used to persist the offline buffer (called once at startup
     * from main.js, after app.getPath('userData') is available). Loads any
     * previously persisted buffer so observations queued before a crash are
     * flushed on the next successful connect.
     */
    setBufferPath(p) {
        this.bufferPath = p;
        try {
            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    // Trim to MAX_BUFFER on load (a long-offline restore could exceed it)
                    this.buffer = parsed.slice(-MAX_BUFFER);
                    if (this.buffer.length > 0) {
                        console.log(`[BufferedBridgeClient] Restored ${this.buffer.length} buffered batches from disk`);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[BufferedBridgeClient] Could not load persisted buffer:', e?.message);
        }
    }
    /**
     * Persist the in-memory buffer to disk atomically (.tmp + rename) so a crash
     * mid-write can't truncate the file. Best-effort — never fail an ingest just
     * because the persist failed; the in-memory buffer remains authoritative.
     * Public: invoked directly by the Electron crash-flush handlers.
     */
    _persistBuffer() {
        if (!this.bufferPath)
            return;
        try {
            fs.mkdirSync(path.dirname(this.bufferPath), { recursive: true });
            const tmp = this.bufferPath + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(this.buffer), { encoding: 'utf8', mode: 0o600 });
            fs.renameSync(tmp, this.bufferPath);
        }
        catch (e) {
            console.warn('[BufferedBridgeClient] Buffer persist failed:', e?.message);
        }
    }
    /**
     * Send FHIR Observations to the phone. If not connected, buffers them for
     * later delivery (persisted to disk).
     */
    async sendObservations(observations) {
        if (!observations || observations.length === 0)
            return;
        if (!this.isConnected()) {
            this.buffer.push({ observations, timestamp: new Date().toISOString() });
            if (this.buffer.length > MAX_BUFFER) {
                this.buffer.shift(); // drop oldest
                console.warn('[BufferedBridgeClient] Offline buffer full (24h) — oldest observations dropped. Check phone connection.');
            }
            this._persistBuffer();
            console.log(`[BufferedBridgeClient] Buffered ${observations.length} observations (offline, total batches: ${this.buffer.length})`);
            return { buffered: true, count: observations.length };
        }
        const payload = await this.ingest(observations, 'desktop_companion');
        this.events.emit('ingested', payload);
        return payload;
    }
    async _flushBuffer() {
        if (this.flushing)
            return; // a flush is already draining the buffer
        if (this.buffer.length === 0)
            return;
        this.flushing = true;
        try {
            await this._drainBuffer();
        }
        finally {
            this.flushing = false;
        }
    }
    async _drainBuffer() {
        console.log(`[BufferedBridgeClient] Flushing ${this.buffer.length} buffered batches...`);
        const toSend = this.buffer.splice(0);
        // Persist the now-empty buffer so a crash during flush doesn't replay
        // batches that have already been sent.
        this._persistBuffer();
        let sent = 0;
        for (let i = 0; i < toSend.length; i++) {
            const { observations } = toSend[i];
            try {
                const payload = await this.ingest(observations, 'desktop_companion');
                this.events.emit('ingested', payload);
                sent += observations.length;
            }
            catch (err) {
                console.warn('[BufferedBridgeClient] Flush failed for batch:', err?.message);
                // Re-buffer all unsent batches at the head, then re-trim to the cap —
                // concurrent sendObservations() may have appended while we were awaiting,
                // so unshift alone could push the buffer past MAX_BUFFER.
                const remaining = toSend.slice(i);
                this.buffer.unshift(...remaining);
                if (this.buffer.length > MAX_BUFFER) {
                    this.buffer.splice(0, this.buffer.length - MAX_BUFFER); // drop oldest
                }
                this._persistBuffer();
                break;
            }
        }
        if (sent > 0) {
            console.log(`[BufferedBridgeClient] Flushed ${sent} buffered observations`);
            this._persistBuffer();
        }
    }
}
exports.BufferedBridgeClient = BufferedBridgeClient;
