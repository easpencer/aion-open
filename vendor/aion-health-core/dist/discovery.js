"use strict";
/**
 * Bridge auto-discovery — finds the Aion phone app on the local network.
 *
 * Strategy (in order, fastest to slowest):
 *   1. mDNS/Bonjour via dns-sd subprocess (macOS, ~3.5s)
 *   2. ARP cache probe — checks recently seen hosts instantly, no scan needed
 *   3. TCP port scan of local subnet(s) + adjacent /24s (all platforms, ~5-15s)
 *
 * The ARP cache phase handles the common case where the phone and Mac are
 * on different /24 subnets of the same network (e.g. Mac on 10.x.0.x,
 * phone on 10.x.1.x) which the subnet scan alone would miss.
 *
 * @module @aion-health/core/discovery
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
exports.discoverBridge = discoverBridge;
const child_process_1 = require("child_process");
const net = __importStar(require("net"));
const os = __importStar(require("os"));
const protocol_1 = require("./protocol");
const SCAN_BATCH = 40;
const PROBE_TIMEOUT_MS = 800;
const MDNS_TIMEOUT_MS = 3500;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Reject addresses that are syntactically an IPv4 but not actually reachable:
 * the unspecified/bind-all `0.0.0.0`, loopback `127.x`, broadcast `*.255`, and
 * empty. The phone's native bridge can advertise its listen address as
 * `0.0.0.0` over Bonjour (seen on USB / tethered setups); without this guard
 * the mDNS phase returns `0.0.0.0`, the client tries `wss://0.0.0.0:8420`, and
 * every connect fails with a misleading "same WiFi?" error instead of falling
 * through to the ARP / TCP-scan phases that can find the real address.
 */
function isUsableIPv4(ip) {
    if (!ip)
        return false;
    if (ip === '0.0.0.0' || ip.startsWith('127.') || ip.endsWith('.255'))
        return false;
    // basic shape check (four 0-255 octets)
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m)
        return false;
    return m.slice(1).every((o) => Number(o) <= 255);
}
function probePort(ip) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timer = setTimeout(() => { socket.destroy(); resolve(null); }, PROBE_TIMEOUT_MS);
        socket.connect(protocol_1.BRIDGE_PORT, ip, () => { clearTimeout(timer); socket.destroy(); resolve(ip); });
        socket.on('error', () => { clearTimeout(timer); resolve(null); });
    });
}
/**
 * Return subnets to scan — the host's own /24(s) plus adjacent /24 blocks
 * within the same /16. This catches phones on a different /24 of the same
 * network (common in enterprise/managed WiFi: Mac on x.x.0.x, phone on x.x.1.x).
 */
function getLocalSubnets() {
    const ifaces = os.networkInterfaces();
    const subnets = new Set();
    for (const addrs of Object.values(ifaces)) {
        for (const addr of addrs ?? []) {
            if (addr.family !== 'IPv4' || addr.internal || addr.address.startsWith('127.'))
                continue;
            const parts = addr.address.split('.');
            const third = parseInt(parts[2], 10);
            const prefix = `${parts[0]}.${parts[1]}`;
            // Own /24
            subnets.add(`${prefix}.${third}`);
            // Adjacent /24s within the same /16 (±3 either side)
            for (let d = -3; d <= 3; d++) {
                const oct = third + d;
                if (oct >= 0 && oct <= 255)
                    subnets.add(`${prefix}.${oct}`);
            }
        }
    }
    return [...subnets];
}
// ---------------------------------------------------------------------------
// Phase 1: mDNS (macOS only via dns-sd)
// ---------------------------------------------------------------------------
function discoverViaMDNS() {
    if (process.platform !== 'darwin')
        return Promise.resolve(null);
    return new Promise((resolve) => {
        let finished = false;
        const finish = (val) => {
            if (!finished) {
                finished = true;
                resolve(val);
            }
        };
        const browse = (0, child_process_1.spawn)('dns-sd', ['-B', protocol_1.BRIDGE_SERVICE, 'local.']);
        let instanceName = null;
        let buf = '';
        const browseTimer = setTimeout(() => { browse.kill(); finish(null); }, MDNS_TIMEOUT_MS);
        browse.stdout.on('data', (chunk) => {
            // Guard: if finish() already called (e.g. by browseTimer), discard buffered
            // output to prevent spawning a lookup subprocess that would never be cleaned up.
            if (finished)
                return;
            buf += chunk.toString();
            for (const line of buf.split('\n')) {
                if (!line.includes('Add') || !line.includes(protocol_1.BRIDGE_SERVICE) || instanceName)
                    continue;
                const m = line.match(/_aion-fhir\._tcp\.?\s+(.+)/);
                if (!m)
                    continue;
                instanceName = m[1].trim();
                clearTimeout(browseTimer);
                browse.kill();
                // Resolve instance → hostname:port
                const lookup = (0, child_process_1.spawn)('dns-sd', ['-L', instanceName, protocol_1.BRIDGE_SERVICE, 'local.']);
                const lt = setTimeout(() => { lookup.kill(); finish(null); }, 3000);
                let lbuf = '';
                lookup.stdout.on('data', (c) => {
                    // Guard: if finish() already called by lt timeout, don't spawn resolve4.
                    if (finished)
                        return;
                    lbuf += c.toString();
                    const m2 = lbuf.match(/can be reached at\s+([\w.-]+\.local\.?)\s*:\s*(\d+)/i)
                        || lbuf.match(/Add\s+\d+\s+\d+\s+([\w.-]+\.local\.?)\s+(\d+)/);
                    if (!m2)
                        return;
                    const hostname = m2[1].replace(/\.$/, '');
                    const port = parseInt(m2[2], 10);
                    lookup.kill();
                    clearTimeout(lt);
                    // Resolve .local hostname → IPv4
                    const resolve4 = (0, child_process_1.spawn)('dns-sd', ['-G', 'v4', hostname.endsWith('.') ? hostname : hostname + '.']);
                    const rt = setTimeout(() => { resolve4.kill(); finish(null); }, 3000);
                    let rbuf = '';
                    resolve4.stdout.on('data', (c) => {
                        rbuf += c.toString();
                        const m3 = rbuf.match(/Add\s+\d+\s+\d+\s+[\w.-]+\s+([\d.]+)/);
                        if (!m3)
                            return;
                        // The phone may advertise 0.0.0.0 (bind-all) over Bonjour — that's not
                        // a reachable address. Reject it and let discovery fall through to the
                        // ARP cache / TCP-scan phases rather than returning a dead URL.
                        if (!isUsableIPv4(m3[1])) {
                            resolve4.kill();
                            clearTimeout(rt);
                            finish(null);
                            return;
                        }
                        resolve4.kill();
                        clearTimeout(rt);
                        finish({ url: `wss://${m3[1]}:${port}`, ip: m3[1], port, method: 'mdns' });
                    });
                    resolve4.on('error', () => { clearTimeout(rt); finish(null); });
                });
                lookup.on('error', () => { clearTimeout(lt); finish(null); });
                break;
            }
        });
        browse.on('error', () => { clearTimeout(browseTimer); finish(null); });
    });
}
// ---------------------------------------------------------------------------
// Phase 2: ARP cache (all platforms — instant, no network scan)
// ---------------------------------------------------------------------------
// The ARP cache contains every host the machine has recently talked to on the
// LAN. Probing these is near-instant and crucially finds hosts on different
// /24 subnets that the scan might miss.
async function discoverViaARPCache(onProgress) {
    try {
        const output = (0, child_process_1.execSync)('arp -a', { encoding: 'utf8', timeout: 3000 });
        // Parse IPs from ARP output — format: "? (10.0.0.1) at ..."
        const ips = [...output.matchAll(/\((\d+\.\d+\.\d+\.\d+)\)/g)]
            .map(m => m[1])
            .filter(ip => !ip.endsWith('.255') && !ip.startsWith('127.') && ip !== '0.0.0.0');
        if (ips.length === 0)
            return null;
        onProgress?.(`Checking ${ips.length} known network hosts...`);
        const results = await Promise.all(ips.map(ip => probePort(ip)));
        const found = results.find(r => r !== null) ?? null;
        if (found)
            return { url: `wss://${found}:${protocol_1.BRIDGE_PORT}`, ip: found, port: protocol_1.BRIDGE_PORT, method: 'arp' };
    }
    catch {
        // arp not available or timed out — fall through to TCP scan
    }
    return null;
}
// ---------------------------------------------------------------------------
// Phase 3: TCP subnet scan (all platforms)
// ---------------------------------------------------------------------------
async function discoverViaTCPScan(onProgress) {
    const subnets = getLocalSubnets();
    if (subnets.length === 0)
        return null;
    for (const subnet of subnets) {
        for (let base = 1; base <= 254; base += SCAN_BATCH) {
            const ips = [];
            for (let i = base; i < base + SCAN_BATCH && i <= 254; i++)
                ips.push(`${subnet}.${i}`);
            onProgress?.(`Scanning ${subnet}.${base}–${Math.min(base + SCAN_BATCH - 1, 254)}...`);
            const results = await Promise.all(ips.map(ip => probePort(ip)));
            const ip = results.find(r => r !== null) ?? null;
            if (ip)
                return { url: `wss://${ip}:${protocol_1.BRIDGE_PORT}`, ip, port: protocol_1.BRIDGE_PORT, method: 'tcp-scan' };
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Discover the Aion bridge on the local network.
 * Tries Bonjour → ARP cache → TCP subnet scan, returning on first hit.
 */
async function discoverBridge(onProgress) {
    onProgress?.('Searching via Bonjour...');
    const mdns = await discoverViaMDNS();
    if (mdns) {
        onProgress?.(`Found via Bonjour: ${mdns.ip}`);
        return mdns;
    }
    onProgress?.('Checking known network hosts...');
    const arp = await discoverViaARPCache(onProgress);
    if (arp) {
        onProgress?.(`Found via ARP cache: ${arp.ip}`);
        return arp;
    }
    onProgress?.('Scanning local network...');
    const tcp = await discoverViaTCPScan(onProgress);
    if (tcp) {
        onProgress?.(`Found via scan: ${tcp.ip}`);
        return tcp;
    }
    return null;
}
