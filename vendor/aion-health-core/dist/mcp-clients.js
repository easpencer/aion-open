"use strict";
/**
 * AI-client MCP config registry + atomic config writers.
 *
 * Shared by the MCP setup wizard (mcp/src/setup.ts) and the Electron companion
 * (aion-desktop/main.js) so the list of supported clients, the atomic write
 * semantics, and the Aion Desktop settings sync live in exactly one place.
 *
 * @module @aion-health/core/mcp-clients
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
exports.buildLaunchCommand = buildLaunchCommand;
exports.buildMcpEntry = buildMcpEntry;
exports.getKnownClients = getKnownClients;
exports.isClientInstalled = isClientInstalled;
exports.detectInstalledClients = detectInstalledClients;
exports.readJsonSafe = readJsonSafe;
exports.writeJsonSafe = writeJsonSafe;
exports.writeJsonMcpServers = writeJsonMcpServers;
exports.writeZedContextServers = writeZedContextServers;
exports.writeClientConfig = writeClientConfig;
exports.manualYamlSnippet = manualYamlSnippet;
exports.manualTomlSnippet = manualTomlSnippet;
exports.getElectronSettingsPath = getElectronSettingsPath;
exports.syncElectronSettings = syncElectronSettings;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
// ---------------------------------------------------------------------------
// Launch-command builders (dual distribution)
// ---------------------------------------------------------------------------
/**
 * Build the `{ command, args }` an AI client uses to spawn the MCP server.
 *
 *   'npx'    → `npx -y @aion-health/bridge`  (needs the package to be reachable)
 *   'binary' → an absolute path to a bundled executable / script
 *              (e.g. shipped inside the Aion Desktop app — no registry needed)
 */
function buildLaunchCommand(method, binaryPath) {
    if (method === 'binary') {
        if (!binaryPath)
            throw new Error('binaryPath is required when launch method is "binary"');
        return { command: binaryPath, args: [] };
    }
    return { command: 'npx', args: ['-y', '@aion-health/bridge'] };
}
/** Assemble a full MCP entry from a launch method + bridge connection env. */
function buildMcpEntry(opts) {
    const { command, args } = buildLaunchCommand(opts.method, opts.binaryPath);
    return {
        command,
        args,
        env: { AION_BRIDGE_URL: opts.bridgeUrl, AION_PAIRING_CODE: opts.pairingCode },
    };
}
// ---------------------------------------------------------------------------
// Client registry
// ---------------------------------------------------------------------------
function getKnownClients() {
    const home = os.homedir();
    const isWin = process.platform === 'win32';
    return [
        {
            id: 'claude-code',
            displayName: 'Claude Code',
            configPath: path.join(home, '.claude.json'),
            format: 'json-mcpServers',
            restartHint: 'Restart Claude Code, then run /mcp to verify.',
        },
        {
            id: 'claude-desktop',
            displayName: 'Claude Desktop',
            configPath: isWin
                ? path.join(process.env['APPDATA'] ?? home, 'Claude', 'claude_desktop_config.json')
                : path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
            format: 'json-mcpServers',
            restartHint: 'Quit and reopen Claude Desktop.',
        },
        {
            id: 'cursor',
            displayName: 'Cursor',
            configPath: path.join(home, '.cursor', 'mcp.json'),
            format: 'json-mcpServers',
            restartHint: 'Restart Cursor (Cmd/Ctrl+Shift+P → "Reload Window").',
        },
        {
            id: 'windsurf',
            displayName: 'Windsurf',
            configPath: isWin
                ? path.join(process.env['USERPROFILE'] ?? home, '.codeium', 'windsurf', 'mcp_config.json')
                : path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
            format: 'json-mcpServers',
            restartHint: 'Restart Windsurf.',
        },
        {
            id: 'gemini',
            displayName: 'Gemini CLI',
            configPath: path.join(home, '.gemini', 'settings.json'),
            format: 'json-mcpServers',
            restartHint: 'Config is picked up automatically on next gemini run.',
        },
        {
            id: 'zed',
            displayName: 'Zed',
            configPath: isWin
                ? path.join(process.env['APPDATA'] ?? home, 'Zed', 'settings.json')
                : path.join(home, '.config', 'zed', 'settings.json'),
            format: 'json-contextServers',
            restartHint: 'Zed picks up settings.json changes automatically.',
        },
        {
            id: 'continue',
            displayName: 'Continue.dev',
            configPath: path.join(home, '.continue', 'config.yaml'),
            format: 'yaml',
            restartHint: 'Reload the Continue extension in VS Code or JetBrains.',
        },
        {
            id: 'codex',
            displayName: 'OpenAI Codex',
            configPath: path.join(home, '.codex', 'config.toml'),
            format: 'toml',
            restartHint: 'Config is picked up automatically on next codex run.',
        },
    ];
}
// ---------------------------------------------------------------------------
// Client detection
// ---------------------------------------------------------------------------
function commandExists(cmd) {
    try {
        (0, child_process_1.execSync)(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function isClientInstalled(id) {
    const home = os.homedir();
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';
    switch (id) {
        case 'claude-code':
            return fs.existsSync(path.join(home, '.claude.json'))
                || fs.existsSync(path.join(home, '.claude'));
        case 'claude-desktop':
            return (isMac && fs.existsSync('/Applications/Claude.app'))
                || (isWin && fs.existsSync(path.join(process.env['LOCALAPPDATA'] ?? '', 'AnthropicClaude')))
                || fs.existsSync(path.join(home, 'Library', 'Application Support', 'Claude'));
        case 'cursor':
            return fs.existsSync(path.join(home, '.cursor'))
                || (isMac && fs.existsSync('/Applications/Cursor.app'));
        case 'windsurf':
            return fs.existsSync(path.join(home, '.codeium', 'windsurf'));
        case 'gemini':
            return fs.existsSync(path.join(home, '.gemini'))
                || commandExists('gemini');
        case 'zed':
            return (isMac && fs.existsSync('/Applications/Zed.app'))
                || fs.existsSync(path.join(home, '.config', 'zed'));
        case 'continue':
            return fs.existsSync(path.join(home, '.continue'));
        case 'codex':
            return fs.existsSync(path.join(home, '.codex'))
                || commandExists('codex');
        default:
            return false;
    }
}
function detectInstalledClients(known = getKnownClients()) {
    return known.filter(c => isClientInstalled(c.id));
}
// ---------------------------------------------------------------------------
// Atomic JSON read/write
// ---------------------------------------------------------------------------
function readJsonSafe(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(raw);
    }
    catch {
        // File exists but can't be parsed — back it up to avoid data loss
        const backupPath = filePath + '.bak.' + Date.now();
        try {
            fs.copyFileSync(filePath, backupPath);
            console.warn(`  Warning: ${filePath} has a parse error. Backed up to ${backupPath}`);
        }
        catch {
            console.warn(`  Warning: ${filePath} has a parse error and could not be backed up.`);
        }
        return {};
    }
}
function writeJsonSafe(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    // Atomic write: write to temp file, then rename (atomic on POSIX).
    // If the process crashes mid-write, the original file is preserved.
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
}
/** Standard mcpServers format — Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI. */
function writeJsonMcpServers(configPath, entry) {
    const existing = readJsonSafe(configPath);
    writeJsonSafe(configPath, {
        ...existing,
        mcpServers: {
            ...(existing['mcpServers'] ?? {}),
            'aion-health': { command: entry.command, args: entry.args, env: entry.env },
        },
    });
}
/** Zed uses context_servers with a slightly different entry shape. */
function writeZedContextServers(configPath, entry) {
    const existing = readJsonSafe(configPath);
    writeJsonSafe(configPath, {
        ...existing,
        context_servers: {
            ...(existing['context_servers'] ?? {}),
            'aion-health': {
                source: 'custom',
                command: entry.command,
                args: entry.args,
                env: entry.env,
            },
        },
    });
}
/** Write the appropriate JSON config for a client. Returns false for manual (yaml/toml) formats. */
function writeClientConfig(client, entry) {
    if (client.format === 'json-mcpServers') {
        writeJsonMcpServers(client.configPath, entry);
        return true;
    }
    if (client.format === 'json-contextServers') {
        writeZedContextServers(client.configPath, entry);
        return true;
    }
    return false; // yaml / toml need a printed snippet
}
// ---------------------------------------------------------------------------
// Manual snippets (yaml/toml clients — avoids adding YAML/TOML deps)
// ---------------------------------------------------------------------------
function manualYamlSnippet(entry) {
    return [
        'mcpServers:',
        '  - name: aion-health',
        `    command: ${entry.command}`,
        `    args: [${entry.args.map(a => `"${a}"`).join(', ')}]`,
        `    env:`,
        `      AION_BRIDGE_URL: "${entry.env['AION_BRIDGE_URL']}"`,
        `      AION_PAIRING_CODE: "${entry.env['AION_PAIRING_CODE']}"`,
    ].join('\n');
}
function manualTomlSnippet(entry) {
    return [
        '[mcp_servers.aion-health]',
        `command = "${entry.command}"`,
        `args = [${entry.args.map(a => `"${a}"`).join(', ')}]`,
        '',
        '[mcp_servers.aion-health.env]',
        `AION_BRIDGE_URL = "${entry.env['AION_BRIDGE_URL']}"`,
        `AION_PAIRING_CODE = "${entry.env['AION_PAIRING_CODE']}"`,
    ].join('\n');
}
// ---------------------------------------------------------------------------
// Aion Desktop (Electron) settings sync
// ---------------------------------------------------------------------------
/**
 * Platform-specific path to Aion Desktop's settings.json.
 * Mirrors Electron's app.getPath('userData') for the 'aion-desktop' app name.
 */
function getElectronSettingsPath() {
    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(process.env['APPDATA'] ?? home, 'aion-desktop', 'settings.json');
    }
    else if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'aion-desktop', 'settings.json');
    }
    else {
        const xdg = process.env['XDG_CONFIG_HOME'] ?? path.join(home, '.config');
        return path.join(xdg, 'aion-desktop', 'settings.json');
    }
}
/**
 * Merge bridgeUrl + pairingCode into Aion Desktop's settings file.
 * Preserves all other settings. Returns true on success, false if the file
 * can't be written (app not installed).
 */
function syncElectronSettings(bridgeUrl, pairingCode) {
    try {
        const settingsPath = getElectronSettingsPath();
        const existing = readJsonSafe(settingsPath);
        writeJsonSafe(settingsPath, { ...existing, bridgeUrl, pairingCode });
        return true;
    }
    catch {
        return false;
    }
}
