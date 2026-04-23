# Aion Bridge — Open

REST API, developer console, and CLI that wraps the Aion phone bridge and exposes your personal health data as standard HTTP endpoints.

**Your data never leaves your network.** This server runs on your PC and talks to the Aion app on your phone over local WiFi.

---

## What it does

The Aion app on your phone is a FHIR R4 knowledge graph — vitals, labs, medications, conditions, wearables, and more, synced from Apple HealthKit or Google Health Connect. This server bridges it to your PC:

```
Phone (FHIR bridge) ──wss://──▶ aion-open ──http://──▶ curl / browser / Jupyter / your code
```

- **Browser console** — open `http://localhost:3000` to browse, query, and export your health data with zero setup
- **REST API** — standard JSON over HTTP, works with any language
- **CLI** — query from the terminal
- **Code generator** — copy ready-to-run Python / JavaScript / curl snippets

---

## Quickstart

**Requires:** Node.js 18+, Aion app on your phone, both devices on the same WiFi.

```bash
git clone https://github.com/easpencer/aion-open
cd aion-open
npm install

# Replace with your phone's IP and the 6-digit code from Aion → Settings → Bridge
BRIDGE_URL=wss://192.168.1.42:8420 PAIRING_CODE=123456 npm start
```

Then open **http://localhost:3000** in any browser.

> **Finding your phone's IP and pairing code:** In the Aion app, go to Settings → Bridge → Start Bridge. The IP address and 6-digit pairing code are shown on that screen.

---

## REST API

All endpoints return JSON. The server connects to your phone bridge at startup if `BRIDGE_URL` and `PAIRING_CODE` are set, or you can connect via the browser console or `POST /api/connect`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/{type}` | Query FHIR resources. Params: `category`, `limit`, `start`, `end` |
| `GET` | `/api/{type}/{id}` | Get a single resource by ID |
| `POST` | `/api/analyze` | Ask a health question. Body: `{"question":"..."}` |
| `GET` | `/api/_export` | Export FHIR Bundle or CSV |
| `GET` | `/api/_metadata` | FHIR R4 CapabilityStatement |
| `GET` | `/api/_graph` | Knowledge graph: nodes, edges, communities |
| `GET` | `/api/_graph/report` | Structured health summary for LLM context |
| `GET` | `/api/_audit` | Bridge audit log |
| `POST` | `/api/connect` | Connect to phone bridge |
| `GET` | `/api/status` | Connection status |

**Supported resource types:** `Observation`, `Condition`, `MedicationRequest`, `AllergyIntolerance`, `Immunization`, `Procedure`, `Encounter`, `DiagnosticReport`, `ClinicalImpression`, `CarePlan`, `Patient`

### Examples

```bash
# Query vitals
curl "http://localhost:3000/api/Observation?category=vital-signs&limit=20"

# Query conditions
curl "http://localhost:3000/api/Condition"

# Get a single resource
curl "http://localhost:3000/api/Observation/obs-123"

# Ask your AI a health question (requires Ollama running locally)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "What are my blood pressure trends?"}'

# Export full FHIR bundle
curl "http://localhost:3000/api/_export?format=bundle" > my-health.json
```

```python
import requests

# Query vitals
resp = requests.get("http://localhost:3000/api/Observation",
                    params={"category": "vital-signs", "limit": 20})
for entry in resp.json().get("entry", []):
    r = entry["resource"]
    print(f"  {r['code']['text']}: {r.get('valueQuantity', {}).get('value')}")

# Ask a question
resp = requests.post("http://localhost:3000/api/analyze",
                     json={"question": "Summarize my recent vitals"})
print(resp.json().get("answer", ""))
```

---

## CLI

After `npm install`, the `aion-bridge` binary is available:

```bash
# Query resources
aion-bridge query Observation --category vital-signs --limit 20
aion-bridge query Condition
aion-bridge query MedicationRequest

# Get a single resource
aion-bridge get Observation obs-123

# Ask a question
aion-bridge analyze "What are my BP trends?"

# Export
aion-bridge export --format bundle > health.json

# Knowledge graph
aion-bridge graph
aion-bridge graph report

# Status and audit
aion-bridge status
aion-bridge audit
```

The CLI talks to the server at `http://localhost:3000` by default. Override with `API_URL`:

```bash
API_URL=http://192.168.1.50:3000 aion-bridge query Observation
```

---

## MCP: Connect Claude, Cursor, Windsurf & more

To give an AI assistant direct access to your health data via the Model Context Protocol, use the standalone MCP server. It connects directly to your phone — no bridge server required.

```bash
npx aion-bridge-mcp setup
```

The setup wizard auto-discovers your phone, tests the connection, and configures all installed AI clients (Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, Zed) at once.

---

## Desktop Companion

The [Aion Desktop](https://github.com/easpencer/Aion/releases) tray app (Mac/Windows) captures your computer activity — screen time, meeting hours, app categories, typing intensity — and sends it to your health knowledge graph, anonymized and on-device.

Download from [GitHub Releases →](https://github.com/easpencer/Aion/releases)

---

## Security

- **TLS encrypted** — all bridge traffic uses WSS with a self-signed certificate
- **Pairing code authentication** — 6-digit code, rate-limited, rotates each session
- **LAN only** — the server binds to localhost; no external network exposure
- **HIPAA Safe Harbor de-identification** — a second de-id pass before transmission
- **Audit log** — every bridge request is logged and queryable

---

## Local AI with Ollama

The `/api/analyze` endpoint uses Ollama if it's running locally. Recommended models:

```bash
ollama pull llama4:scout      # 17B active (MoE), multimodal, 10M context — best overall
ollama pull qwen3:8b          # Best 8B for tool calling, ~5GB
ollama pull gemma3:4b         # Runs on CPU, no GPU needed
```

---

## Open Source

Source available at [github.com/easpencer/Aion](https://github.com/easpencer/Aion). Full open source release coming soon.
