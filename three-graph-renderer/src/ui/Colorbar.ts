
export class Colorbar {
    private container: HTMLElement;
    private gradientBar: HTMLElement;
    private maxLabel: HTMLElement;
    private minLabel: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.bottom = '20px';
        this.container.style.right = '20px'; // Align with Legend roughly or bottom right
        this.container.style.width = '20px';
        this.container.style.height = '200px';
        this.container.style.backgroundColor = 'rgba(0,0,0,0.3)';
        this.container.style.border = '1px solid rgba(255,255,255,0.2)';
        this.container.style.zIndex = '1000';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';

        // Max Label (Top)
        this.maxLabel = document.createElement('div');
        this.maxLabel.style.position = 'absolute';
        this.maxLabel.style.right = '25px';
        this.maxLabel.style.top = '-10px';
        this.maxLabel.style.color = '#fff';
        this.maxLabel.style.fontSize = '12px';
        this.maxLabel.style.fontFamily = 'monospace';
        this.maxLabel.innerText = '5.0';
        this.container.appendChild(this.maxLabel);

        // Min Label (Bottom)
        this.minLabel = document.createElement('div');
        this.minLabel.style.position = 'absolute';
        this.minLabel.style.right = '25px';
        this.minLabel.style.bottom = '-10px';
        this.minLabel.style.color = '#fff';
        this.minLabel.style.fontSize = '12px';
        this.minLabel.style.fontFamily = 'monospace';
        this.minLabel.innerText = '-5.0';
        this.container.appendChild(this.minLabel);

        // Gradient
        this.gradientBar = document.createElement('div');
        this.gradientBar.style.width = '100%';
        this.gradientBar.style.height = '100%';
        this.container.appendChild(this.gradientBar);
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public updateColors(startColor: string, endColor: string) {
        // Vertical gradient from bottom (min) to top (max)
        this.gradientBar.style.background = `linear-gradient(to top, ${startColor}, ${endColor})`;
    }

    public updateBounds(zMin: number, zMax: number) {
        this.minLabel.innerText = zMin.toFixed(1);
        this.maxLabel.innerText = zMax.toFixed(1);
    }
}
