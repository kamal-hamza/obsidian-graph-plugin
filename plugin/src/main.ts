import { Plugin, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { WasmLoader } from './wasm/loader';
import { ThemeManager } from './rendering/theme-manager';
import { Renderer2D } from './rendering/renderer-2d';
import { Renderer3D } from './rendering/renderer-3d';
import type { GraphConfig, MathEngineModule, Point, InterestingPoint, GraphResult } from './types';
import { DEFAULT_GRAPH_CONFIG } from './types';

export default class MathGraphPlugin extends Plugin {
	private wasmModule: MathEngineModule | null = null;
	private themeManager: ThemeManager;

	async onload() {
		console.log('Loading Math Graph Plugin...');

		// Initialize theme manager
		this.themeManager = ThemeManager.getInstance();
		this.themeManager.refreshColors();

		// Setup theme listener to refresh when theme changes
		this.themeManager.setupThemeListener(() => {
			console.log('Theme changed, colors refreshed');
		});

		try {
			// Initialize WASM module
			const loader = WasmLoader.getInstance();
			this.wasmModule = await loader.initialize();
			console.log('WASM module loaded successfully');

			// Register markdown code block processor for 'graph'
			this.registerMarkdownCodeBlockProcessor('graph', this.processGraphBlock.bind(this));

			new Notice('Math Graph Plugin loaded successfully');
		} catch (error) {
			console.error('Failed to load Math Graph Plugin:', error);
			new Notice('Failed to load Math Graph Plugin - check console for details');
		}
	}

	onunload() {
		console.log('Unloading Math Graph Plugin...');
	}

	/**
	 * Process a math-graph code block
	 */
	private async processGraphBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		// Parse the configuration from the code block
		const config = this.parseConfig(source);

		if (!config.equation) {
			this.renderError(el, 'No equation specified. Use: equation: <formula>');
			return;
		}

		// Create container for the graph
		const container = el.createDiv({ cls: 'math-graph-container' });
		container.style.margin = '10px 0';
		container.style.padding = '10px';
		container.style.backgroundColor = 'var(--background-secondary)';
		container.style.borderRadius = '4px';
		container.style.border = '1px solid var(--background-modifier-border)';

		// Add title if present
		if (config.equation) {
			const titleEl = container.createDiv({ cls: 'math-graph-title' });
			titleEl.style.marginBottom = '10px';
			titleEl.style.fontFamily = 'var(--font-monospace)';
			titleEl.style.fontSize = '14px';
			titleEl.style.color = 'var(--text-muted)';
			titleEl.textContent = `f(x${config.type === '3d' ? ', y' : ''}) = ${config.equation}`;
		}

		// Create graph container
		const graphContainer = container.createDiv({ cls: 'math-graph-content' });

		// Render based on type
		try {
			if (config.type === '2d') {
				await this.render2DGraph(graphContainer, config);
			} else if (config.type === '3d') {
				await this.render3DGraph(graphContainer, config);
			} else {
				this.renderError(graphContainer, `Unknown graph type: ${config.type}. Use '2d' or '3d'.`);
			}
		} catch (error) {
			console.error('Error rendering graph:', error);
			this.renderError(graphContainer, `Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Parse configuration from code block source
	 */
	private parseConfig(source: string): GraphConfig {
		const config: Partial<GraphConfig> = { ...DEFAULT_GRAPH_CONFIG };
		
		const lines = source.split('\n');
		
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const colonIndex = trimmed.indexOf(':');
			if (colonIndex === -1) continue;

			const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
			const value = trimmed.substring(colonIndex + 1).trim();

			switch (key) {
				case 'equation':
				case 'formula':
				case 'function':
					config.equation = value;
					break;
				case 'type':
					if (value === '2d' || value === '3d') {
						config.type = value;
					}
					break;
				case 'xmin':
				case 'x-min':
				case 'x_min':
					config.xMin = parseFloat(value);
					break;
				case 'xmax':
				case 'x-max':
				case 'x_max':
					config.xMax = parseFloat(value);
					break;
				case 'ymin':
				case 'y-min':
				case 'y_min':
					config.yMin = parseFloat(value);
					break;
				case 'ymax':
				case 'y-max':
				case 'y_max':
					config.yMax = parseFloat(value);
					break;
				case 'resolution':
				case 'res':
					config.resolution = parseInt(value, 10);
					break;
				case 'width':
					config.width = parseInt(value, 10);
					break;
				case 'height':
					config.height = parseInt(value, 10);
					break;
			}
		}

		// Default to 2d if not specified
		if (!config.type) {
			config.type = '2d';
		}

		return config as GraphConfig;
	}

	/**
	 * Render a 2D graph
	 */
	private async render2DGraph(container: HTMLElement, config: GraphConfig): Promise<void> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		// Call WASM calculate2D
		const wasmResult = this.wasmModule.calculate2D(
			config.equation,
			config.xMin ?? DEFAULT_GRAPH_CONFIG.xMin!,
			config.xMax ?? DEFAULT_GRAPH_CONFIG.xMax!,
			config.resolution ?? DEFAULT_GRAPH_CONFIG.resolution!
		);

		// Immediately convert Embind vectors to plain JavaScript arrays
		// This prevents memory issues from the WASM module cleaning up
		const pathSize = wasmResult.path.size();
		const pointsSize = wasmResult.points.size();
		
		const path: Point[] = [];
		for (let i = 0; i < pathSize; i++) {
			const p = wasmResult.path.get(i);
			path.push({ x: p.x, y: p.y, z: p.z });
		}
		
		const points: InterestingPoint[] = [];
		for (let i = 0; i < pointsSize; i++) {
			const p = wasmResult.points.get(i);
			points.push({
				location: { x: p.location.x, y: p.location.y, z: p.location.z },
				type: p.type,
				label: p.label
			});
		}

		// Create a plain JavaScript result object
		const result: GraphResult = {
			path: path as any, // Cast to satisfy type system
			points: points as any,
			success: wasmResult.success,
			errorMessage: wasmResult.errorMessage
		};

		// Debug: Log result details
		console.log('WASM 2D Result:', {
			success: result.success,
			errorMessage: result.errorMessage,
			pathSize: path.length,
			pointsSize: points.length,
			firstPoint: path.length > 0 ? path[0] : null,
			lastPoint: path.length > 0 ? path[path.length - 1] : null
		});

		// Create renderer and render
		const renderer = new Renderer2D(container);
		renderer.render(result, {
			width: config.width ?? DEFAULT_GRAPH_CONFIG.width!,
			height: config.height ?? DEFAULT_GRAPH_CONFIG.height!,
			showGrid: true,
			showLegend: false,
		});
	}

	/**
	 * Render a 3D graph
	 */
	private async render3DGraph(container: HTMLElement, config: GraphConfig): Promise<void> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		// Call WASM calculate3D
		const wasmResult = this.wasmModule.calculate3D(
			config.equation,
			config.xMin ?? DEFAULT_GRAPH_CONFIG.xMin!,
			config.xMax ?? DEFAULT_GRAPH_CONFIG.xMax!,
			config.yMin ?? DEFAULT_GRAPH_CONFIG.yMin!,
			config.yMax ?? DEFAULT_GRAPH_CONFIG.yMax!,
			config.resolution ?? DEFAULT_GRAPH_CONFIG.resolution!
		);

		// Immediately convert Embind vectors to plain JavaScript arrays
		// This prevents memory issues from the WASM module cleaning up
		const pathSize = wasmResult.path.size();
		const pointsSize = wasmResult.points.size();
		
		const path: Point[] = [];
		for (let i = 0; i < pathSize; i++) {
			const p = wasmResult.path.get(i);
			path.push({ x: p.x, y: p.y, z: p.z });
		}
		
		const points: InterestingPoint[] = [];
		for (let i = 0; i < pointsSize; i++) {
			const p = wasmResult.points.get(i);
			points.push({
				location: { x: p.location.x, y: p.location.y, z: p.location.z },
				type: p.type,
				label: p.label
			});
		}

		// Create a plain JavaScript result object
		const result: GraphResult = {
			path: path as any, // Cast to satisfy type system
			points: points as any,
			success: wasmResult.success,
			errorMessage: wasmResult.errorMessage
		};

		// Create renderer and render
		const renderer = new Renderer3D(container);
		renderer.render(result, {
			width: config.width ?? DEFAULT_GRAPH_CONFIG.width!,
			height: config.height ?? DEFAULT_GRAPH_CONFIG.height!,
			wireframe: false,
			showPoints: true,
			showAxes: true,
		}, config.resolution ?? DEFAULT_GRAPH_CONFIG.resolution!);
	}

	/**
	 * Render an error message
	 */
	private renderError(container: HTMLElement, message: string): void {
		const colors = this.themeManager.getColors();
		
		container.empty();
		
		const errorDiv = container.createDiv({ cls: 'math-graph-error' });
		errorDiv.style.padding = '15px';
		errorDiv.style.color = colors.textNormal;
		errorDiv.style.backgroundColor = colors.backgroundSecondary;
		errorDiv.style.border = `1px solid ${colors.borderColor}`;
		errorDiv.style.borderRadius = '4px';
		errorDiv.style.fontFamily = 'var(--font-monospace)';
		errorDiv.style.fontSize = '13px';
		
		const titleEl = errorDiv.createEl('div', {
			text: '⚠️ Error',
		});
		titleEl.style.fontWeight = 'bold';
		titleEl.style.marginBottom = '8px';
		titleEl.style.color = '#ef4444';
		
		errorDiv.createEl('div', {
			text: message,
		});
	}
}