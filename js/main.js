import * as THREE from 'three';
import { Player } from './player.js';
import { House } from './house.js';
import { Granny } from './granny.js';

let camera, scene, renderer;
let player, house, granny;
let clock;
let isPlaying = false;

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const gameOverScreen = document.getElementById('game-over');
const winScreen = document.getElementById('win-screen');
const restartBtn = document.getElementById('restart-btn');
const winRestartBtn = document.getElementById('win-restart-btn');

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
    granny = new Granny(scene);

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
    instructions.addEventListener('click', function () {
        player.controls.lock();
    });

    player.controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        isPlaying = true;
    });

    player.controls.addEventListener('unlock', function () {
        if (isPlaying) {
            blocker.style.display = 'flex';
            instructions.style.display = '';
            isPlaying = false;
        }
    });

    restartBtn.addEventListener('click', resetGame);
    winRestartBtn.addEventListener('click', resetGame);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');

    // Starting position
    player.controls.getObject().position.set(0, 5, 0);
    granny.reset();

    player.controls.lock();
}

export function triggerGameOver() {
    isPlaying = false;
    player.controls.unlock();
    blocker.style.display = 'flex';
    instructions.style.display = 'none';
    gameOverScreen.classList.remove('hidden');
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

        // Win condition check
        if (house.checkWinCondition(player.controls.getObject().position)) {
            triggerWin();
        }
    }

    renderer.render(scene, camera);
}
