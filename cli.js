#!/usr/bin/env node
/**
 * Aion Bridge CLI — Query your health data from the terminal.
 *
 * Usage:
 *   aion-bridge query Observation --category vital-signs --limit 20
 *   aion-bridge get Observation obs-123
 *   aion-bridge analyze "What are my BP trends?"
 *   aion-bridge export --format bundle > export.json
 *   aion-bridge metadata
 *   aion-bridge audit
 *   aion-bridge status
 *
 * Requires the Aion Bridge server running:
 *   BRIDGE_URL=wss://phone:8420 PAIRING_CODE=123456 npm start
 *
 * Then in another terminal:
 *   aion-bridge query Observation
 *
 * Or set API_URL to point to a remote server:
 *   API_URL=http://192.168.1.50:3000 aion-bridge query Observation
 */

const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const [,, cmd, ...args] = process.argv;

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`
  Aion Bridge CLI

  Commands:
    query <Type> [--category x] [--limit n]   Query FHIR resources
    get <Type> <id>                            Get a single resource
    analyze "<question>"                       Ask a health question
    export [--format bundle|csv] [--type x]    Export data
    graph                                      Health knowledge graph summary
    graph report                               Full HEALTH_REPORT.md
    metadata                                   FHIR CapabilityStatement
    audit [--limit n]                          View audit log
    status                                     Check connection status
    connect <url> <code>                       Connect to bridge

  Environment:
    API_URL   Server URL (default: http://localhost:3000)

  Examples:
    aion-bridge query Observation --category vital-signs
    aion-bridge get Observation obs-hr-001
    aion-bridge analyze "Should I be concerned about my blood pressure?"
    aion-bridge export --format csv --type Observation > vitals.csv
    `);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case 'status': {
        const r = await fetchJSON('/api/status');
        console.log(r.connected ? `Connected to ${r.bridgeUrl}` : `Not connected${r.error ? ': ' + r.error : ''}`);
        break;
      }
      case 'connect': {
        const [url, code] = args;
        if (!url || !code) { console.error('Usage: aion-bridge connect <url> <code>'); process.exit(1); }
        const r = await fetchJSON('/api/connect', { method: 'POST', body: { url, code } });
        console.log(r.connected ? 'Connected.' : 'Failed: ' + (r.error || 'unknown'));
        break;
      }
      case 'query': {
        const type = args[0];
        if (!type) { console.error('Usage: aion-bridge query <ResourceType>'); process.exit(1); }
        const params = new URLSearchParams();
        for (let i = 1; i < args.length; i += 2) {
          if (!args[i]?.startsWith('--') || args[i + 1] === undefined) continue;
          const key = args[i].replace(/^--/, '');
          params.set(key, args[i + 1]);
        }
        const r = await fetchJSON(`/api/${type}?${params}`);
        if (r.error) { console.error('Error:', r.error); process.exit(1); }
        const entries = r.entry || [];
        console.log(`${entries.length} ${type} resources:\n`);
        for (const { resource } of entries) {
          const name = resource.code?.text || resource.medicationCodeableConcept?.text || resource.vaccineCode?.text || resource.resourceType;
          const val = resource.valueQuantity ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ''}` : '';
          const status = resource.clinicalStatus?.coding?.[0]?.code || resource.status || '';
          const date = resource.effectiveDateTime?.slice(0, 10) || resource.recordedDate?.slice(0, 10) || resource.authoredOn?.slice(0, 10) || '';
          console.log(`  ${name}${val ? ': ' + val : ''}${status ? ' [' + status + ']' : ''}${date ? '  (' + date + ')' : ''}`);
        }
        break;
      }
      case 'get': {
        const [type, id] = args;
        if (!type || !id) { console.error('Usage: aion-bridge get <Type> <id>'); process.exit(1); }
        const r = await fetchJSON(`/api/${type}/${id}`);
        if (r.error) { console.error('Error:', r.error || r.message || 'Unknown error'); process.exit(1); }
        console.log(JSON.stringify(r.resource || r, null, 2));
        break;
      }
      case 'analyze': {
        const question = args.join(' ');
        if (!question) { console.error('Usage: aion-bridge analyze "your question"'); process.exit(1); }
        console.log('Analyzing...\n');
        const r = await fetchJSON('/api/analyze', { method: 'POST', body: { question } });
        if (r.error) { console.error('Error:', r.error || r.message || 'Unknown error'); process.exit(1); }
        console.log(r.answer || 'No answer returned');
        break;
      }
      case 'export': {
        const params = new URLSearchParams();
        for (let i = 0; i < args.length; i += 2) {
          if (!args[i]?.startsWith('--') || args[i + 1] === undefined) continue;
          const key = args[i].replace(/^--/, '');
          if (key === 'type') params.set('resourceType', args[i + 1]);
          else params.set(key, args[i + 1]);
        }
        const r = await fetchJSON(`/api/_export?${params}`);
        if (r.error) { console.error('Error:', r.error || r.message || 'Unknown error'); process.exit(1); }
        if (r.format === 'csv') {
          console.log(r.data);
        } else {
          console.log(JSON.stringify(r.data || r, null, 2));
        }
        break;
      }
      case 'metadata': {
        const r = await fetchJSON('/api/_metadata');
        console.log('FHIR', r.fhirVersion, '—', r.rest?.[0]?.resource?.length || 0, 'resource types:\n');
        for (const res of r.rest?.[0]?.resource || []) {
          console.log(`  ${res.type}`);
        }
        break;
      }
      case 'graph': {
        const sub = args[0];
        if (sub === 'report') {
          const r = await fetchJSON('/api/_graph/report');
          if (typeof r === 'string') console.log(r);
          else if (r.report) console.log(r.report);
          else console.log(JSON.stringify(r, null, 2));
        } else {
          const r = await fetchJSON('/api/_graph');
          if (r.error) { console.error('Error:', r.error); process.exit(1); }
          console.log(`Health Knowledge Graph: ${r.stats?.nodeCount || 0} nodes, ${r.stats?.edgeCount || 0} edges, ${r.stats?.communityCount || 0} communities\n`);
          if (r.godNodes?.length) {
            console.log('Key Health Factors (God Nodes):');
            for (const g of r.godNodes) {
              console.log(`  ${g.label} (${g.connectionCount} connections, ${g.type})`);
            }
            console.log('');
          }
          if (r.communities?.length) {
            console.log('Health Clusters:');
            for (const c of r.communities.filter(c => c.nodeCount >= 2)) {
              console.log(`  ${c.label} (${c.nodeCount} entities, ${(c.cohesion * 100).toFixed(0)}% cohesion)`);
            }
            console.log('');
          }
          if (r.surprisingConnections?.length) {
            console.log('Surprising Connections:');
            for (const s of r.surprisingConnections) {
              console.log(`  ${s.sourceLabel} ↔ ${s.targetLabel} (${s.type}, ${(s.confidence * 100).toFixed(0)}%)`);
            }
          }
        }
        break;
      }
      case 'audit': {
        const idx = args.indexOf('--limit');
        const limit = (idx !== -1 && args[idx + 1]) ? args[idx + 1] : 20;
        const r = await fetchJSON(`/api/_audit?limit=${limit}`);
        if (r.error) { console.error('Error:', r.error || r.message || 'Unknown error'); process.exit(1); }
        console.log(`Audit log (${r.total} total):\n`);
        for (const e of r.entries || []) {
          console.log(`  ${e.timestamp?.slice(11, 19) || '?'} ${e.type.padEnd(10)} ${e.resourceType || ''}${e.resultCount != null ? ' → ' + e.resultCount : ''}${e.error ? ' ERROR: ' + e.error : ''}`);
        }
        break;
      }
      default:
        console.error(`Unknown command: ${cmd}. Run aion-bridge help for usage.`);
        process.exit(1);
    }
  } catch (e) {
    if (e.cause?.code === 'ECONNREFUSED') {
      console.error('Cannot reach the Aion Bridge server at ' + API);
      console.error('Start it first: BRIDGE_URL=wss://phone:8420 PAIRING_CODE=123456 npm start');
    } else {
      console.error('Error:', e.message);
    }
    process.exit(1);
  }
}

async function fetchJSON(path, opts = {}) {
  const url = API + path;
  const fetchOpts = {};
  if (opts.method) fetchOpts.method = opts.method;
  if (opts.body) {
    fetchOpts.headers = { 'Content-Type': 'application/json' };
    fetchOpts.body = JSON.stringify(opts.body);
  }
  const r = await fetch(url, fetchOpts);
  return r.json();
}

main();
