"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRIDGE_CORE_VERSION = void 0;
__exportStar(require("./protocol"), exports);
__exportStar(require("./discovery"), exports);
__exportStar(require("./bridge-client"), exports);
__exportStar(require("./buffered-bridge-client"), exports);
__exportStar(require("./mcp-clients"), exports);
var version_1 = require("./version");
Object.defineProperty(exports, "BRIDGE_CORE_VERSION", { enumerable: true, get: function () { return version_1.BRIDGE_CORE_VERSION; } });
