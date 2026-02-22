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

        // Helper to create planes (floors/ceilings)
        const createPlane = (w, h, x, y, z, rotX, mat) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = rotX;
            mesh.position.set(x, y, z);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        };

        // Helper to create walls (collidable)
        const createWall = (w, h, d, x, y, z, mat = wallMat) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            this.scene.add(mesh);
            this.walls.push(mesh);
            return mesh;
        };

        // --- Ground Floor (y=0 to y=10) ---
        createPlane(200, 200, 0, 0, 0, -Math.PI / 2, floorMat);
        createPlane(200, 200, 0, 10, 0, Math.PI / 2, ceilMat);

        // Ground Outer boundaries
        createWall(200, 10, 1, 0, 5, -100);
        createWall(200, 10, 1, 0, 5, 100);
        createWall(1, 10, 200, -100, 5, 0);
        createWall(1, 10, 200, 100, 5, 0);

        // Ground Inner rooms
        // Main Hall
        createWall(1, 10, 100, -30, 5, 0);
        createWall(1, 10, 100, 30, 5, 0);
        // Kitchen
        createWall(70, 10, 1, -65, 5, -20);
        // Living room
        createWall(70, 10, 1, 65, 5, 20);

        // --- Upper Floor (y=10 to y=20) ---
        createPlane(200, 200, 0, 10.1, 0, -Math.PI / 2, floorMat); // Upper floor
        createPlane(200, 200, 0, 20, 0, Math.PI / 2, ceilMat); // Upper ceiling

        // Upper Outer boundaries
        createWall(200, 10, 1, 0, 15, -100);
        createWall(200, 10, 1, 0, 15, 100);
        createWall(1, 10, 200, -100, 15, 0);
        createWall(1, 10, 200, 100, 15, 0);

        // Upper rooms (Bedrooms, Bathroom)
        createWall(50, 10, 1, -75, 15, 0);
        createWall(50, 10, 1, 75, 15, 0);
        createWall(1, 10, 50, -50, 15, -75);
        createWall(1, 10, 50, 50, 15, 75);

        // --- Basement (y=-10 to y=0) ---
        createPlane(200, 200, 0, -10, 0, -Math.PI / 2, floorMat);

        // Basement boundaries
        createWall(200, 10, 1, 0, -5, -100);
        createWall(200, 10, 1, 0, -5, 100);
        createWall(1, 10, 200, -100, -5, 0);
        createWall(1, 10, 200, 100, -5, 0);

        // Basement Maze Walls
        createWall(100, 10, 1, 0, -5, -30);
        createWall(100, 10, 1, 0, -5, 30);
        createWall(1, 10, 60, -50, -5, 0);
        createWall(1, 10, 60, 50, -5, 0);

        // --- Stairs (Ramps for simple AABB collision sliding) ---
        // Ground to Upper (Back of main hall)
        const rampUpGeo = new THREE.BoxGeometry(20, 1, 40);
        const rampUp = new THREE.Mesh(rampUpGeo, floorMat);
        rampUp.position.set(0, 5, -80);
        rampUp.rotation.x = Math.PI / 8; // Slanted
        this.scene.add(rampUp);
        this.walls.push(rampUp); // Add to colliders so player can walk up it

        // Ground to Basement (Front of main hall)
        const rampDownGeo = new THREE.BoxGeometry(20, 1, 40);
        const rampDown = new THREE.Mesh(rampDownGeo, floorMat);
        rampDown.position.set(0, -5, 80);
        rampDown.rotation.x = -Math.PI / 8;
        this.scene.add(rampDown);
        this.walls.push(rampDown);

        // Holes in floors for stairs
        // (Since we used giant planes for floors, we just assume player walks *through* the plane because collisions are only checked against `this.walls`. The visual clipping is acceptable for MVP, but to fix it we'd make the floors out of boxes instead of planes).

        this.setupExitDoor(doorMat);
        this.createItems();
    }

    setupExitDoor(doorMat) {
        // Main Container
        this.exitDoorGroup = new THREE.Group();
        this.exitDoorGroup.position.set(0, 5, 99);
        this.scene.add(this.exitDoorGroup);

        // The Door itself
        this.exitDoor = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2), doorMat);
        this.exitDoorGroup.add(this.exitDoor);

        // State Tracking (MVP uses local memory, real implementation uses Supabase game_state)
        this.doorState = {
            key: false,
            tool: false,
            code: false
        };

        this.locks = [];

        // Lock 1: Keyhole
        const createLock = (type, color, yPos, label) => {
            const mat = new THREE.MeshStandardMaterial({ color: color });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 3), mat);
            mesh.position.set(-2, yPos, 0);
            mesh.userData = {
                isLock: true,
                type: type, // 'key', 'tool', 'code'
                name: label
            };
            this.exitDoorGroup.add(mesh);
            this.locks.push(mesh);
            return mesh;
        };

        const keyLock = createLock('key', 0x0000ff, 2, 'Key Lock');
        const toolLock = createLock('tool', 0x888888, 0, 'Plank/Bolts');
        const codeLock = createLock('code', 0xffffff, -2, 'Code Pad');
    }

    unlock(lockType) {
        this.doorState[lockType] = true;
        // Visualize removal
        const lockMesh = this.locks.find(l => l.userData.type === lockType);
        if (lockMesh) {
            this.exitDoorGroup.remove(lockMesh);
            console.log("Unlocked: " + lockType);
        }
    }

    createItems() {
        this.interactables = [];

        // Define item types
        const itemDefs = [
            { type: 'key', name: 'Blue Key', color: 0x0000ff },
            { type: 'tool', name: 'Wrench', color: 0x888888 },
            { type: 'code', name: 'Code Note', color: 0xffffff }
        ];

        // Hardcoded spawn points for MVP
        const spawnPoints = [
            new THREE.Vector3(-10, 1, -20), // Bedroom
            new THREE.Vector3(-60, 1, -20),  // Kitchen
            new THREE.Vector3(60, 1, 20),  // Living Room
            new THREE.Vector3(-30, -9, 0)   // Basement
        ];

        // Shuffle arrays for random spawning
        itemDefs.sort(() => Math.random() - 0.5);
        spawnPoints.sort(() => Math.random() - 0.5);

        for (let i = 0; i < itemDefs.length; i++) {
            const def = itemDefs[i];
            const pos = spawnPoints[i];

            const createMesh = () => {
                const geo = new THREE.BoxGeometry(1, 1, 1);
                const mat = new THREE.MeshStandardMaterial({ color: def.color });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.userData = {
                    isItem: true,
                    type: def.type,
                    name: def.name,
                    color: def.color,
                    createMesh: createMesh
                };
                return mesh;
            };

            const mesh = createMesh();
            mesh.position.copy(pos);
            this.scene.add(mesh);
            this.interactables.push(mesh);
        }

        // Add locks to interactables
        this.locks.forEach(l => this.interactables.push(l));
    }

    checkWinCondition(playerPosition) {
        // Only trigger win if on the correct floor (Y between 0 and 10 roughly)
        if (playerPosition.y < 0 || playerPosition.y > 10) return false;

        // Ensure all locks are opened first
        if (!this.doorState.key || !this.doorState.tool || !this.doorState.code) {
            return false;
        }

        const exitBox = new THREE.Box3().setFromObject(this.exitDoor);
        exitBox.expandByScalar(2); // expand hit box slightly
        if (exitBox.containsPoint(playerPosition)) {
            return true;
        }
        return false;
    }
}
