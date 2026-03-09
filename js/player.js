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

        // Inventory System
        this.inventory = [null, null, null];
        this.activeSlot = 0;
        this.interactionRadius = 5.0;
        this.raycaster = new THREE.Raycaster();
        this.interactables = []; // Set by main.js

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
            case 'Digit1':
                this.setActiveSlot(0);
                break;
            case 'Digit2':
                this.setActiveSlot(1);
                break;
            case 'Digit3':
                this.setActiveSlot(2);
                break;
            case 'KeyE':
                this.tryInteract();
                break;
            case 'KeyG':
                this.dropItem();
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
        // Run physics if locked (desktop) or if moving/looking on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!this.controls.isLocked && !isMobile) return;

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

        this.checkInteraction();
    }

    setInteractables(groups) {
        this.interactables = groups;
    }

    setActiveSlot(index) {
        this.activeSlot = index;
        // Update UI
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`slot-${i}`).classList.remove('active');
        }
        document.getElementById(`slot-${index + 1}`).classList.add('active');
    }

    checkInteraction() {
        const prompt = document.getElementById('interaction-prompt');
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.controls.camera);

        const intersects = this.raycaster.intersectObjects(this.interactables, true);

        if (intersects.length > 0 && intersects[0].distance < this.interactionRadius) {
            prompt.classList.remove('hidden');
            this.currentInteractable = intersects[0].object;
        } else {
            prompt.classList.add('hidden');
            this.currentInteractable = null;
        }
    }

    tryInteract() {
        if (!this.currentInteractable) return;

        const obj = this.currentInteractable;

        // Handle Item Pickup
        if (obj.userData.isItem) {
            // Find empty slot
            const idx = this.inventory.findIndex(i => i === null);
            if (idx !== -1) {
                this.inventory[idx] = obj.userData;
                this.updateInventoryUI();

                // Remove from scene visually
                obj.parent.remove(obj);

                // Hide prompt
                document.getElementById('interaction-prompt').classList.add('hidden');
                this.currentInteractable = null;
            } else {
                // Ignore, inventory full
                // Could flash inventory red
            }
        }

        // Handle Door Locks
        if (obj.userData.isLock) {
            // Check if active item matches lock requirement
            const heldItem = this.inventory[this.activeSlot];
            if (heldItem && heldItem.type === obj.userData.type) {
                // Consume item and unlock
                this.inventory[this.activeSlot] = null;
                this.updateInventoryUI();

                // Dispatch event for Main to handle (Sync via Supabase)
                document.dispatchEvent(new CustomEvent('unlockDoor', {
                    detail: { type: obj.userData.type }
                }));

                // Hide prompt
                document.getElementById('interaction-prompt').classList.add('hidden');
                this.currentInteractable = null;

                // Dirty: directly remove from interactables array so raycaster ignores it
                const idx = this.interactables.indexOf(obj);
                if (idx !== -1) this.interactables.splice(idx, 1);
            }
        }
    }

    dropItem() {
        const item = this.inventory[this.activeSlot];
        if (!item) return;

        // Re-create mesh in world in front of player
        const mesh = item.createMesh();

        const pos = this.controls.getObject().position.clone();
        const dir = new THREE.Vector3();
        this.controls.camera.getWorldDirection(dir);

        pos.add(dir.multiplyScalar(2)); // Drop 2 units in front
        pos.y = 1; // Drop on floor essentially

        mesh.position.copy(pos);

        // This is a dirty way to add to scene from player class without passing scene
        // Better architecture would emit an event, but this works for MVP
        this.interactables[0].parent.add(mesh); // Add to the group that holds interactables
        this.interactables.push(mesh);

        this.inventory[this.activeSlot] = null;
        this.updateInventoryUI();

        // ** SOUND EMISSION ** -> AI Listens to this!
        // Dispatch Custom Event so Main/Enemy can hear it
        document.dispatchEvent(new CustomEvent('playerMakeSound', {
            detail: { position: pos, radius: 20 }
        }));
    }

    updateInventoryUI() {
        for (let i = 0; i < 3; i++) {
            const slot = document.getElementById(`slot-${i + 1}`);
            if (this.inventory[i]) {
                slot.textContent = this.inventory[i].name[0]; // Just first letter for MVP icon
                slot.style.backgroundColor = this.inventory[i].color;
            } else {
                slot.textContent = i + 1;
                slot.style.backgroundColor = 'rgba(0,0,0,0.7)';
            }
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
