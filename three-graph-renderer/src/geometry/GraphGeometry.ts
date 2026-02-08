import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { GraphMaterial } from '../materials/GraphMaterial';
import { ContourMaterial } from '../materials/ContourMaterial';

export class GraphGeometry {
    public mesh: Mesh;
    public wireframeMesh: Mesh;
    public contourMesh: Mesh;

    private geometry: BufferGeometry;
    private contourGeometry: BufferGeometry;

    private material: GraphMaterial;
    private contourMaterial: ContourMaterial;

    private currentResolution: number = 0;
    private floorZ: number = -5; // Default

    constructor() {
        // --- Main Surface ---
        this.geometry = new BufferGeometry();
        this.material = new GraphMaterial();

        const positions = new Float32Array(3);
        this.geometry.setAttribute('position', new BufferAttribute(positions, 3));

        this.mesh = new Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;

        const wireframeMat = new MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.1,
            wireframe: true
        });
        this.wireframeMesh = new Mesh(this.geometry, wireframeMat);
        this.mesh.add(this.wireframeMesh); // Add as child so it moves with the main mesh

        // --- Contour Surface (Floor) ---
        this.contourGeometry = new BufferGeometry();
        this.contourMaterial = new ContourMaterial({
            color: '#aaaaaa',
            opacity: 0.5,
            thickness: 0.1,
            interval: 1.0
        });

        const contourPositions = new Float32Array(3);
        const contourOriginalZ = new Float32Array(3);

        this.contourGeometry.setAttribute('position', new BufferAttribute(contourPositions, 3));
        this.contourGeometry.setAttribute('vertexOriginalZ', new BufferAttribute(contourOriginalZ, 1));

        this.contourMesh = new Mesh(this.contourGeometry, this.contourMaterial);
        this.contourMesh.frustumCulled = false;

        // Ensure contour renders on top of floor grid or appropriately
        this.contourMesh.renderOrder = 1;
    }

    public updateData(data: Float32Array, resolution: number) {
        const vertexCount = data.length / 3;

        // 1. Update Main Surface
        this.geometry.setAttribute('position', new BufferAttribute(data, 3));

        // 2. Update Contour Surface
        // We need flat positions (z = floorZ) but same x,y
        // We also need to extract z for attribute

        const flatPositions = new Float32Array(data.length);
        const originalZ = new Float32Array(vertexCount);

        for (let i = 0; i < vertexCount; i++) {
            const x = data[i * 3];
            const y = data[i * 3 + 1];
            const z = data[i * 3 + 2];

            flatPositions[i * 3] = x;
            flatPositions[i * 3 + 1] = y;
            // FIX: Add a tiny offset (0.01) to lift the lines above the floor grid
            flatPositions[i * 3 + 2] = this.floorZ + 0.01;

            originalZ[i] = z;
        }

        this.contourGeometry.setAttribute('position', new BufferAttribute(flatPositions, 3));
        this.contourGeometry.setAttribute('vertexOriginalZ', new BufferAttribute(originalZ, 1));

        // 3. Update Indices - LOD OPTIMIZATION
        if (this.currentResolution !== resolution) {
            this.updateIndices(resolution);
            this.currentResolution = resolution;

            // This ensures Three.js re-uploads the index buffer to the GPU
            if (this.geometry.index) this.geometry.index.needsUpdate = true;
            if (this.contourGeometry.index) this.contourGeometry.index.needsUpdate = true;
        }

        // 4. Compute Normals and Bounding Volumes
        this.geometry.computeVertexNormals();
        
        // Crucial: Tell Three.js the object's bounds have changed so it doesn't get culled erroneously
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();

        // FIX: Calculate bounding volumes for the contour geometry so it isn't culled
        this.contourGeometry.computeBoundingBox();
        this.contourGeometry.computeBoundingSphere();

        this.geometry.attributes.position.needsUpdate = true;
        this.contourGeometry.attributes.position.needsUpdate = true;
        this.contourGeometry.attributes.vertexOriginalZ.needsUpdate = true;
    }

    private updateIndices(resolution: number) {
        const size = resolution + 1;
        const indices: number[] = [];

        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const a = i * size + j;
                const b = i * size + (j + 1);
                const c = (i + 1) * size + j;
                const d = (i + 1) * size + (j + 1);

                indices.push(a, b, d);
                indices.push(d, c, a);
            }
        }

        this.geometry.setIndex(indices);
        this.contourGeometry.setIndex(indices); // Same topology
    }

    public setFloorLevel(z: number) {
        this.floorZ = z;
        // If we have data, we should update positions?
        // Ideally updateData is called every frame or we trigger a refresh.
        // For now, assume updateData calls handle it, or we iterate current pos.
        // Let's iterate current pos to be responsive without full recalculation.

        const posAttr = this.contourGeometry.attributes.position;
        if (posAttr) {
            const count = posAttr.count;
            for (let i = 0; i < count; i++) {
                posAttr.setZ(i, z);
            }
            posAttr.needsUpdate = true;
            
            // Recompute bounding volumes after floor level change
            this.contourGeometry.computeBoundingBox();
            this.contourGeometry.computeBoundingSphere();
        }
    }

    public getObject() {
        return this.mesh;
    }

    public getContourObject() {
        return this.contourMesh;
    }

    public getMaterial() {
        return this.material;
    }

    public setContourColor(color: string) {
        this.contourMaterial.color = color;
    }
}
