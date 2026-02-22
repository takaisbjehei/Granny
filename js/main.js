import * as THREE from 'three';
import { Player } from './player.js';
import { House } from './house.js';
import { Granny } from './granny.js';
import { Multiplayer } from './multiplayer.js';

let camera, scene, renderer;
let player, house, multiplayer;
let clock;
let isPlaying = false;
let currentDay = 1;
const MAX_DAYS = 5;

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const loginContainer = document.getElementById('login-container');
const playerNameInput = document.getElementById('player-name');
const startBtn = document.getElementById('start-btn');
const gameOverScreen = document.getElementById('game-over');
const winScreen = document.getElementById('win-screen');
const dayOverlay = document.getElementById('day-overlay');
const dayText = document.getElementById('day-text');
const restartBtn = document.getElementById('restart-btn');
const winRestartBtn = document.getElementById('win-restart-btn');
const chatInput = document.getElementById('chat-input');
const chatLog = document.getElementById('chat-log');

init();
animate();

function init() {
    // Basic Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // very dark grey, almost black
    scene.fog = new THREE.Fog(0x050505, 0, 30); // Spooky fog

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Bright ambient light so it's not black
    scene.add(ambientLight);

    // Player needs a flashlight or a localized point light
    const flashLight = new THREE.PointLight(0xffffff, 1, 20);
    camera.add(flashLight);
    // Add camera to scene so child light renders properly
    scene.add(camera);

    // Managers / Classes
    house = new House(scene);
    player = new Player(camera, document.body, house.walls);
    player.setInteractables(house.interactables);

    // Create a Roblox Noob style player body
    const playerGroup = new THREE.Group();

    // Materials
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf6d73f }); // Head, Arms
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0055ff }); // Legs
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22cc22 }); // Torso

    // Torso (Green)
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.2, 0.5);
    const torso = new THREE.Mesh(torsoGeo, greenMat);
    torso.position.y = -0.5; // Centered slightly below camera
    playerGroup.add(torso);

    // Head (Yellow - mostly hidden by camera perspective but visible to others)
    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const head = new THREE.Mesh(headGeo, yellowMat);
    head.position.y = 0.5;
    playerGroup.add(head);

    // Left Arm (Yellow)
    const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    const leftArm = new THREE.Mesh(armGeo, yellowMat);
    leftArm.position.set(-0.7, -0.5, 0);
    playerGroup.add(leftArm);

    // Right Arm (Yellow)
    const rightArm = new THREE.Mesh(armGeo, yellowMat);
    rightArm.position.set(0.7, -0.5, 0);
    playerGroup.add(rightArm);

    // Left Leg (Blue)
    const legGeo = new THREE.BoxGeometry(0.45, 1.2, 0.45);
    const leftLeg = new THREE.Mesh(legGeo, blueMat);
    leftLeg.position.set(-0.25, -1.7, 0);
    playerGroup.add(leftLeg);

    // Right Leg (Blue)
    const rightLeg = new THREE.Mesh(legGeo, blueMat);
    rightLeg.position.set(0.25, -1.7, 0);
    playerGroup.add(rightLeg);

    playerGroup.position.y = -0.5; // Offset from camera eye level
    camera.add(playerGroup);

    // granny = new Granny(scene); // Temporarily removed
    multiplayer = new Multiplayer(scene, player);
    multiplayer.setGameManagers(house, null);

    scene.add(player.controls.getObject());

    // Reset player pos to starting room
    player.controls.getObject().position.set(0, 5, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Event Listeners
    startBtn.addEventListener('click', async function () {
        const name = playerNameInput.value.trim();
        if (name.length > 0) {
            startBtn.disabled = true;
            startBtn.textContent = 'Connecting...';
            // Pass chat log element to multiplayer so it can append messages
            multiplayer.setChatLog(chatLog);
            await multiplayer.joinGame(name);
            player.controls.lock();
        } else {
            alert("Please enter a name first!");
        }
    });

    player.controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        isPlaying = true;
    });

    player.controls.addEventListener('unlock', function () {
        if (isPlaying) {
            blocker.style.display = 'flex';

            // If already joined, don't show login again, just show "Click to resume" text
            loginContainer.style.display = 'none';
            instructions.style.display = '';
            isPlaying = false;
        }
    });

    // Handle resume click after already logged in
    blocker.addEventListener('click', function (e) {
        if (!isPlaying && multiplayer.localName && e.target === blocker) {
            player.controls.lock();
        }
    });

    restartBtn.addEventListener('click', resetGame);
    winRestartBtn.addEventListener('click', resetGame);
    window.addEventListener('resize', onWindowResize);

    // Chat Focus tracking
    let isTyping = false;

    // Detect 'T' key to open chat
    document.addEventListener('keydown', (e) => {
        if (!isPlaying && !isTyping) return; // Only process if game is active or already typing

        if (e.code === 'KeyT' && !isTyping && isPlaying) {
            e.preventDefault();
            isTyping = true;
            chatInput.style.display = 'block';
            chatInput.focus();
            player.controls.unlock(); // Unlock pointer so user can type
        } else if (e.code === 'Enter' && isTyping) {
            // Send message
            const msg = chatInput.value.trim();
            if (msg.length > 0) {
                multiplayer.sendChatMessage(msg);
                chatInput.value = '';
            }

            // Close chat
            isTyping = false;
            chatInput.style.display = 'none';
            player.controls.lock(); // Lock pointers again to resume play
        } else if (e.code === 'Escape' && isTyping) {
            isTyping = false;
            chatInput.style.display = 'none';
            chatInput.value = '';
            player.controls.lock();
        }
    });

    setupMobileControls();
}

function setupMobileControls() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        document.getElementById('mobile-controls').classList.remove('hidden');

        // Disable pointer lock requirement for mobile
        startBtn.addEventListener('click', () => {
            if (playerNameInput.value.trim().length > 0) {
                setTimeout(() => {
                    instructions.style.display = 'none';
                    blocker.style.display = 'none';
                    isPlaying = true;
                    // Dont lock on mobile, just play
                }, 500); // Small delay after multiplayer join starts
            }
        });

        // Movement Joystick
        const moveJoy = nipplejs.create({
            zone: document.getElementById('joystick-move-zone'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'red'
        });

        moveJoy.on('move', (evt, data) => {
            const forward = data.vector.y;
            const right = data.vector.x;

            player.moveForward = forward > 0.5;
            player.moveBackward = forward < -0.5;
            player.moveRight = right > 0.5;
            player.moveLeft = right < -0.5;
        });

        moveJoy.on('end', () => {
            player.moveForward = false;
            player.moveBackward = false;
            player.moveRight = false;
            player.moveLeft = false;
        });

        // Look Drag Zone (Right Half of Screen)
        const lookZone = document.getElementById('touch-look-zone');
        let lastTouchX = 0;
        let lastTouchY = 0;
        let isDragging = false;

        lookZone.addEventListener('touchstart', (e) => {
            if (e.targetTouches.length > 0) {
                const touch = e.targetTouches[0];
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
                isDragging = true;
            }
        });

        lookZone.addEventListener('touchmove', (e) => {
            if (!isDragging || e.targetTouches.length === 0) return;

            const touch = e.targetTouches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;

            // Sensitivity modifier
            const sens = 0.005;

            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);

            euler.y -= deltaX * sens;
            euler.x -= deltaY * sens; // Pitch

            // Clamp pitch to avoid doing backflips
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

            camera.quaternion.setFromEuler(euler);

            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }, { passive: false });

        lookZone.addEventListener('touchend', () => {
            isDragging = false;
        });

        // Buttons
        document.getElementById('btn-interact').addEventListener('touchstart', (e) => { e.preventDefault(); player.tryInteract(); });
        document.getElementById('btn-drop').addEventListener('touchstart', (e) => { e.preventDefault(); player.dropItem(); });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');

    currentDay = 1;

    // Starting position
    player.controls.getObject().position.set(0, 5, 0);
    // granny.reset();

    player.controls.lock();
}

function showDayTransition() {
    isPlaying = false;
    player.controls.unlock();

    dayText.textContent = `Day ${currentDay}`;
    dayOverlay.classList.remove('hidden');
    dayOverlay.style.opacity = 1;

    setTimeout(() => {
        // Reset player 
        player.controls.getObject().position.set(0, 5, 0);
        // granny.reset();

        // Maybe drop items from inventory here depending on design

        dayOverlay.style.opacity = 0;
        setTimeout(() => {
            dayOverlay.classList.add('hidden');
            player.controls.lock();
        }, 2000); // fade out duration
    }, 3000); // Show text for 3 seconds
}

export function triggerGameOver() {
    if (currentDay < MAX_DAYS) {
        currentDay++;
        showDayTransition();
    } else {
        // True Game Over
        isPlaying = false;
        player.controls.unlock();
        blocker.style.display = 'flex';
        instructions.style.display = 'none';
        gameOverScreen.classList.remove('hidden');
    }
}

export function triggerWin() {
    isPlaying = false;
    player.controls.unlock();
    blocker.style.display = 'flex';
    instructions.style.display = 'none';
    winScreen.classList.remove('hidden');
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (isPlaying) {
        player.update(delta);
        // granny.update(delta, player.controls.getObject().position, triggerGameOver);

        // Multiplayer Broadcast
        multiplayer.update(performance.now());

        // Win condition check
        if (house.checkWinCondition(player.controls.getObject().position)) {
            triggerWin();
        }
    }

    renderer.render(scene, camera);
}
