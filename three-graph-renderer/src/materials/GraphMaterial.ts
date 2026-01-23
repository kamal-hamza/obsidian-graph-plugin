import { MeshStandardMaterial, Color, DoubleSide } from 'three';

export class GraphMaterial extends MeshStandardMaterial {
  constructor() {
    super({
      side: DoubleSide,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: false, // Smooth shading
    });

    // Custom Uniforms
    const userData = {
      uColorStart: { value: new Color(0x6055bc) }, // Start = Purple-ish (Deep)
      uColorEnd: { value: new Color(0xbdadff) },   // End = Light
      uMinZ: { value: -5.0 },
      uMaxZ: { value: 5.0 },
      uClipMin: { value: -Infinity },
      uClipMax: { value: Infinity }
    };

    // Inject custom shader logic into MeshStandardMaterial
    this.onBeforeCompile = (shader) => {
      // Add uniforms
      shader.uniforms.uColorStart = userData.uColorStart;
      shader.uniforms.uColorEnd = userData.uColorEnd;
      shader.uniforms.uMinZ = userData.uMinZ;
      shader.uniforms.uMaxZ = userData.uMaxZ;
      shader.uniforms.uClipMin = userData.uClipMin;
      shader.uniforms.uClipMax = userData.uClipMax;

      // Prepend varying declaration (to pass world Z height)
      shader.vertexShader = `
          varying float vWorldZ;
          ${shader.vertexShader}
        `;

      // Capture Z position in vertex shader
      // "include <begin_vertex>" is where position is calculated usually
      // But we want world position? Or object position?
      // object position.z is enough if mesh is at 0,0,0
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
            #include <begin_vertex>
            vWorldZ = position.z;
            `
      );

      // Inject color mixing in fragment shader
      shader.fragmentShader = `
          uniform vec3 uColorStart;
          uniform vec3 uColorEnd;
          uniform float uMinZ;
          uniform float uMaxZ;
          uniform float uClipMin;
          uniform float uClipMax;
          varying float vWorldZ;
          ${shader.fragmentShader}
        `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
            // Clipping
            if (vWorldZ < uClipMin || vWorldZ > uClipMax) discard;

            // Gradient Mix
            float t = (vWorldZ - uMinZ) / (uMaxZ - uMinZ);
            t = clamp(t, 0.0, 1.0);
            
            // Overwrite diffuse color
            diffuseColor = vec4(mix(uColorStart, uColorEnd, t), opacity);
            `
      );

      // Keep reference to update uniforms later
      this.userData.shader = shader;
    };

    // store for convenience access
    this.userData.uniforms = userData;
  }

  setColors(start: string, end: string) {
    this.userData.uniforms.uColorStart.value.set(start);
    this.userData.uniforms.uColorEnd.value.set(end);
    this.needsUpdate = true;
  }

  setZRange(min: number, max: number) {
    this.userData.uniforms.uMinZ.value = min;
    this.userData.uniforms.uMaxZ.value = max;
    this.needsUpdate = true;
  }

  setClipRange(min: number, max: number) {
    this.userData.uniforms.uClipMin.value = min;
    this.userData.uniforms.uClipMax.value = max;
    this.needsUpdate = true;
  }
}
