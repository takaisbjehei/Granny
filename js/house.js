import * as THREE from 'three';

export class House {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];

        this.buildHouse();
    }

    buildHouse() {
        // Dark, dingy colors
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.9 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x47433c, roughness: 1.0 });
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x3d0c0c, roughness: 0.5 }); // Bloody exit door

        // Floor
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Ceiling
        const ceilGeo = new THREE.PlaneGeometry(100, 100);
        const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 10;
        this.scene.add(ceiling);

        // Helper to create walls
        const createWall = (w, h, d, x, y, z, mat = wallMat) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.walls.push(mesh);
            return mesh;
        };

        // Outer boundaries
        createWall(100, 10, 1, 0, 5, -50);
        createWall(100, 10, 1, 0, 5, 50);
        createWall(1, 10, 100, -50, 5, 0);
        createWall(1, 10, 100, 50, 5, 0);

        // Inner walls (making a small maze/rooms)
        // Bedroom (spawn is at 0, 5, 0)
        // Let's create a room around spawn
        createWall(20, 10, 1, -10, 5, -20);
        createWall(1, 10, 15, -20, 5, -12.5);

        // Long hallway
        createWall(1, 10, 30, -10, 5, 15);
        createWall(50, 10, 1, 15, 5, 15);

        // Random obstacles to break up line of sight
        createWall(5, 10, 5, 20, 5, -20);
        createWall(3, 10, 3, -30, 5, 30);
        createWall(10, 10, 2, 0, 5, 35);

        // Setup Exit Door (win condition)
        this.exitDoor = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 1), doorMat);
        this.exitDoor.position.set(0, 5, -49); // On the back wall
        this.scene.add(this.exitDoor);
        // Do not add exitDoor to this.walls so player can walk into it
    }

    checkWinCondition(playerPosition) {
        const exitBox = new THREE.Box3().setFromObject(this.exitDoor);
        exitBox.expandByScalar(1); // expand hit box slightly
        if (exitBox.containsPoint(new THREE.Vector3(playerPosition.x, 5, playerPosition.z))) {
            return true;
        }
        return false;
    }
}
