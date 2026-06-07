# Concept B — "The Living Signal"

A blank-slate rebrand for **Aion**, a Bionic Light Industries brand. Stealth/teaser system, three pages.

## Design thesis
Aion is not a hospital, a fitness app, or another clinical-blue dashboard — it is an intelligence that lives *with* a body and watches over it. So the site is built around a single breathing, pulsing form suspended in warm deep space: bioluminescent, intimate, a little numinous. Everything else recedes to near-silence — minimal copy, two quiet doors — so the felt sense of something *alive and private* carries the page.

## Type choices (Google Fonts)
- **Display — Fraunces** (`opsz 9..144`, weights 300/400, with italic). A humane "old-style" serif with real optical sizing; at display weight 300 it feels breathing and characterful rather than corporate. The italic on the word *alive* is the one humane flourish.
- **Body — Spline Sans** (300/400/500). A warm, quiet contemporary grotesque — deliberately *not* Inter/Space Grotesk. It sits low-key beneath Fraunces and carries eyebrows, labels, and the door microcopy.

Named pairing decision: **Fraunces (living serif) over Spline Sans (quiet grotesque)** — characterful warmth up top, calm utility below.

## Color tokens (hex)
| token | hex | role |
|---|---|---|
| `--void` | `#100b09` | deep umber-black base (warm, never blue) |
| `--void-2` | `#1a1210` | lifted warm shadow |
| `--bone` | `#f4e9dd` | warm bone — primary text |
| `--bone-dim` | `#c9b6a4` | dimmed bone — supporting copy |
| `--amber` | `#ffb37a` | living amber — primary glow / accent |
| `--ember` | `#ff8a5c` | ember accent |
| `--bloodwarm` | `#e8607a` | blood-warm rose — pulse / heartbeat peak |
| `--dawn` | `#ffd9a8` | dawn highlight — the breathing word |

Deliberately warm and organic (amber / bone / blood-warm / dawn) against umber-black — the antithesis of emerald-on-near-black and clinical blue.

## The motion idea
A generative `<canvas>` renders one organism: a warm radial core that **breathes** on a ~5.5s respiration cycle, ringed by concentric "membrane" rings that expand and contract; a sharp **heartbeat envelope** (~4.6s, systolic spike + dicrotic notch) brightens the nucleus and flushes the rose tones; ~46 **bioluminescent motes** drift in slow orbit; and a faint **respiration waveform** traces horizontally across the form like a signal across a body at rest. The heartbeat is echoed in the wordmark dot and the footer "live" indicator (CSS `beat`), so the whole page shares one pulse. Calm and alive, never flashy. Full `prefers-reduced-motion` path: a single static glowing frame, all entrance animations resolved to their final state, canvas loop never starts; animation also pauses on tab-hide for battery and stillness.

## How `/app` extends this system (STEALTH)
Same void, same organism, same type — but even quieter. The breathing form is enlarged and pushed behind a single line of Fraunces: *"Your whole health. In your hands. And nowhere else."* It **shows**: the Know/Think/Act story compressed into three one-word whispers that fade in on the pulse (Know · Think · Act), the "Private by physics" eyebrow, "Arriving 2026 · iOS & Android · Free to start." It **withholds**: no pricing, no feature list, no screenshots, no Chorus/FHIR detail. **One CTA:** a single email field — *"Be there when it wakes."* — that pulses once on focus. Back-to-gateway via the wordmark.

## How `/core` extends this system (STEALTH)
The organism is rendered colder and more skeletal — the same form drawn as a faint wireframe lattice (the "graph"), signaling the developer foundation beneath the living app. It **shows**: a terse line — *"The foundation is open."* — and exactly one monospaced, copy-on-click line of truth: `npx @aion-health/bridge setup`, plus the quiet descriptors "Source-available · Local bridge · MCP-native." It **withholds**: the full docs, API surface, architecture, license specifics. **One CTA:** a single understated link — *"Read the open page →"* — pointing out to the forthcoming **aion-open** page (the only door that leaves the stealth world). Monospace (e.g. *Spline Sans Mono* or system mono) is introduced here, and *only* here, to mark the builder context.
