import type { MathEngineModule } from '../types';

/**
 * Result of analyzing an equation's behavior
 */
export interface EquationAnalysis {
  variables: Set<string>;
  type: '2d' | '3d';
  recommendedXRange: [number, number];
  recommendedYRange?: [number, number];
  hasDiscontinuities: boolean;
  isConstant: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyzes equations to infer graph type and smart defaults
 */
export class EquationAnalyzer {
  /**
   * Detect which variables are used in an equation
   */
  static detectVariables(equation: string): Set<string> {
    const variables = new Set<string>();
    
    // Match standalone variable names (not part of function names)
    // Exclude common function names: sin, cos, tan, exp, log, ln, sqrt, abs, etc.
    const functionNames = /\b(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|log|log10|log2|ln|sqrt|cbrt|abs|floor|ceil|round|trunc|pow|min|max|pi|e|sign|fmod|hypot)\b/gi;
    
    // Remove function names first
    const cleanedEq = equation.replace(functionNames, '');
    
    // Look for single-letter variables (common: x, y, z, t, r, theta)
    const varPattern = /\b([a-z])\b/gi;
    const matches = cleanedEq.matchAll(varPattern);
    
    for (const match of matches) {
      if (match[1]) {
        const varName = match[1].toLowerCase();
        // Filter out common constants that might appear
        if (varName !== 'e') {  // 'e' is usually Euler's number
          variables.add(varName);
        }
      }
    }
    
    return variables;
  }
  
  /**
   * Infer graph type based on variables used
   */
  static inferType(equation: string): '2d' | '3d' {
    const vars = this.detectVariables(equation);
    
    // If it has both x and y, it's 3D
    if (vars.has('x') && vars.has('y')) {
      return '3d';
    }
    
    // Otherwise default to 2D
    return '2d';
  }
  
  /**
   * Get smart resolution based on graph type
   */
  static getSmartResolution(type: '2d' | '3d'): number {
    return type === '2d' ? 400 : 50;  // 50x50 = 2,500 points for 3D
  }
  
  /**
   * Analyze equation behavior and recommend ranges
   * This is the intelligent part that samples the function to find interesting regions
   */
  static async analyzeEquation(
    equation: string,
    wasmModule: MathEngineModule,
    type?: '2d' | '3d'
  ): Promise<EquationAnalysis> {
    const detectedType = type || this.inferType(equation);
    const variables = this.detectVariables(equation);
    
    if (detectedType === '2d') {
      return await this.analyze2D(equation, wasmModule, variables);
    } else {
      return await this.analyze3D(equation, wasmModule, variables);
    }
  }
  
  /**
   * Analyze 2D function behavior
   */
  private static async analyze2D(
    equation: string,
    wasmModule: MathEngineModule,
    variables: Set<string>
  ): Promise<EquationAnalysis> {
    // Initial scanning range - broad to catch most functions
    const scanRanges = [
      [-10, 10],    // Standard range
      [-5, 5],      // Tighter range
      [-20, 20],    // Broader range
      [-2, 2],      // Very tight for detailed functions
    ];
    
    let bestRange: [number, number] = [-10, 10];
    let bestScore = 0;
    let hasDiscontinuities = false;
    let isConstant = false;
    
    // Try different scanning ranges and pick the best
    for (const scanRange of scanRanges) {
      const xMin = scanRange[0]!;
      const xMax = scanRange[1]!;
      try {
        // Sample with coarse resolution for analysis
        const result = wasmModule.calculate2D(equation, xMin, xMax, 100);
        
        if (!result.success) {
          continue;
        }
        
        // Extract y values
        const yValues: number[] = [];
        const pathSize = result.path.size();
        
        for (let i = 0; i < pathSize; i++) {
          const point = result.path.get(i);
          const y = point.y;
          
          // Skip invalid values
          if (isFinite(y)) {
            yValues.push(y);
          }
        }
        
        if (yValues.length === 0) {
          continue;
        }
        
        // Analyze the values
        const stats = this.calculateStats(yValues);
        
        // Score this range based on:
        // 1. How many valid points we got
        // 2. Whether we have good variation (not constant)
        // 3. Whether values are reasonable (not too extreme)
        const validRatio = yValues.length / pathSize;
        const hasVariation = stats.stdDev > 0.001;
        const reasonableRange = Math.abs(stats.max - stats.min) < 10000;
        
        const score = validRatio * (hasVariation ? 2 : 0.5) * (reasonableRange ? 1.5 : 0.5);
        
        if (score > bestScore) {
          bestScore = score;
          bestRange = [xMin, xMax];
          isConstant = !hasVariation;
          
          // Detect discontinuities by checking for large jumps
          hasDiscontinuities = this.detectDiscontinuities(yValues);
          
          // Refine range based on where interesting values are
          const refinedRange = this.refineRange(result, xMin, xMax, stats);
          if (refinedRange) {
            bestRange = refinedRange;
          }
        }
      } catch (error) {
        // This range didn't work, try next
        continue;
      }
    }
    
    return {
      variables,
      type: '2d',
      recommendedXRange: bestRange,
      hasDiscontinuities,
      isConstant,
      confidence: bestScore > 1.5 ? 'high' : bestScore > 0.5 ? 'medium' : 'low',
    };
  }
  
  /**
   * Analyze 3D function behavior
   */
  private static async analyze3D(
    equation: string,
    wasmModule: MathEngineModule,
    variables: Set<string>
  ): Promise<EquationAnalysis> {
    // For 3D, we'll use a coarser analysis due to computational cost
    const scanRange: [number, number] = [-10, 10];
    let hasDiscontinuities = false;
    let isConstant = false;
    
    try {
      // Sample with very coarse resolution for analysis (20x20 = 400 points)
      const result = wasmModule.calculate3D(
        equation,
        scanRange[0],
        scanRange[1],
        scanRange[0],
        scanRange[1],
        20
      );
      
      if (!result.success) {
        // Fall back to default ranges
        return {
          variables,
          type: '3d',
          recommendedXRange: [-5, 5],
          recommendedYRange: [-5, 5],
          hasDiscontinuities: false,
          isConstant: false,
          confidence: 'low',
        };
      }
      
      // Extract z values and x/y coordinates
      const zValues: number[] = [];
      const xValues: number[] = [];
      const yValues: number[] = [];
      const pathSize = result.path.size();
      
      for (let i = 0; i < pathSize; i++) {
        const point = result.path.get(i);
        if (isFinite(point.z)) {
          zValues.push(point.z);
          xValues.push(point.x);
          yValues.push(point.y);
        }
      }
      
      if (zValues.length === 0) {
        return {
          variables,
          type: '3d',
          recommendedXRange: [-5, 5],
          recommendedYRange: [-5, 5],
          hasDiscontinuities: false,
          isConstant: false,
          confidence: 'low',
        };
      }
      
      // Analyze statistics
      const zStats = this.calculateStats(zValues);
      isConstant = zStats.stdDev < 0.001;
      hasDiscontinuities = this.detectDiscontinuities(zValues);
      
      // Find the interesting region by looking at where most valid points are
      const xRange = this.findInterestingRange(xValues, zValues);
      const yRange = this.findInterestingRange(yValues, zValues);
      
      return {
        variables,
        type: '3d',
        recommendedXRange: xRange,
        recommendedYRange: yRange,
        hasDiscontinuities,
        isConstant,
        confidence: 'medium',
      };
    } catch (error) {
      // Analysis failed, return conservative defaults
      return {
        variables,
        type: '3d',
        recommendedXRange: [-5, 5],
        recommendedYRange: [-5, 5],
        hasDiscontinuities: false,
        isConstant: false,
        confidence: 'low',
      };
    }
  }
  
  /**
   * Calculate statistical properties of a dataset
   */
  private static calculateStats(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    q25: number;
    q75: number;
  } {
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, q25: 0, q75: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const min = sorted[0]!;
    const max = sorted[n - 1]!;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 
      ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 
      : sorted[Math.floor(n / 2)]!;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    const q25 = sorted[Math.floor(n * 0.25)]!;
    const q75 = sorted[Math.floor(n * 0.75)]!;
    
    return { min, max, mean, median, stdDev, q25, q75 };
  }
  
  /**
   * Detect discontinuities by looking for large jumps in consecutive values
   */
  private static detectDiscontinuities(values: number[]): boolean {
    if (values.length < 2) return false;
    
    const stats = this.calculateStats(values);
    const threshold = stats.stdDev * 5; // Large jump = 5 std deviations
    
    for (let i = 1; i < values.length; i++) {
      const diff = Math.abs(values[i]! - values[i - 1]!);
      if (diff > threshold && diff > 10) {  // Also require absolute threshold
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Refine the x-range based on where interesting values are concentrated
   */
  private static refineRange(
    result: any,
    xMin: number,
    xMax: number,
    stats: any
  ): [number, number] | null {
    // Extract x values where y is in the "interesting" range
    // (within 3 std deviations of mean, or in the interquartile range)
    const interestingPoints: number[] = [];
    const pathSize = result.path.size();
    
    // Define interesting range for y values
    const yMin = stats.mean - 3 * stats.stdDev;
    const yMax = stats.mean + 3 * stats.stdDev;
    
    for (let i = 0; i < pathSize; i++) {
      const point = result.path.get(i);
      const x = point.x;
      const y = point.y;
      
      if (isFinite(y) && y >= yMin && y <= yMax) {
        interestingPoints.push(x);
      }
    }
    
    if (interestingPoints.length < 10) {
      return null; // Not enough data to refine
    }
    
    const xStats = this.calculateStats(interestingPoints);
    
    // Use interquartile range with some padding
    const padding = (xStats.q75 - xStats.q25) * 0.5;
    const refinedMin = Math.max(xMin, xStats.q25 - padding);
    const refinedMax = Math.min(xMax, xStats.q75 + padding);
    
    // Only use refined range if it's meaningfully different and reasonable
    const rangeRatio = (refinedMax - refinedMin) / (xMax - xMin);
    if (rangeRatio > 0.2 && rangeRatio < 0.9) {
      return [
        Math.round(refinedMin * 10) / 10,  // Round to 1 decimal
        Math.round(refinedMax * 10) / 10
      ];
    }
    
    return null;
  }
  
  /**
   * Find the interesting range for a coordinate based on where valid values exist
   */
  private static findInterestingRange(
    coordValues: number[],
    zValues: number[]
  ): [number, number] {
    if (coordValues.length === 0) {
      return [-5, 5];
    }
    
    // Find where we have the most valid data
    const stats = this.calculateStats(coordValues);
    
    // Use the middle 80% of the data (10th to 90th percentile)
    const sorted = [...coordValues].sort((a, b) => a - b);
    const n = sorted.length;
    const p10 = sorted[Math.floor(n * 0.1)]!;
    const p90 = sorted[Math.floor(n * 0.9)]!;
    
    // Add some padding
    const range = p90 - p10;
    const padding = range * 0.2;
    
    const min = Math.max(-20, Math.round((p10 - padding) * 10) / 10);
    const max = Math.min(20, Math.round((p90 + padding) * 10) / 10);
    
    // Ensure minimum range size
    if (max - min < 2) {
      const center = (max + min) / 2;
      return [center - 2, center + 2];
    }
    
    return [min, max];
  }
  
  /**
   * Quick type inference without full analysis
   */
  static quickInfer(equation: string): { type: '2d' | '3d'; resolution: number } {
    const type = this.inferType(equation);
    const resolution = this.getSmartResolution(type);
    return { type, resolution };
  }
}