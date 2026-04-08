# Mermaid Zoom

Fix oversized, unreadable, or overflowing Mermaid diagrams in [Obsidian](https://obsidian.md). Mermaid Zoom wraps every diagram in an interactive viewer with zoom, pan, drag, and resize — so large flowcharts, sequence diagrams, and entity-relationship diagrams stay readable at any scale, on desktop and mobile.

---

## Features

- **Zoom in / out** — buttons or `Alt`+Scroll
- **Pan** — arrow buttons, or drag when pan-lock is active (🔒)
- **Fit to view** — scales the diagram to fill the current container
- **Reset** — snaps back to 1:1 scale at the origin
- **Pinch-to-zoom** — native touch gesture on mobile / tablet
- **Resizable container** — drag the corner to resize the diagram box (width and height)
- **Configurable** — zoom step, pan step, and panel opacity via Settings
- **Clean unload** — disabling the plugin fully restores the original diagram DOM

---

## Control panel

The panel fades in when you hover over a diagram (always visible on touch screens).

| Button | Action |
|--------|--------|
| `⊕` | Zoom in |
| `⊖` | Zoom out |
| `▲ ▼ ◀ ▶` | Pan in that direction |
| `🔓` / `🔒` | Toggle pan-lock — when locked, drag the diagram to pan |
| `⌂` | Reset to original scale and position |
| `⤢` | Fit diagram to the container |
| `Alt`+Scroll | Zoom with the mouse wheel (no conflict with Obsidian shortcuts) |
| Pinch | Pinch-to-zoom on touch screens |

---

## Installation

### Manual

1. Go to the [latest release](https://github.com/HuuDoe/obsidian-mermaid-zoom/releases/latest) and download `main.js`, `styles.css`, and `manifest.json`.
2. Copy all three files into your vault at `.obsidian/plugins/mermaid-zoom/`.
3. In Obsidian: **Settings → Community plugins** → enable **Mermaid Zoom**.

### Via BRAT (beta testing)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Open BRAT settings → **Add Beta Plugin**.
3. Enter: `HuuDoe/obsidian-mermaid-zoom`

---

## Settings

Open **Settings → Mermaid Zoom** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Zoom step | `1.08` | Multiplier per click or scroll tick (1.08 = 8% per step) |
| Pan step | `40 px` | Pixels moved per arrow-button click |
| Panel resting opacity | `0.25` | Opacity when diagram is not hovered (0 = hidden, 1 = always visible) |

---

## Development

**Requirements:** Node.js ≥ 18

```bash
git clone https://github.com/HuuDoe/obsidian-mermaid-zoom
cd obsidian-mermaid-zoom
npm install

# Watch mode (rebuilds on every save)
npm run dev

# Production build
npm run build
```

To test in Obsidian, copy `main.js`, `styles.css`, and `manifest.json` into your vault's `.obsidian/plugins/mermaid-zoom/` folder and reload the app.

### Releasing a new version

1. Run `npm version patch` (or `minor` / `major`) — automatically bumps `manifest.json` and `versions.json`.
2. Push the tag: `git push --follow-tags`
3. Create a GitHub Release for that tag and attach `main.js`, `styles.css`, and `manifest.json` as binary assets.

---

## Changelog

### v1.1.1 — 2026-04-08
- **Settings:** added Reset to defaults button
- **Mobile:** fixed swipe-to-open-sidebar triggering while panning a diagram
- **Mobile:** fixed two-finger pinch triggering browser back/forward navigation
- **Mobile:** eliminated touch drag lag via `touch-action: none`

### v1.1.0 — 2026-04-08
- **Persist container height** per diagram — saved to `data.json`, restored on note reopen
- **Cursor-anchored zoom** — Alt+Scroll and pinch-to-zoom keep the point under the cursor stationary
- **Lucide lock icons** — drag-toggle uses Obsidian's native `lock-open` / `lock` icons
- **Mermaid color theming** — node, cluster, edge, and label colours overridden to match active Obsidian theme
- **Edge label background** patched via `mermaid.initialize()` to match `--background-secondary`
- **Auto-size (⊡)** — sets both width (capped at note column) and height from SVG viewBox
- **Fit to view (⤡)** — scales to fill available width, shrinks container height to eliminate blank gaps
- **Drag-to-pan on by default** — pan lock starts active; button toggles it off
- **SVG locked to natural pixel dimensions** — resizing the wrapper no longer rescales the chart

### v1.0.0 — initial release
- Zoom, pan, drag, pinch-to-zoom, fit, reset
- Resizable container with corner handle
- Configurable zoom step, pan step, panel opacity
- Desktop and mobile support

---

## License

[MIT](LICENSE)
