import { BufferGeometry, BufferAttribute, Mesh } from 'three';
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

                // Triangle 1: a -> b -> d (CCW)
                indices.push(a, b, d);

                // Triangle 2: d -> c -> a (CCW) is correct for forming a quad with a-b-d?
                // Quad: a-b-d-c? No, vertices are:
                // a (i,j)      b (i,j+1)
                // c (i+1,j)    d (i+1,j+1)
                //
                // Standard Quad split (0,1,2) (2,1,3) usually.
                // a=0, b=1, c=2, d=3 ? No layout is row-major?
                // b is (j+1) which is next col, so right.
                // c is next row, so down.
                //
                // a -- b
                // |  / |
                // | /  |
                // c -- d
                //
                // Tri 1: a, c, b (CCW for front face pointing "out") or a, b, c?
                // Standard OpenGL/WebGL CCW:
                // a->c->b (top-left, bot-left, top-right)
                // b->c->d (top-right, bot-left, bot-right)
                //
                // Wait, user's input code was:
                // indices.push(a, b, d);
                // indices.push(d, c, a);
                //
                // Let's re-verify user's indexing:
                // a(i,j), b(i, j+1), c(i+1, j), d(i+1, j+1)
                // a (TL), b (TR), c (BL), d (BR) (Assuming Y goes down? No, grid i,j usually X,Y)
                // If i=x, j=y:
                // a(0,0), b(0,1), c(1,0), d(1,1)
                //
                // If Z is up, looking down:
                // a(0,0)  b(0,1)
                // c(1,0)  d(1,1)
                // (Assuming X right, Y up in grid index space)
                // No, usually:
                // i (row) -> y?
                // Let's stick to the user's specific logic suggestion: "Triangle 1: a, b, d. Triangle 2: d, c, a"
                indices.push(a, b, d);
                indices.push(d, c, a);
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
