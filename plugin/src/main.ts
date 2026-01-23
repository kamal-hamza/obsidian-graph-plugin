import { Plugin, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { WasmLoader } from './wasm/loader';
import { ThemeManager } from './rendering/theme-manager';
import { RendererThreeJS } from './rendering/renderer-threejs';
import { EquationAnalyzer } from './utils/equation-analyzer';
import type { GraphConfig, MathEngineModule, Point, InterestingPoint, GraphResult } from './types';

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
		const config = await this.parseConfig(source);

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
	 * Now supports simple syntax (just equation) and intelligent range detection
	 */
	private async parseConfig(source: string): Promise<GraphConfig> {
		const trimmed = source.trim();
		
		// Check if it's just a plain equation (no colons/YAML)
		const hasYamlSyntax = trimmed.includes(':');
		
		if (!hasYamlSyntax && trimmed.length > 0) {
			// Simple mode: just an equation
			return await this.parseSimpleEquation(trimmed);
		}
		
		// Complex mode: YAML-like syntax with optional overrides
		return await this.parseYamlConfig(source);
	}

	/**
	 * Parse simple equation format: just the equation text
	 * Uses intelligent analysis to determine everything
	 */
	private async parseSimpleEquation(equation: string): Promise<GraphConfig> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		console.log('Analyzing equation for intelligent defaults:', equation);
		
		// Analyze the equation to get smart recommendations
		const analysis = await EquationAnalyzer.analyzeEquation(
			equation,
			this.wasmModule
		);

		console.log('Analysis results:', {
			type: analysis.type,
			xRange: analysis.recommendedXRange,
			yRange: analysis.recommendedYRange,
			confidence: analysis.confidence,
			hasDiscontinuities: analysis.hasDiscontinuities,
			isConstant: analysis.isConstant
		});

		const config: GraphConfig = {
			equation,
			type: analysis.type,
			resolution: EquationAnalyzer.getSmartResolution(analysis.type),
			xMin: analysis.recommendedXRange[0],
			xMax: analysis.recommendedXRange[1],
			// Smart defaults based on type
			...(analysis.type === '2d' ? {
				width: 700,
				height: 500,
			} : {
				yMin: analysis.recommendedYRange![0],
				yMax: analysis.recommendedYRange![1],
				width: 700,
				height: 700,
			})
		};

		return this.validateConfig(config);
	}

	/**
	 * Parse YAML-like config with overrides
	 * Can optionally use intelligent analysis for unspecified ranges
	 */
	private async parseYamlConfig(source: string): Promise<GraphConfig> {
		const config: Partial<GraphConfig> = {};
		const lines = source.split('\n');
		
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const colonIndex = trimmed.indexOf(':');
			if (colonIndex === -1) {
				// If no colon and we don't have an equation yet, treat whole line as equation
				if (!config.equation) {
					config.equation = trimmed;
				}
				continue;
			}

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
		
		if (!config.equation) {
			throw new Error('No equation specified');
		}

		// Apply smart defaults for missing values
		return await this.applySmartDefaults(config);
	}

	/**
	 * Apply smart defaults based on graph type
	 * Uses intelligent analysis if ranges are not specified
	 */
	private async applySmartDefaults(config: Partial<GraphConfig>): Promise<GraphConfig> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		// Auto-infer type if not specified
		if (!config.type) {
			config.type = EquationAnalyzer.inferType(config.equation!);
		}

		const type = config.type;

		// If ranges are not specified, use intelligent analysis
		const needsAnalysis = 
			config.xMin === undefined || 
			config.xMax === undefined ||
			(type === '3d' && (config.yMin === undefined || config.yMax === undefined));

		if (needsAnalysis) {
			console.log('Running intelligent range analysis for partial config');
			const analysis = await EquationAnalyzer.analyzeEquation(
				config.equation!,
				this.wasmModule,
				type
			);

			config.xMin = config.xMin ?? analysis.recommendedXRange[0];
			config.xMax = config.xMax ?? analysis.recommendedXRange[1];

			if (type === '3d' && analysis.recommendedYRange) {
				config.yMin = config.yMin ?? analysis.recommendedYRange[0];
				config.yMax = config.yMax ?? analysis.recommendedYRange[1];
			}
		}

		// Apply remaining defaults
		const defaults: GraphConfig = {
			equation: config.equation!,
			type,
			resolution: config.resolution ?? EquationAnalyzer.getSmartResolution(type),
			xMin: config.xMin ?? (type === '2d' ? -10 : -5),
			xMax: config.xMax ?? (type === '2d' ? 10 : 5),
			width: config.width ?? 700,
			height: config.height ?? (type === '2d' ? 500 : 700),
		};

		// Add 3D-specific defaults
		if (type === '3d') {
			defaults.yMin = config.yMin ?? -5;
			defaults.yMax = config.yMax ?? 5;
		}

		return this.validateConfig(defaults);
	}

	/**
	 * Validate and cap resolution to prevent WASM memory errors
	 */
	private validateConfig(config: GraphConfig): GraphConfig {
		const MAX_2D_RESOLUTION = 1000;
		const MAX_3D_RESOLUTION = 100;  // 100x100 = 10,000 points max

		if (config.type === '2d' && config.resolution! > MAX_2D_RESOLUTION) {
			console.warn(`2D resolution ${config.resolution} exceeds maximum ${MAX_2D_RESOLUTION}, capping`);
			config.resolution = MAX_2D_RESOLUTION;
		}

		if (config.type === '3d' && config.resolution! > MAX_3D_RESOLUTION) {
			console.warn(`3D resolution ${config.resolution} exceeds maximum ${MAX_3D_RESOLUTION}, capping`);
			config.resolution = MAX_3D_RESOLUTION;
		}

		return config;
	}

	/**
	 * Render a 2D graph using unified Three.js renderer
	 */
	private async render2DGraph(container: HTMLElement, config: GraphConfig): Promise<void> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		// Call WASM calculate2D
		const wasmResult = this.wasmModule.calculate2D(
			config.equation,
			config.xMin ?? -10,
			config.xMax ?? 10,
			config.resolution ?? 400
		);

		// Immediately convert Embind vectors to plain JavaScript arrays
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
			path: path as any,
			points: points as any,
			success: wasmResult.success,
			errorMessage: wasmResult.errorMessage
		};

		// Create unified Three.js renderer with WASM for dynamic recalculation
		const renderer = new RendererThreeJS(container, this.wasmModule);
		renderer.render(result, {
			width: config.width ?? 700,
			height: config.height ?? 500,
			showGrid: true,
			showAxes: true,
			mode: '2d',
		}, config.equation);
	}

	/**
	 * Render a 3D graph using unified Three.js renderer
	 */
	private async render3DGraph(container: HTMLElement, config: GraphConfig): Promise<void> {
		if (!this.wasmModule) {
			throw new Error('WASM module not initialized');
		}

		// Call WASM calculate3D
		const wasmResult = this.wasmModule.calculate3D(
			config.equation,
			config.xMin ?? -5,
			config.xMax ?? 5,
			config.yMin ?? -5,
			config.yMax ?? 5,
			config.resolution ?? 50
		);

		// Immediately convert Embind vectors to plain JavaScript arrays
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
			path: path as any,
			points: points as any,
			success: wasmResult.success,
			errorMessage: wasmResult.errorMessage
		};

		// Create unified Three.js renderer
		const renderer = new RendererThreeJS(container, this.wasmModule);
		renderer.render(result, {
			width: config.width ?? 700,
			height: config.height ?? 700,
			showGrid: true,
			showAxes: true,
			wireframe: false,
			mode: '3d',
		}, config.equation);
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