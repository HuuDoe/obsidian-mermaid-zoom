# Mermaid Zoom

Pan, zoom, and navigate Mermaid diagrams in [Obsidian](https://obsidian.md) with a GitHub-style control panel — on both desktop and mobile.

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

## License

[MIT](LICENSE)
