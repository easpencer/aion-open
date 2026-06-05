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
import { EventEmitter } from 'events';
import { BridgeClient } from './bridge-client';
export type BridgeState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';
interface BufferedBatch {
    observations: object[];
    timestamp: string;
}
export declare class BufferedBridgeClient extends BridgeClient {
    readonly events: EventEmitter<any>;
    /** Offline buffer of pending batches. Public: the crash-flush handler appends here. */
    buffer: BufferedBatch[];
    private bufferPath;
    private state;
    /** Guards against overlapping flushes when a reconnect flaps. */
    private flushing;
    constructor(url?: string, pairingCode?: string);
    on(event: 'state', cb: (state: BridgeState) => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    on(event: 'ingested', cb: (payload: any) => void): this;
    connectTo(url: string, pairingCode: string): void;
    getState(): {
        state: BridgeState;
        bridgeUrl: string;
        bufferedBatches: number;
    };
    private setState;
    protected onConnected(): void;
    protected onDisconnected(): void;
    protected onError(err: Error): void;
    /**
     * Set the path used to persist the offline buffer (called once at startup
     * from main.js, after app.getPath('userData') is available). Loads any
     * previously persisted buffer so observations queued before a crash are
     * flushed on the next successful connect.
     */
    setBufferPath(p: string): void;
    /**
     * Persist the in-memory buffer to disk atomically (.tmp + rename) so a crash
     * mid-write can't truncate the file. Best-effort — never fail an ingest just
     * because the persist failed; the in-memory buffer remains authoritative.
     * Public: invoked directly by the Electron crash-flush handlers.
     */
    _persistBuffer(): void;
    /**
     * Send FHIR Observations to the phone. If not connected, buffers them for
     * later delivery (persisted to disk).
     */
    sendObservations(observations: object[]): Promise<{
        buffered: boolean;
        count: number;
    } | any>;
    _flushBuffer(): Promise<void>;
    private _drainBuffer;
}
export {};
