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
export interface DiscoveryResult {
    url: string;
    ip: string;
    port: number;
    method: 'mdns' | 'arp' | 'tcp-scan';
}
/**
 * Discover the Aion bridge on the local network.
 * Tries Bonjour → ARP cache → TCP subnet scan, returning on first hit.
 */
export declare function discoverBridge(onProgress?: (msg: string) => void): Promise<DiscoveryResult | null>;
