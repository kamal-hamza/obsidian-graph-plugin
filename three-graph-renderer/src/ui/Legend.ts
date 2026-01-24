
export class Legend {
    private container: HTMLElement;
    private list: HTMLElement;
    private callbacks: { onToggle: (id: string, visible: boolean) => void } = { onToggle: () => { } };

    constructor() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.zIndex = '1000';
        this.container.style.maxHeight = '300px';
        this.container.style.overflowY = 'auto';

        const title = document.createElement('div');
        title.innerText = 'Traces';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        this.container.appendChild(title);

        this.list = document.createElement('div');
        this.container.appendChild(this.list);
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public setCallback(onToggle: (id: string, visible: boolean) => void) {
        this.callbacks.onToggle = onToggle;
    }

    public addTrace(id: string, color: string) {
        // Check if exists
        if (this.list.querySelector(`[data-id="${id}"]`)) return;

        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '5px';
        item.style.cursor = 'pointer';
        item.dataset.id = id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.style.marginRight = '5px';

        checkbox.addEventListener('change', (e) => {
            this.callbacks.onToggle(id, (e.target as HTMLInputElement).checked);
        });

        const label = document.createElement('span');
        label.innerText = id;
        label.style.color = color;

        item.appendChild(checkbox);
        item.appendChild(label);

        // Allow clicking the text/row to toggle
        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            this.callbacks.onToggle(id, checkbox.checked);
        });

        this.list.appendChild(item);
    }

    public removeTrace(id: string) {
        const item = this.list.querySelector(`[data-id="${id}"]`);
        if (item) {
            this.list.removeChild(item);
        }
    }

    public clear() {
        this.list.innerHTML = '';
    }
}
