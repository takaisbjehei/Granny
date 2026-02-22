import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, walls) {
        this.controls = new PointerLockControls(camera, domElement);
        this.walls = walls; // Array of meshes for collision

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.speed = 40.0;
        this.mass = 100.0;
        this.playerRadius = 1.0;

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Apply friction
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize(); // consistent speed in all directions

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * this.speed * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * this.speed * delta;

        // Store old position for collision recovery
        const oldPos = this.controls.getObject().position.clone();

        // Move X
        this.controls.moveRight(-this.velocity.x * delta);
        if (this.checkCollisions()) {
            this.controls.getObject().position.x = oldPos.x;
            this.velocity.x = 0;
        }

        // Move Z
        this.controls.moveForward(-this.velocity.z * delta);
        if (this.checkCollisions()) {
            this.controls.getObject().position.z = oldPos.z;
            this.velocity.z = 0;
        }
    }

    checkCollisions() {
        const pos = this.controls.getObject().position;
        // Simple AABB collision check. Assume player is at Y=5
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(pos.x, 5, pos.z),
            new THREE.Vector3(this.playerRadius * 2, 2, this.playerRadius * 2)
        );

        for (let i = 0; i < this.walls.length; i++) {
            const wallBox = new THREE.Box3().setFromObject(this.walls[i]);
            if (playerBox.intersectsBox(wallBox)) {
                return true;
            }
        }
        return false;
    }
}
