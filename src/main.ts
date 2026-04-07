import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	setIcon,
} from 'obsidian';

// ── Settings ──────────────────────────────────────────────────────────────────

interface MermaidZoomSettings {
	scaleFactor: number;
	panStep: number;
	restingOpacity: number;
}

const DEFAULT_SETTINGS: MermaidZoomSettings = {
	scaleFactor:    1.08,
	panStep:        40,
	restingOpacity: 0.25,
};

// ── Settings tab ──────────────────────────────────────────────────────────────

class MermaidZoomSettingTab extends PluginSettingTab {
	plugin: MermaidZoomPlugin;

	constructor(app: App, plugin: MermaidZoomPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Zoom step')
			.setDesc('Multiplier applied per zoom click or scroll tick. 1.08 = 8% per step.')
			.addSlider(slider => slider
				.setLimits(1.02, 1.5, 0.01)
				.setValue(this.plugin.settings.scaleFactor)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.scaleFactor = v;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Pan step (px)')
			.setDesc('Pixels moved per arrow-button click.')
			.addSlider(slider => slider
				.setLimits(10, 200, 5)
				.setValue(this.plugin.settings.panStep)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.panStep = v;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Panel resting opacity')
			.setDesc('Opacity of the control panel when the diagram is not hovered (0 = invisible, 1 = always visible).')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.05)
				.setValue(this.plugin.settings.restingOpacity)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.restingOpacity = v;
					await this.plugin.saveSettings();
					// Live-update all existing panels without a reload
					document.querySelectorAll<HTMLElement>('.mz-panel').forEach(p => {
						p.style.setProperty('--mz-resting-opacity', String(v));
					});
				}));
	}
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class MermaidZoomPlugin extends Plugin {
	settings: MermaidZoomSettings;
	private _observer: MutationObserver | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MermaidZoomSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this._processAll());

		this.registerEvent(
			this.app.workspace.on('layout-change', () => this._processAll())
		);

		this._observer = new MutationObserver(() => this._processAll());
		this._observer.observe(document.body, { childList: true, subtree: true });

		this.registerMarkdownPostProcessor(el => {
			el.querySelectorAll<HTMLElement>('.mermaid').forEach(div => this._attachWhenReady(div));
		});
	}

	onunload() {
		this._observer?.disconnect();
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

	// ── Discovery ─────────────────────────────────────────────────────────────

	private _processAll() {
		document.querySelectorAll<HTMLElement>('.mermaid:not([data-mzoom])').forEach(el => {
			this._attachWhenReady(el);
		});
	}

	private _attachWhenReady(mermaidEl: HTMLElement) {
		const svg = mermaidEl.querySelector<SVGSVGElement>('svg');
		if (svg) { this._attach(mermaidEl, svg); return; }

		const obs = new MutationObserver(() => {
			const s = mermaidEl.querySelector<SVGSVGElement>('svg');
			if (s) { obs.disconnect(); this._attach(mermaidEl, s); }
		});
		obs.observe(mermaidEl, { childList: true, subtree: true });
	}

	// ── Attach controls to one diagram ────────────────────────────────────────

	private _attach(mermaidEl: HTMLElement, svg: SVGSVGElement) {
		if (mermaidEl.hasAttribute('data-mzoom')) return;
		mermaidEl.setAttribute('data-mzoom', '1');

		// ── DOM structure ────────────────────────────────────────────────────
		const wrapper  = document.createElement('div');
		wrapper.className = 'mz-wrapper';
		const viewport = document.createElement('div');
		viewport.className = 'mz-viewport';

		mermaidEl.insertBefore(wrapper, svg);
		viewport.appendChild(svg);
		wrapper.appendChild(viewport);

		// Returns the SVG's natural height in CSS pixels.
		// viewBox is the authoritative source — Mermaid always sets it to CSS-pixel dims.
		// Falls back to the height attribute, then the rendered bounding rect.
		const svgNaturalHeight = (): number => {
			const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
			if (vb && vb.length >= 4 && vb[3] > 0) return vb[3];
			const attrH = parseFloat(svg.getAttribute('height') ?? '');
			if (attrH > 0) return attrH;
			return svg.getBoundingClientRect().height;
		};

		// Size wrapper to the SVG's natural height on first render
		requestAnimationFrame(() => {
			const h = svgNaturalHeight();
			if (h > 0) wrapper.style.height = h + 'px';
		});

		// ── Transform state ──────────────────────────────────────────────────
		let scale = 1, tx = 0, ty = 0, locked = true;

		const { scaleFactor, panStep } = this.settings;
		const MIN_SCALE = 0.05, MAX_SCALE = 20;
		const clamp = (s: number) => Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);

		const applyTransform = () => {
			svg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
		};

		// ── Control panel ────────────────────────────────────────────────────
		const panel = document.createElement('div');
		panel.className = 'mz-panel';
		panel.style.setProperty('--mz-resting-opacity', String(this.settings.restingOpacity));

		const mkBtn = (title: string, html: string, onClick: () => void, extraClass?: string): HTMLButtonElement => {
			const b = document.createElement('button');
			b.className = 'mz-btn' + (extraClass ? ' ' + extraClass : '');
			b.setAttribute('aria-label', title);
			b.title = title;
			b.innerHTML = html;
			b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
			return b;
		};

		const btnLock = mkBtn('Toggle drag mode', '', () => {
			locked = !locked;
			setIcon(btnLock, locked ? 'lock-open' : 'lock');
			btnLock.classList.toggle('mz-locked', locked);
			viewport.classList.toggle('mz-grab', locked);
		});
		setIcon(btnLock, 'lock-open');
		btnLock.classList.add('mz-locked');
		requestAnimationFrame(() => viewport.classList.add('mz-grab'));

		const btnAutoSize = mkBtn('Auto-size container', '⊡', () => {
			scale = 1; tx = 0; ty = 0;
			applyTransform();
			requestAnimationFrame(() => {
				const h = svgNaturalHeight();
				if (h > 0) wrapper.style.height = h + 'px';
				wrapper.style.width = ''; // reset to CSS 100%
			});
		});

		[
			mkBtn('Zoom in',     '+',  () => { scale = clamp(scale * scaleFactor); applyTransform(); }),
			mkBtn('Pan up',      '↑',  () => { ty -= panStep;                       applyTransform(); }),
			mkBtn('Zoom out',    '−',  () => { scale = clamp(scale / scaleFactor); applyTransform(); }),
			mkBtn('Pan left',    '←',  () => { tx -= panStep;                       applyTransform(); }),
			btnLock,
			mkBtn('Pan right',   '→',  () => { tx += panStep;                       applyTransform(); }),
			btnAutoSize,
			mkBtn('Pan down',    '↓',  () => { ty += panStep;                       applyTransform(); }),
			mkBtn('Fit to view', '⤡',  () => {
				const vw = viewport.clientWidth  || 400;
				const vh = viewport.clientHeight || 300;
				const bb = svg.getBBox();
				const sw = bb.width  || parseFloat(svg.getAttribute('width')  ?? '') || vw;
				const sh = bb.height || parseFloat(svg.getAttribute('height') ?? '') || vh;
				scale = Math.min(vw / sw, vh / sh) * 0.95;
				tx = 0; ty = 0;
				applyTransform();
			}),
		].forEach(b => panel.appendChild(b));

		wrapper.appendChild(panel);

		// ── Mouse drag ───────────────────────────────────────────────────────
		let dragging = false, dragStartX = 0, dragStartY = 0, txAtDrag = 0, tyAtDrag = 0;

		viewport.addEventListener('mousedown', (e: MouseEvent) => {
			if (!locked) return;
			dragging = true;
			dragStartX = e.clientX; dragStartY = e.clientY;
			txAtDrag = tx; tyAtDrag = ty;
			e.preventDefault();
		});
		this.registerDomEvent(window, 'mousemove', (e: MouseEvent) => {
			if (!dragging) return;
			tx = txAtDrag + (e.clientX - dragStartX);
			ty = tyAtDrag + (e.clientY - dragStartY);
			applyTransform();
		});
		this.registerDomEvent(window, 'mouseup', () => { dragging = false; });

		// ── Touch drag / pinch-to-zoom (zoom anchored to pinch midpoint) ─────
		let touchStartX = 0, touchStartY = 0, txAtTouch = 0, tyAtTouch = 0;
		let lastPinchDist: number | null = null;
		let lastPinchMidX = 0, lastPinchMidY = 0;

		viewport.addEventListener('touchstart', (e: TouchEvent) => {
			if (e.touches.length === 1 && locked) {
				touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
				txAtTouch = tx; tyAtTouch = ty;
			}
			if (e.touches.length === 2) {
				const rect = viewport.getBoundingClientRect();
				lastPinchMidX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
				lastPinchMidY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
				lastPinchDist = Math.hypot(
					e.touches[0].clientX - e.touches[1].clientX,
					e.touches[0].clientY - e.touches[1].clientY
				);
			}
		}, { passive: true });

		viewport.addEventListener('touchmove', (e: TouchEvent) => {
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
				const ratio = dist / lastPinchDist;
				const newScale = clamp(scale * ratio);
				// Anchor zoom to pinch midpoint
				tx = lastPinchMidX - (lastPinchMidX - tx) * (newScale / scale);
				ty = lastPinchMidY - (lastPinchMidY - ty) * (newScale / scale);
				scale = newScale;
				lastPinchDist = dist;
				applyTransform();
				e.preventDefault();
			}
		}, { passive: false });

		viewport.addEventListener('touchend', () => { lastPinchDist = null; }, { passive: true });

		// ── Alt+Scroll to zoom (anchored to cursor position) ─────────────────
		viewport.addEventListener('wheel', (e: WheelEvent) => {
			if (!e.altKey) return;
			e.preventDefault();
			const rect = viewport.getBoundingClientRect();
			const cursorX = e.clientX - rect.left;
			const cursorY = e.clientY - rect.top;
			const newScale = clamp(scale * (e.deltaY > 0 ? 1 / scaleFactor : scaleFactor));
			// Anchor zoom to cursor: keep the point under the cursor stationary
			tx = cursorX - (cursorX - tx) * (newScale / scale);
			ty = cursorY - (cursorY - ty) * (newScale / scale);
			scale = newScale;
			applyTransform();
		}, { passive: false });
	}
}
