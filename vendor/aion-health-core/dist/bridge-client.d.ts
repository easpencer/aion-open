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
import WebSocket from 'ws';
import type { AnalyzeOptions, BridgeMessage, FHIRQueryPredicate } from './protocol';
export interface BridgeClientOptions {
    /** Reconnect with exponential backoff after an unexpected drop (default true). */
    autoReconnect?: boolean;
    /** Send WS ping/pong liveness probes (default true). */
    ping?: boolean;
    /**
     * Keep retrying in the background even when the *initial* connection never
     * opened (DNS/TLS/refused), not just after a previously-good connection
     * drops. The MCP server leaves this false — a failed first connect rejects
     * and the next tool call retries explicitly. Long-lived daemons (the desktop
     * companion) set it true so they recover when the phone comes online.
     * Only has effect when autoReconnect is true. Default false.
     */
    reconnectOnInitialFailure?: boolean;
}
export declare class BridgeClient {
    protected url: string;
    protected pairingCode: string;
    protected ws: WebSocket | null;
    private pending;
    private counter;
    protected connected: boolean;
    private pingInterval;
    private pongTimeout;
    private reconnecting;
    /** Set only by disconnect()/disconnectClean() — suppresses all reconnect. */
    protected intentionalClose: boolean;
    /** True once any connection has successfully authenticated. Distinguishes
     *  "initial connect never opened" from "a good connection dropped". */
    private hasAuthedOnce;
    /** De-identify mode reported by the bridge in the auth result (undefined until authed). */
    deidentify: boolean | undefined;
    private reconnectAttempts;
    private readonly autoReconnect;
    private readonly pingEnabled;
    private readonly reconnectOnInitialFailure;
    private static readonly PING_INTERVAL_MS;
    private static readonly PONG_TIMEOUT_MS;
    private static readonly CONNECT_TIMEOUT_MS;
    private static readonly REQUEST_TIMEOUT_MS;
    constructor(url: string, pairingCode: string, options?: BridgeClientOptions);
    isConnected(): boolean;
    connect(): Promise<void>;
    /** Tear down any existing socket and its listeners before opening a new one.
     *  Prevents an orphaned WebSocket (leak + ghost 'close'→reconnect + stale
     *  pending rejections) when connect is called while one is already in flight. */
    private teardownSocket;
    private doConnect;
    /** Called after auth succeeds. Subclasses flush buffers / emit state here. */
    protected onConnected(): void;
    /** Called after the socket closes (any reason). */
    protected onDisconnected(): void;
    /** Called on socket error. */
    protected onError(_err: Error): void;
    /** Called for unsolicited messages (no matching request id), e.g. `change` pushes. */
    protected onMessage(_msg: BridgeMessage): void;
    private startPing;
    private stopPing;
    private scheduleReconnect;
    send(msg: Omit<BridgeMessage, 'id'>): Promise<BridgeMessage>;
    get(resourceType: string, id: string): Promise<any>;
    query(resourceType: string, options?: Omit<FHIRQueryPredicate, 'resourceType'>): Promise<any[]>;
    analyze(question: string, options?: AnalyzeOptions): Promise<string>;
    /** Natural-language health knowledge-graph report (markdown). */
    graphReport(): Promise<string>;
    exportBundle(resourceType?: string): Promise<object>;
    metadata(): Promise<any>;
    audit(limit?: number): Promise<any>;
    count(resourceType?: string): Promise<number>;
    ingest(resources: object[], source?: string): Promise<{
        stored: number;
        unchanged: number;
        failed: number;
        rejected: number;
        total: number;
    }>;
    subscribe(resourceTypes?: string[]): Promise<void>;
    unsubscribe(): Promise<void>;
    disconnect(): void;
    /** Like disconnect(), but waits for the WebSocket close handshake to complete
     *  so the remote side (iOS/Android bridge) has fully torn down the session
     *  before the caller proceeds. Use this after a test connection so the bridge
     *  is in a clean state when the real client connects. */
    disconnectClean(): Promise<void>;
}
