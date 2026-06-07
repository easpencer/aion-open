# Concept C — "The Eternal Ledger"

## Design thesis
Aion means an age of time, so the site is staged as the title page of a permanent record — an illuminated manuscript reissued for the year 3000, not a tech teaser. It withholds nearly everything and instead radiates gravitas: bone paper, inked rules, classical proportion, and a single deep-lapis jewel used like an illuminated initial. The promise ("a record of a life, kept private by physics") is delivered as inscription, so privacy reads as permanence and dignity rather than as a feature.

## Type choices (Google Fonts — a deliberate, named pairing)
- **Hero / display: Fraunces** — the load-bearing decision. A "soft-serif" with old-style optical sizing and high stroke contrast; set at `opsz 144`, weight 300, it carries antiquarian warmth and reads as engraved type rather than UI. Used for the wordmark "Aion," the door labels, and recto numerals.
- **Body / structural: Spectral** — a calm, screen-native book serif for the frontispiece note, ledger eyebrow ("VOL. MMXXVI · OF TIME"), and footer small-caps.
- **Marginalia: Newsreader (italic)** — a literary italic reserved for caption-like glosses and the subtitle, so secondary lines feel hand-noted in the margin.

## Color tokens
| Token | Hex | Role |
|---|---|---|
| `--paper` | `#F4F0E6` | luminous off-white / bone ground |
| `--paper-2` | `#EDE7D8` | deeper leaf (hover wash) |
| `--paper-edge` | `#E2DAC6` | hairline ledger rules |
| `--grey` | `#C9C0AC` | warm grey |
| `--sepia` | `#5B5346` | soft ink — captions, footer |
| `--ink` | `#1A1714` | ink — primary text |
| `--jewel` | `#1E3A5F` | the single accent: deep lapis/sapphire |
| `--jewel-lit` | `#274C77` | brighter inscription blue |
| `--gild` | `#9A7B3F` | restrained manuscript gold — hairline gutter only, ≤12% opacity |

Deliberately the LIGHT counterpoint. No emerald, no purple-on-white, no gradients-as-decoration. The only "color" event is the jewel; the only metal is a faint gild rule down the gutter.

## Motion idea — "the inscription forms, then settles"
On load the page composes itself like type being set: the four glyphs of **Aion** rise from a half-line below with a brief blur (per-glyph stagger), the eyebrow rules draw outward from the title, the frontispiece note and doors fade up in sequence, and a hairline gild rule is slowly drawn down the gutter. Interaction is quiet and editorial: hovering a door floods a soft paper wash from the left, indents the label, turns it lapis, and extends its quill-rule arrow — a line being drawn across the page. Everything collapses to a fully composed, still page under `prefers-reduced-motion`.

## Stealth teaser extensions

**/app — the held breath.** Same leaf, same Fraunces title, but even quieter: a single centered line of Newsreader italic ("Your health, kept where it belongs.") under a small device-glyph, the tagline "Universal essential health — coming to Earth first" set as a folio eyebrow, and the dated colophon ("Arriving 2026 · iOS & Android · Free to start"). It SHOWS only mood, intent, and arrival; it WITHHOLDS all features, screenshots, pricing, and the Know/Think/Act story. One CTA: a "Request a leaf" email field styled as a ledger entry line (drawn underline, lapis on focus) — notify, not download.

**/core — the open door, pointed outward.** A near-mirror of the gateway recto for builders: the eyebrow reads "The Open Foundation," one Spectral paragraph naming only that Aion Core is a source-available FHIR graph + local bridge (CLI · REST · MCP-native), and a single monospace-ledger line `npx @aion-health/bridge setup` rendered as an inscription. It WITHHOLDS API docs, architecture, and repo contents. The one CTA is an outward link — "Read the full record at aion-open →" — the only door that leaves the manuscript, deliberately deferring to the fuller aion-open page going live later.
