"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRIDGE_CORE_VERSION = void 0;
function readVersion() {
    try {
        // From compiled dist/version.js, package.json is one directory up.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('../package.json');
        return pkg.version ?? '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
exports.BRIDGE_CORE_VERSION = readVersion();
