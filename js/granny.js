import * as THREE from 'three';

export class Granny {
    constructor(scene) {
        this.scene = scene;
        this.speed = 10.0;
        this.catchDistance = 2.0;
        this.initialPosition = new THREE.Vector3(30, 4, 30); // Spawn away from player

        // AI State
        this.state = 'PATROL'; // PATROL, INVESTIGATE, CHASE
        this.targetPoint = this.getRandomPatrolPoint();
        this.waitTime = 0;

        // Listen for standard sounds
        document.addEventListener('playerMakeSound', (e) => {
            // Only care if we aren't already chasing
            if (this.state !== 'CHASE') {
                this.state = 'INVESTIGATE';
                this.targetPoint = e.detail.position.clone();
                this.targetPoint.y = this.mesh.position.y;
            }
        });

        // Make Granny model
        // A simple tall, scary floating figure
        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.8, 6, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 }); // Black robes
        this.mesh = new THREE.Mesh(bodyGeo, bodyMat);

        const headGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 }); // Pale face
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 3.6;
        this.mesh.add(head);

        // Glowing red eyes
        const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.3, 3.8, 0.6);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.3, 3.8, 0.6);
        this.mesh.add(rightEye);

        // Red light aura
        const redLight = new THREE.PointLight(0xff0000, 2, 10);
        redLight.position.set(0, 3.6, 1);
        this.mesh.add(redLight);

        this.mesh.position.copy(this.initialPosition);
        this.scene.add(this.mesh);
    }

    getRandomPatrolPoint() {
        // Just pick random coordinates inside the house bounds for MVP
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        return new THREE.Vector3(x, this.mesh.position.y, z);
    }

    update(delta, playerPos, onCatch) {
        // 1. Check if we should chase (Line of sight / proximity MVP)
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        if (distToPlayer < 30) {
            // Simplified vision
            this.state = 'CHASE';
            this.targetPoint = playerPos.clone();
            this.targetPoint.y = this.mesh.position.y;
        } else if (this.state === 'CHASE') {
            // Lost player, go back to patrol
            this.state = 'PATROL';
            this.targetPoint = this.getRandomPatrolPoint();
        }

        // 2. Perform State Action
        if (this.state === 'PATROL' || this.state === 'INVESTIGATE' || this.state === 'CHASE') {
            const direction = new THREE.Vector3().subVectors(this.targetPoint, this.mesh.position);
            direction.y = 0;
            const distance = direction.length();

            if (this.state === 'CHASE' && distance < this.catchDistance) {
                onCatch();
                return;
            }

            if (distance < 2.0) {
                // Reached destination
                if (this.state === 'INVESTIGATE') {
                    // Look around for a bit
                    this.state = 'PATROL';
                    this.targetPoint = this.getRandomPatrolPoint();
                } else if (this.state === 'PATROL') {
                    this.targetPoint = this.getRandomPatrolPoint();
                }
            } else {
                // Move towards point
                direction.normalize();
                this.mesh.position.add(direction.multiplyScalar(this.speed * delta));
                this.mesh.lookAt(this.targetPoint);
            }
        }
    }

    reset() {
        this.mesh.position.copy(this.initialPosition);
    }
}
