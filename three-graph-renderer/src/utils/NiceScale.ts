export class NiceScale {
    private minPoint: number;
    private maxPoint: number;
    private maxTicks: number = 10;
    private tickSpacing: number = 0;
    private range: number = 0;
    private niceMin: number = 0;
    private niceMax: number = 0;

    constructor(min: number, max: number) {
        this.minPoint = min;
        this.maxPoint = max;
        this.calculate();
    }

    private calculate() {
        this.range = this.niceNum(this.maxPoint - this.minPoint, false);
        this.tickSpacing = this.niceNum(this.range / (this.maxTicks - 1), true);
        this.niceMin = Math.floor(this.minPoint / this.tickSpacing) * this.tickSpacing;
        this.niceMax = Math.ceil(this.maxPoint / this.tickSpacing) * this.tickSpacing;
    }

    private niceNum(range: number, round: boolean): number {
        const exponent = Math.floor(Math.log10(range));
        const fraction = range / Math.pow(10, exponent);
        let niceFraction: number;

        if (round) {
            if (fraction < 1.5) niceFraction = 1;
            else if (fraction < 3) niceFraction = 2;
            else if (fraction < 7) niceFraction = 5;
            else niceFraction = 10;
        } else {
            if (fraction <= 1) niceFraction = 1;
            else if (fraction <= 2) niceFraction = 2;
            else if (fraction <= 5) niceFraction = 5;
            else niceFraction = 10;
        }

        return niceFraction * Math.pow(10, exponent);
    }

    public setMaxTicks(maxTicks: number) {
        this.maxTicks = maxTicks;
        this.calculate();
    }

    public getNiceMin(): number {
        return this.niceMin;
    }

    public getNiceMax(): number {
        return this.niceMax;
    }

    public getTickSpacing(): number {
        return this.tickSpacing;
    }

    public getTicks(): number[] {
        const ticks: number[] = [];
        const start = this.niceMin;
        const end = this.niceMax;
        const step = this.tickSpacing;

        // Avoid infinite loop if step is 0 or invalid
        if (step <= 0) return [start, end];

        for (let x = start; x <= end + step * 0.1; x += step) {
            let val = x;
            if (Math.abs(val) < 1e-10) val = 0;
            ticks.push(val);
        }
        return ticks;
    }
}
