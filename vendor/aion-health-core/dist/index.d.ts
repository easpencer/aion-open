/**
 * @aion-health/core — shared PC-side bridge primitives.
 *
 * Consumed by:
 *   - @aion-health/bridge  (the MCP server + CLI + setup wizard)
 *   - aion-open            (REST API + dev console)
 *   - aion-desktop         (Electron companion)
 *
 * Compiles to CommonJS so the CJS Electron companion can `require()` it while
 * ESM consumers import it through Node's CJS interop.
 *
 * @module @aion-health/core
 */
export * from './protocol';
export * from './discovery';
export * from './bridge-client';
export * from './buffered-bridge-client';
export * from './mcp-clients';
export { BRIDGE_CORE_VERSION } from './version';
