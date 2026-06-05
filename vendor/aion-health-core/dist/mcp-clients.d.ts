/**
 * AI-client MCP config registry + atomic config writers.
 *
 * Shared by the MCP setup wizard (mcp/src/setup.ts) and the Electron companion
 * (aion-desktop/main.js) so the list of supported clients, the atomic write
 * semantics, and the Aion Desktop settings sync live in exactly one place.
 *
 * @module @aion-health/core/mcp-clients
 */
export type ConfigFormat = 'json-mcpServers' | 'json-contextServers' | 'yaml' | 'toml';
export interface AiClient {
    id: string;
    displayName: string;
    configPath: string;
    format: ConfigFormat;
    restartHint: string;
}
export interface McpEntry {
    command: string;
    args: string[];
    env: Record<string, string>;
}
/** How the MCP server is launched from an AI client's config. */
export type LaunchMethod = 'npx' | 'binary';
/**
 * Build the `{ command, args }` an AI client uses to spawn the MCP server.
 *
 *   'npx'    → `npx -y @aion-health/bridge`  (needs the package to be reachable)
 *   'binary' → an absolute path to a bundled executable / script
 *              (e.g. shipped inside the Aion Desktop app — no registry needed)
 */
export declare function buildLaunchCommand(method: LaunchMethod, binaryPath?: string): {
    command: string;
    args: string[];
};
/** Assemble a full MCP entry from a launch method + bridge connection env. */
export declare function buildMcpEntry(opts: {
    method: LaunchMethod;
    binaryPath?: string;
    bridgeUrl: string;
    pairingCode: string;
}): McpEntry;
export declare function getKnownClients(): AiClient[];
export declare function isClientInstalled(id: string): boolean;
export declare function detectInstalledClients(known?: AiClient[]): AiClient[];
export declare function readJsonSafe(filePath: string): Record<string, unknown>;
export declare function writeJsonSafe(filePath: string, data: Record<string, unknown>): void;
/** Standard mcpServers format — Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI. */
export declare function writeJsonMcpServers(configPath: string, entry: McpEntry): void;
/** Zed uses context_servers with a slightly different entry shape. */
export declare function writeZedContextServers(configPath: string, entry: McpEntry): void;
/** Write the appropriate JSON config for a client. Returns false for manual (yaml/toml) formats. */
export declare function writeClientConfig(client: AiClient, entry: McpEntry): boolean;
export declare function manualYamlSnippet(entry: McpEntry): string;
export declare function manualTomlSnippet(entry: McpEntry): string;
/**
 * Platform-specific path to Aion Desktop's settings.json.
 * Mirrors Electron's app.getPath('userData') for the 'aion-desktop' app name.
 */
export declare function getElectronSettingsPath(): string;
/**
 * Merge bridgeUrl + pairingCode into Aion Desktop's settings file.
 * Preserves all other settings. Returns true on success, false if the file
 * can't be written (app not installed).
 */
export declare function syncElectronSettings(bridgeUrl: string, pairingCode: string): boolean;
