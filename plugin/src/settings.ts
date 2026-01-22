// Settings file - placeholder for future settings functionality
// Currently the plugin works without custom settings

import { App, PluginSettingTab } from "obsidian";
import type MathGraphPlugin from "./main";

export interface MathGraphSettings {
	// Future settings can be added here
	defaultResolution: number;
	default2DWidth: number;
	default2DHeight: number;
	default3DWidth: number;
	default3DHeight: number;
}

export const DEFAULT_SETTINGS: MathGraphSettings = {
	defaultResolution: 100,
	default2DWidth: 600,
	default2DHeight: 400,
	default3DWidth: 600,
	default3DHeight: 500,
}

export class MathGraphSettingTab extends PluginSettingTab {
	plugin: MathGraphPlugin;

	constructor(app: App, plugin: MathGraphPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		containerEl.createEl('h2', { text: 'Math Graph Plugin Settings' });
		containerEl.createEl('p', { 
			text: 'This plugin works without configuration. Create math-graph code blocks in your notes to render graphs.' 
		});
		
		// Future settings UI can be added here
	}
}