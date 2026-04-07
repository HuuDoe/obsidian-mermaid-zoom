'use strict';

var obsidian = require('obsidian');

// ── Default settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  scaleFactor:    1.08,  // multiplicative zoom step per click / scroll tick
  panStep:        40,    // px moved per arrow-button click
  restingOpacity: 0.25,  // panel opacity when not hovered (0–1)
};

// ── Settings tab ────────────────────────────────────────────────────────────
class MermaidZoomSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new obsidian.Setting(containerEl)
      .setName('Zoom step')
      .setDesc('Multiplier applied per zoom click or scroll tick. 1.08 = 8% per step.')
      .addSlider(slider => slider
        .setLimits(1.02, 1.5, 0.01)
        .setValue(this.plugin.settings.scaleFactor)
        .setDynamicTooltip()
        .onChange(async v => {
          this.plugin.settings.scaleFactor = v;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName('Pan step (px)')
      .setDesc('Pixels moved per arrow-button click.')
      .addSlider(slider => slider
        .setLimits(10, 200, 5)
        .setValue(this.plugin.settings.panStep)
        .setDynamicTooltip()
        .onChange(async v => {
          this.plugin.settings.panStep = v;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName('Panel resting opacity')
      .setDesc('Opacity of the control panel when the diagram is not hovered (0 = invisible, 1 = fully visible).')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(this.plugin.settings.restingOpacity)
        .setDynamicTooltip()
        .onChange(async v => {
          this.plugin.settings.restingOpacity = v;
          await this.plugin.saveSettings();
          // Live-update all existing panels without a reload
          document.querySelectorAll('.mz-panel').forEach(p => {
            p.style.setProperty('--mz-resting-opacity', String(v));
          });
        }));
  }
}

// ── Plugin ───────────────────────────────────────────────────────────────────
class MermaidZoomPlugin extends obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MermaidZoomSettingTab(this.app, this));

    // Process diagrams already in the DOM once the workspace is ready
    this.app.workspace.onLayoutReady(() => this._processAll());

    // Re-process whenever the user navigates to another note
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this._processAll())
    );

    // Catch lazy-rendered diagrams (callouts, embeds, Reading-view toggles)
    this._observer = new MutationObserver(() => this._processAll());
    this._observer.observe(document.body, { childList: true, subtree: true });

    // Post-processor: catches diagrams in newly opened / created notes
    this.registerMarkdownPostProcessor(el => {
      el.querySelectorAll('.mermaid').forEach(div => this._attachWhenReady(div));
    });
  }

  onunload() {
    this._observer?.disconnect();
    // Remove all injected wrappers and restore the original SVG positions
    document.querySelectorAll('.mz-wrapper').forEach(wrapper => {
      const svg = wrapper.querySelector('svg');
      const mermaidEl = wrapper.closest('.mermaid');
      if (svg && mermaidEl) mermaidEl.insertBefore(svg, wrapper);
      wrapper.remove();
    });
    document.querySelectorAll('.mermaid[data-mzoom]').forEach(el => {
      el.removeAttribute('data-mzoom');
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── Discovery ──────────────────────────────────────────────────────────────
  _processAll() {
    document.querySelectorAll('.mermaid:not([data-mzoom])').forEach(el => {
      this._attachWhenReady(el);
    });
  }

  /** Attach immediately if the SVG is present, otherwise wait for it. */
  _attachWhenReady(mermaidEl) {
    const svg = mermaidEl.querySelector('svg');
    if (svg) { this._attach(mermaidEl, svg); return; }

    // SVG not yet rendered — observe this specific element until it appears
    const obs = new MutationObserver(() => {
      const s = mermaidEl.querySelector('svg');
      if (s) { obs.disconnect(); this._attach(mermaidEl, s); }
    });
    obs.observe(mermaidEl, { childList: true, subtree: true });
  }

  // ── Attach controls to one diagram ─────────────────────────────────────────
  _attach(mermaidEl, svg) {
    if (mermaidEl.hasAttribute('data-mzoom')) return;
    mermaidEl.setAttribute('data-mzoom', '1');

    // ── DOM structure ────────────────────────────────────────────────────────
    const wrapper  = document.createElement('div');
    wrapper.className = 'mz-wrapper';
    const viewport = document.createElement('div');
    viewport.className = 'mz-viewport';

    mermaidEl.insertBefore(wrapper, svg);
    viewport.appendChild(svg);
    wrapper.appendChild(viewport);

    // Size wrapper to SVG's natural height so fit-to-view works immediately
    requestAnimationFrame(() => {
      const bb = svg.getBBox?.();
      const naturalH =
        bb?.height ||
        parseFloat(svg.getAttribute('height')) ||
        parseFloat(svg.style.height) ||
        0;
      if (naturalH > 0) wrapper.style.height = naturalH + 'px';
    });

    // ── Transform state ──────────────────────────────────────────────────────
    let scale = 1, tx = 0, ty = 0, locked = false;

    const { scaleFactor, panStep } = this.settings;
    const MIN_SCALE = 0.05, MAX_SCALE = 20;
    const clamp = s => Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);

    const applyTransform = () => {
      svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    };

    // ── Control panel ────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'mz-panel';
    panel.style.setProperty('--mz-resting-opacity', String(this.settings.restingOpacity));

    const mkBtn = (title, html, onClick) => {
      const b = document.createElement('button');
      b.className = 'mz-btn';
      b.setAttribute('aria-label', title);
      b.title = title;
      b.innerHTML = html;
      b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      return b;
    };

    const btnLock = mkBtn('Toggle pan lock', '🔓', () => {
      locked = !locked;
      btnLock.innerHTML = locked ? '🔒' : '🔓';
      btnLock.classList.toggle('mz-locked', locked);
      viewport.classList.toggle('mz-grab', locked);
    });

    [
      mkBtn('Zoom in',   '⊕', () => { scale = clamp(scale * scaleFactor); applyTransform(); }),
      mkBtn('Pan up',    '▲', () => { ty -= panStep;                       applyTransform(); }),
      mkBtn('Zoom out',  '⊖', () => { scale = clamp(scale / scaleFactor); applyTransform(); }),
      mkBtn('Pan left',  '◀', () => { tx -= panStep;                       applyTransform(); }),
      btnLock,
      mkBtn('Pan right', '▶', () => { tx += panStep;                       applyTransform(); }),
      mkBtn('Reset view','⌂', () => { scale = 1; tx = 0; ty = 0;           applyTransform(); }),
      mkBtn('Pan down',  '▼', () => { ty += panStep;                       applyTransform(); }),
      mkBtn('Fit to view','⤢', () => {
        const vw = viewport.clientWidth  || 400;
        const vh = viewport.clientHeight || 300;
        const bb = svg.getBBox?.();
        const sw = bb?.width  || parseFloat(svg.getAttribute('width'))  || vw;
        const sh = bb?.height || parseFloat(svg.getAttribute('height')) || vh;
        scale = Math.min(vw / sw, vh / sh) * 0.95;
        tx = 0; ty = 0;
        applyTransform();
      }),
    ].forEach(b => panel.appendChild(b));

    wrapper.appendChild(panel);

    // ── Mouse drag ───────────────────────────────────────────────────────────
    let dragging = false, dragStartX = 0, dragStartY = 0, txAtDrag = 0, tyAtDrag = 0;

    this.registerDomEvent(viewport, 'mousedown', e => {
      if (!locked) return;
      dragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      txAtDrag = tx; tyAtDrag = ty;
      e.preventDefault();
    });
    this.registerDomEvent(window, 'mousemove', e => {
      if (!dragging) return;
      tx = txAtDrag + (e.clientX - dragStartX);
      ty = tyAtDrag + (e.clientY - dragStartY);
      applyTransform();
    });
    this.registerDomEvent(window, 'mouseup', () => { dragging = false; });

    // ── Touch drag / pinch-to-zoom ───────────────────────────────────────────
    let touchStartX = 0, touchStartY = 0, txAtTouch = 0, tyAtTouch = 0;
    let lastPinchDist = null;

    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1 && locked) {
        touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
        txAtTouch = tx; tyAtTouch = ty;
      }
      if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && locked) {
        tx = txAtTouch + (e.touches[0].clientX - touchStartX);
        ty = tyAtTouch + (e.touches[0].clientY - touchStartY);
        applyTransform();
      }
      if (e.touches.length === 2 && lastPinchDist !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        scale = clamp(scale * (dist / lastPinchDist));
        lastPinchDist = dist;
        applyTransform();
        e.preventDefault();
      }
    }, { passive: false });

    viewport.addEventListener('touchend', () => { lastPinchDist = null; }, { passive: true });

    // ── Alt+Scroll to zoom ───────────────────────────────────────────────────
    viewport.addEventListener('wheel', e => {
      if (!e.altKey) return;
      e.preventDefault();
      scale = clamp(scale * (e.deltaY > 0 ? 1 / scaleFactor : scaleFactor));
      applyTransform();
    }, { passive: false });
  }
}

module.exports = MermaidZoomPlugin;
