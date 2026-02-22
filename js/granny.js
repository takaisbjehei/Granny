import * as THREE from 'three';

export class Granny {
    constructor(scene) {
        this.scene = scene;
        this.speed = 10.0;
        this.catchDistance = 2.0;
        this.initialPosition = new THREE.Vector3(30, 4, 30); // Spawn away from player

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

    update(delta, playerPos, onCatch) {
        // Simple AI: Move directly towards player
        const direction = new THREE.Vector3().subVectors(playerPos, this.mesh.position);

        // Keep Y level constant to prevent flying
        direction.y = 0;

        const distance = direction.length();

        if (distance < this.catchDistance) {
            onCatch();
        } else {
            direction.normalize();
            this.mesh.position.add(direction.multiplyScalar(this.speed * delta));

            // Look at player
            const target = playerPos.clone();
            target.y = this.mesh.position.y;
            this.mesh.lookAt(target);
        }
    }

    reset() {
        this.mesh.position.copy(this.initialPosition);
    }
}
