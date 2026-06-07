# Concept A — "THE INSTRUMENT"

## Design thesis
Aion is presented as an exquisitely made scientific apparatus, not a software product. Every element behaves like the engraved bezel, calibration ruler, and standby LED of a precision instrument that has just been switched on — restraint is the luxury signal, and negative space is the hero. The stealth site is a *held breath*: it withholds almost everything, says only what is true and confident, and lets the build quality of the object do the talking.

## Type choices (Google Fonts)
- **Archivo Expanded** (700 / 600) — the wordmark and section names. A drafted, technical grotesque whose expanded widths read as engraved/etched metal when paired with a dark-fill + light-edge gradient and a fine drop-shadow. Distinctive without being trendy.
- **Archivo** (400 / 500) — body and the "held breath" line. Same family as the display = one cohesive instrument voice; quiet, neutral, legible.
- **IBM Plex Mono** (400 / 500) — every data-readout: maker's plate, serial/reg number, status, indices, actuator labels, ruler legend. The literal lineage of instrument-panel type; characterful and defensible, and *not* a generic mono.

A two-family system (Archivo + Plex Mono) deliberately keeps the palette of voices small — appropriate for an instrument, where consistency reads as build quality.

## Color tokens (exact hex)
| Token | Hex | Role |
|---|---|---|
| `--void` | `#08090B` | unlit panel / page ground |
| `--panel` | `#0C0E11` | faint raised surface (doors) |
| `--etch` | `#15181D` | engraved groove / hover state |
| `--ink` | `#ECEEF1` | primary etched light (text, wordmark top) |
| `--ink-dim` | `#8A9099` | secondary readout |
| `--ink-faint` | `#4A4F57` | tertiary / calibration micro-text |
| `--led` | **`#2B45FF`** | **the single accent — ultramarine ink / calibration LED** |
| `--led-glow` | `rgba(43,69,255,0.55)` | bloom + LED halo |

**The accent decision:** one color, *ultramarine ink* `#2B45FF` — a deep electric blue-violet that reads simultaneously as drafting-ink on a blueprint and as a power-on indicator LED. It is deliberately **not** the emerald `#10b981` of the old system: blue carries instrument/measurement/trust semantics rather than the generic SaaS "health green," and on near-black it glows like a single calibrated diode rather than a brand wash. It appears in perhaps 1% of the surface: the standby LED, the scanning hairline tip, and the actuator dot on hover. Scarcity is the point.

## The motion idea
A single **power-on sequence**, mechanical and damped — never whimsical:
1. A faint ultramarine **bloom** rises behind the mark (the instrument warming up).
2. The wordmark **etches in** letter-by-letter, rising a fraction of an em into place (engraving being cut).
3. A hairline **scan rule** fades in beneath the mark; an ultramarine sweep traces it on a long, eased loop (a sensor pass / calibration scan).
4. Copy, the two doors, and the bottom ruler legend reveal in measured staggered steps.
After load, the only ongoing motion is the slow LED pulse, the periodic scan sweep, and a **heavily-damped pointer-tracking bloom** (0.045 lerp) so the panel subtly "attends" to the operator. A complete `prefers-reduced-motion` path freezes everything to the finished state and disables pointer tracking and the sweep.

## Stealth teaser extensions

**`/app` — VERY stealthy.** Inherits the identity exactly: same bezel, LED, ruler, engraved wordmark, ultramarine. It drops the two-door split and centers on a single oversized statement framed like an instrument readout — e.g. *"Know. Think. Act."* set in Archivo Expanded with each word on its own calibration line, plus one quiet Plex Mono undertitle (*"Your health, on your phone. Nothing leaves."*). It **shows** the three-beat product cadence as pure rhythm and the "arriving 2026 · iOS · Android" plate; it **withholds** all features, screenshots, pricing, and the Chorus/FHIR mechanics. The one CTA: a single mono actuator — **"Request access →"** (email capture styled as a serial-number field), nothing more.

**`/core` — stealthy teaser that points outward.** Same enclosure, but the readout shifts to a developer register: a single monospaced command line presented like an instrument prompt — `npx @aion-health/bridge setup` — with a blinking caret, framed by the engraved "Aion Core" mark and a one-line breath (*"An open foundation. FHIR graph, local bridge. Source-available."*). It **shows** only the command and the promise; it **withholds** docs, API surface, repo dumps, and architecture. The one CTA is a quiet outbound door — **"Read the full brief → aion-open"** — the single link that leads to the fuller aion-open page going live later. Everything else stays dark.
