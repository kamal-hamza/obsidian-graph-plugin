import { ShaderMaterial, Color, DoubleSide } from 'three';

export interface ContourMaterialUniforms {
    uColor: { value: Color };
    uInterval: { value: number };
    uThickness: { value: number };
    uOpacity: { value: number };
}

export class ContourMaterial extends ShaderMaterial {
    constructor(parameters?: { color?: string, interval?: number, thickness?: number, opacity?: number }) {
        super({
            transparent: true,
            side: DoubleSide,
            uniforms: {
                uColor: { value: new Color(parameters?.color || '#ffffff') },
                uInterval: { value: parameters?.interval || 1.0 },
                uThickness: { value: parameters?.thickness || 0.05 },
                uOpacity: { value: parameters?.opacity || 0.8 },
            },
            vertexShader: `
                varying float vReferenceZ;
                attribute float vertexOriginalZ;

                void main() {
                    vReferenceZ = vertexOriginalZ;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uInterval;
                uniform float uThickness;
                uniform float uOpacity;
                varying float vReferenceZ;

                void main() {
                    // Normalize Z to be positive for modulo if needed, though simple mod works for negative too usually
                    // Use a slightly offset mod to center lines? 
                    // Let's keep it simple: if close to pure integer multiple of interval
                    
                    float r = abs(mod(vReferenceZ + (uThickness * 0.5), uInterval) - (uThickness * 0.5));
                    
                    // Simple hard cutoff
                    float halfThick = uThickness * 0.5;
                    
                    // Distance to nearest line center
                    float dist = abs(mod(vReferenceZ + (uInterval * 0.5), uInterval) - (uInterval * 0.5));
                    
                    if (dist > halfThick) {
                        discard;
                    }
                    
                    gl_FragColor = vec4(uColor, uOpacity);
                }
            `
        });
    }

    set color(hex: string) {
        this.uniforms.uColor.value.set(hex);
    }

    set interval(v: number) {
        this.uniforms.uInterval.value = v;
    }
}
