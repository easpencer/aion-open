/**
 * Shared-core version, read from this package's package.json so there is one
 * source of truth. Independent of the mcp package's product version.
 *
 * The lib compiles to CommonJS (so the CJS Electron companion can require it
 * and ESM consumers import it via interop), hence the `require`-based read
 * rather than `import.meta.url`.
 *
 * @module @aion-health/core/version
 */
export declare const BRIDGE_CORE_VERSION: string;
