import * as THREE from 'three';
import { Player } from './player.js';
import { House } from './house.js';
import { Granny } from './granny.js';
import { Multiplayer } from './multiplayer.js';

let camera, scene, renderer;
let player, house, granny, multiplayer;
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
    const ambientLight = new THREE.AmbientLight(0x222222);
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
    granny = new Granny(scene);
    multiplayer = new Multiplayer(scene, player);
    multiplayer.setGameManagers(house, granny);

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
    granny.reset();

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
        granny.reset();

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
        granny.update(delta, player.controls.getObject().position, triggerGameOver);

        // Multiplayer Broadcast
        multiplayer.update(performance.now());

        // Win condition check
        if (house.checkWinCondition(player.controls.getObject().position)) {
            triggerWin();
        }
    }

    renderer.render(scene, camera);
}
