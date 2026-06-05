/**
 * Aion bridge wire protocol — single source of truth.
 *
 * The phone runs the WebSocket server (see ../../BridgeService.ts); PC-side
 * consumers (the MCP server, the dev-console REST API, the Electron companion)
 * all speak this protocol. Keeping the message shapes, port, mDNS service name,
 * and error codes here prevents the drift that comes from each consumer
 * redefining them.
 *
 * @module @aion-health/core/protocol
 */
/** Default LAN port the phone bridge listens on. */
export declare const BRIDGE_PORT = 8420;
/** Bonjour / mDNS service type the phone advertises and PCs browse for. */
export declare const BRIDGE_SERVICE = "_aion-fhir._tcp";
/**
 * Canonical set of FHIR resource types the bridge serves — the single source
 * of truth shared by the phone server (`BridgeService.SUPPORTED_RESOURCE_TYPES`)
 * and the MCP `fhir_*` tool enum. Keeping both sides derived from this constant
 * prevents the drift where the MCP advertised a type the bridge rejected (or
 * vice-versa). The on-device store imposes no per-type allowlist of its own —
 * any resource with a `resourceType` + `id` is storable — so this list is the
 * effective contract.
 */
export declare const SUPPORTED_RESOURCE_TYPES: readonly ["Patient", "Observation", "Condition", "MedicationRequest", "MedicationStatement", "MedicationAdministration", "AllergyIntolerance", "Immunization", "Procedure", "Encounter", "DiagnosticReport", "DocumentReference", "CarePlan", "Goal", "FamilyMemberHistory", "ClinicalImpression", "Composition", "Flag", "ImagingStudy", "QuestionnaireResponse"];
export type SupportedResourceType = (typeof SUPPORTED_RESOURCE_TYPES)[number];
/** Every message type carried over the wire (request, response, and push). */
export type BridgeMessageType = 'auth' | 'query' | 'get' | 'metadata' | 'subscribe' | 'unsubscribe' | 'audit' | 'graph' | 'graph_report' | 'ingest' | 'count' | 'export' | 'analyze' | 'ping' | 'result' | 'error' | 'change' | 'pong';
/** A single framed message. `id` correlates a response with its request. */
export interface BridgeMessage {
    type: BridgeMessageType | string;
    id?: string;
    payload?: unknown;
}
/**
 * Error codes the phone bridge can return in an `error` payload.
 * Mirrored from BridgeService so consumers can branch on them by name
 * instead of matching free-text messages.
 */
export declare const BridgeErrorCode: {
    readonly PARSE_ERROR: "PARSE_ERROR";
    readonly MESSAGE_TOO_LARGE: "MESSAGE_TOO_LARGE";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly AUTH_FAILED: "AUTH_FAILED";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly UNKNOWN_TYPE: "UNKNOWN_TYPE";
    readonly INVALID_QUERY: "INVALID_QUERY";
    readonly UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE";
    readonly QUERY_FAILED: "QUERY_FAILED";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly INVALID_GET: "INVALID_GET";
    readonly GET_FAILED: "GET_FAILED";
    readonly COUNT_FAILED: "COUNT_FAILED";
    readonly EXPORT_FAILED: "EXPORT_FAILED";
    readonly INGEST_FAILED: "INGEST_FAILED";
    readonly INVALID_INGEST: "INVALID_INGEST";
    readonly BATCH_TOO_LARGE: "BATCH_TOO_LARGE";
    readonly ANALYZE_FAILED: "ANALYZE_FAILED";
    readonly INVALID_ANALYZE: "INVALID_ANALYZE";
    readonly LLM_UNAVAILABLE: "LLM_UNAVAILABLE";
    readonly GRAPH_FAILED: "GRAPH_FAILED";
    readonly GRAPH_REPORT_FAILED: "GRAPH_REPORT_FAILED";
    readonly TOO_MANY_TYPES: "TOO_MANY_TYPES";
    readonly TOO_MANY_SUBSCRIBERS: "TOO_MANY_SUBSCRIBERS";
};
export type BridgeErrorCode = (typeof BridgeErrorCode)[keyof typeof BridgeErrorCode];
/**
 * Optional LLM routing for the `analyze` request. When omitted, the bridge
 * defaults to Ollama on the phone's own localhost (rarely what a PC-side
 * caller wants), so PC consumers should pass `baseUrl`/`provider` pointing at
 * an LLM reachable from the phone, or an `apiKey`-backed cloud provider.
 */
export interface AnalyzeOptions {
    /** 'ollama' | 'claude' | 'openai' | 'groq' | 'lmstudio' | … (open string). */
    provider?: string;
    /** Override base URL for any provider (e.g. a PC's Ollama over the LAN). */
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    /** Which FHIR resource types to gather as context (default Condition/Meds/Obs). */
    resourceTypes?: string[];
}
/** Relative time-window helper accepted by query predicates. */
export type DurationOption = '1day' | '1week' | '1month' | '3months' | '6months' | '1year' | 'all';
/**
 * Full FHIR query predicate surface understood by the phone store
 * (`queryResources`). The MCP `fhir_query` tool advertises all of these;
 * the bridge must forward every field it sets.
 *
 * `coding`, `codings`, and `codingPrefix` are mutually exclusive — set at
 * most one. `status` and `statusIn` are likewise mutually exclusive.
 */
export interface FHIRQueryPredicate {
    resourceType?: string;
    category?: string;
    /** Exact-match a single `system|code` token. */
    coding?: string;
    /** Any-of match: resource codings must intersect this list. */
    codings?: string[];
    /** Prefix-match a coding token (e.g. `http://loinc.org|`). */
    codingPrefix?: string;
    /** Single status value (SQL `status = ?`). */
    status?: string;
    /** Any-of status match (SQL `status IN (...)`). */
    statusIn?: string[];
    /** Filter by `Resource.id` — must be paired with `resourceType`. */
    ids?: string[];
    /** Include resources with status `entered-in-error` (default false). */
    includeEnteredInError?: boolean;
    /** Only resources whose storage write time is after this ISO timestamp. */
    updatedAfter?: string;
    /** Clinical-time window (filters `effective_date`). */
    dateRange?: {
        start?: string;
        end?: string;
    };
    /** Relative window — resolved to a `dateRange.start` by the store. */
    duration?: DurationOption;
    limit?: number;
    offset?: number;
    sortOrder?: 'asc' | 'desc';
}
