import { BufferGeometry, BufferAttribute, Mesh, Float32BufferAttribute } from 'three';
import { GraphMaterial } from '../materials/GraphMaterial';

export class GraphGeometry {
    public mesh: Mesh;
    private geometry: BufferGeometry;
    private material: GraphMaterial;
    private currentResolution: number = 0;

    constructor() {
        this.geometry = new BufferGeometry();
        this.material = new GraphMaterial();

        // Initialize with empty buffer
        const positions = new Float32Array(3);
        this.geometry.setAttribute('position', new BufferAttribute(positions, 3));

        // Use Mesh instead of Points
        this.mesh = new Mesh(this.geometry, this.material);

        // Frustum culling can be tricky with dynamic shaders displacement, 
        // but here geometry is real.
        this.mesh.frustumCulled = false; // Always render to be safe/lazy for now
    }

    public updateData(data: Float32Array, resolution: number) {
        // 1. Update Positions
        this.geometry.setAttribute('position', new BufferAttribute(data, 3));

        // 2. Update Indices if resolution changed (GRID TOPOLOGY)
        // The C++ engine returns a grid of size (resolution+1) * (resolution+1)
        if (this.currentResolution !== resolution) {
            this.updateIndices(resolution);
            this.currentResolution = resolution;
        }

        // 3. Compute Normals for Lighting
        this.geometry.computeVertexNormals();

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeBoundingSphere();
    }

    private updateIndices(resolution: number) {
        // Grid size is actually (res+1) x (res+1) points
        const size = resolution + 1;
        const indices: number[] = [];

        // Loop through quads
        // i is x-axis (outer loop in C++), j is y-axis (inner loop)
        // C++:
        // for i in 0..res:
        //   for j in 0..res:
        //      index = i * size + j

        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const a = i * size + j;
                const b = i * size + (j + 1);
                const c = (i + 1) * size + j;
                const d = (i + 1) * size + (j + 1);

                // Two triangles: a-b-d and a-d-c? 
                // Need to check winding order for normals (CCW vs CW)
                // Standard is usually CCW (Counter Clockwise)

                // Triangle 1: a -> b -> d
                indices.push(a, b, d);

                // Triangle 2: a -> d -> c
                indices.push(a, d, c); // or c, d, b? No, let's try this.
            }
        }

        this.geometry.setIndex(indices);
    }

    public getObject() {
        return this.mesh;
    }

    public getMaterial() {
        return this.material;
    }
}
