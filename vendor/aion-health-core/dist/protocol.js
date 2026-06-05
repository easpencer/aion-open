"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeErrorCode = exports.SUPPORTED_RESOURCE_TYPES = exports.BRIDGE_SERVICE = exports.BRIDGE_PORT = void 0;
/** Default LAN port the phone bridge listens on. */
exports.BRIDGE_PORT = 8420;
/** Bonjour / mDNS service type the phone advertises and PCs browse for. */
exports.BRIDGE_SERVICE = '_aion-fhir._tcp';
/**
 * Canonical set of FHIR resource types the bridge serves — the single source
 * of truth shared by the phone server (`BridgeService.SUPPORTED_RESOURCE_TYPES`)
 * and the MCP `fhir_*` tool enum. Keeping both sides derived from this constant
 * prevents the drift where the MCP advertised a type the bridge rejected (or
 * vice-versa). The on-device store imposes no per-type allowlist of its own —
 * any resource with a `resourceType` + `id` is storable — so this list is the
 * effective contract.
 */
exports.SUPPORTED_RESOURCE_TYPES = [
    'Patient',
    'Observation',
    'Condition',
    'MedicationRequest',
    'MedicationStatement',
    'MedicationAdministration',
    'AllergyIntolerance',
    'Immunization',
    'Procedure',
    'Encounter',
    'DiagnosticReport',
    'DocumentReference',
    'CarePlan',
    'Goal',
    'FamilyMemberHistory',
    'ClinicalImpression',
    'Composition',
    'Flag',
    'ImagingStudy',
    'QuestionnaireResponse',
];
/**
 * Error codes the phone bridge can return in an `error` payload.
 * Mirrored from BridgeService so consumers can branch on them by name
 * instead of matching free-text messages.
 */
exports.BridgeErrorCode = {
    PARSE_ERROR: 'PARSE_ERROR',
    MESSAGE_TOO_LARGE: 'MESSAGE_TOO_LARGE',
    UNAUTHORIZED: 'UNAUTHORIZED',
    AUTH_FAILED: 'AUTH_FAILED',
    RATE_LIMITED: 'RATE_LIMITED',
    UNKNOWN_TYPE: 'UNKNOWN_TYPE',
    INVALID_QUERY: 'INVALID_QUERY',
    UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
    QUERY_FAILED: 'QUERY_FAILED',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_GET: 'INVALID_GET',
    GET_FAILED: 'GET_FAILED',
    COUNT_FAILED: 'COUNT_FAILED',
    EXPORT_FAILED: 'EXPORT_FAILED',
    INGEST_FAILED: 'INGEST_FAILED',
    INVALID_INGEST: 'INVALID_INGEST',
    BATCH_TOO_LARGE: 'BATCH_TOO_LARGE',
    ANALYZE_FAILED: 'ANALYZE_FAILED',
    INVALID_ANALYZE: 'INVALID_ANALYZE',
    LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
    GRAPH_FAILED: 'GRAPH_FAILED',
    GRAPH_REPORT_FAILED: 'GRAPH_REPORT_FAILED',
    TOO_MANY_TYPES: 'TOO_MANY_TYPES',
    TOO_MANY_SUBSCRIBERS: 'TOO_MANY_SUBSCRIBERS',
};
