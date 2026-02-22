import * as THREE from 'three';

// Initialize Supabase Client
const SUPABASE_URL = 'https://lsboatmullmcehgogjuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYm9hdG11bGxtY2VoZ29nanVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjAwMDQsImV4cCI6MjA4NzMzNjAwNH0.2DW27e2kb8M2F1_BlJcWBobxhRCeHIAPZdlfbThGbD4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class Multiplayer {
    constructor(scene, playerControls) {
        this.scene = scene;
        this.controls = playerControls;
        this.remotePlayers = {}; // Dictionary of UUID to Mesh
        this.localId = crypto.randomUUID();
        this.localName = '';
        this.chatLogElement = null; // Set from main.js

        // Broadcast variables
        this.lastBroadcast = 0;
        this.broadcastRate = 100; // ms
    }

    async joinGame(playerName) {
        this.localName = playerName;

        // Initial insert
        await supabase.from('players').upsert({
            id: this.localId,
            name: this.localName,
            x: 0,
            y: 5,
            z: 0,
            rotation_y: 0,
            room: 'start'
        });

        // Listen for all players
        this.playerChannel = supabase
            .channel('public:players')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'players' },
                (payload) => this.handlePlayerUpdate(payload)
            )
            .subscribe();

        // Listen for chat
        this.chatChannel = supabase
            .channel('public:chat_messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload) => this.handleChatUpdate(payload)
            )
            .subscribe();

        // Listen for Game State (Locks)
        this.gameStateChannel = supabase
            .channel('public:game_state')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_state' },
                (payload) => this.handleGameStateUpdate(payload)
            )
            .subscribe();

        // Initial fetch
        this.fetchExistingPlayers();
        this.fetchGameState();

        // Listen for local unlock events from player.js
        document.addEventListener('unlockDoor', async (e) => {
            const type = e.detail.type;
            const updateObj = {};
            if (type === 'key') updateObj.lock_key = true;
            if (type === 'tool') updateObj.lock_tool = true;
            if (type === 'code') updateObj.lock_code = true;

            await supabase.from('game_state').update(updateObj).eq('id', 1);
        });
    }

    setGameManagers(house, granny) {
        this.house = house;
        this.granny = granny;
    }

    async fetchGameState() {
        const { data } = await supabase.from('game_state').select('*').eq('id', 1).single();
        if (data) this.applyGameState(data);
    }

    handleGameStateUpdate(payload) {
        this.applyGameState(payload.new);
    }

    applyGameState(state) {
        if (!this.house) return;

        if (state.lock_key && !this.house.doorState.key) this.house.unlock('key');
        if (state.lock_tool && !this.house.doorState.tool) this.house.unlock('tool');
        if (state.lock_code && !this.house.doorState.code) this.house.unlock('code');

        // Handle Day reset logic later
    }

    setChatLog(element) {
        this.chatLogElement = element;
    }

    async sendChatMessage(message) {
        if (!this.localName) return;

        // Optimistic UI update
        this.appendChatMessage(this.localName, message);

        await supabase.from('chat_messages').insert({
            player_id: this.localId,
            player_name: this.localName,
            message: message
        });
    }

    handleChatUpdate(payload) {
        const p = payload.new;
        if (!p || p.player_id === this.localId) return; // Prevent double messages

        this.appendChatMessage(p.player_name, p.message);
        this.showChatBubble(p.player_id, p.message);
    }

    appendChatMessage(name, message) {
        if (!this.chatLogElement) return;

        const div = document.createElement('div');
        div.className = 'chat-message';
        div.innerHTML = `<span class="player-name">${name}:</span> ${message}`;
        this.chatLogElement.appendChild(div);
        this.chatLogElement.scrollTop = this.chatLogElement.scrollHeight;
    }

    showChatBubble(playerId, message) {
        // Find the remote player mesh
        const mesh = this.remotePlayers[playerId];
        if (!mesh) return;

        // Check if there is already a bubble and remove it
        if (mesh.userData.chatBubble) {
            mesh.remove(mesh.userData.chatBubble);
            mesh.userData.chatBubble.material.map.dispose();
            mesh.userData.chatBubble.material.dispose();
            mesh.userData.chatBubble.geometry.dispose();
        }

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.roundRect(0, 0, 512, 128, 20);
        ctx.fill();

        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(message, 256, 70);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);

        sprite.scale.set(3, 0.75, 1);
        sprite.position.set(0, 2.5, 0); // Above the name tag

        mesh.add(sprite);
        mesh.userData.chatBubble = sprite;

        // Remove bubble after 5 seconds
        setTimeout(() => {
            if (mesh && mesh.userData.chatBubble === sprite) {
                mesh.remove(sprite);
                material.map.dispose();
                material.dispose();
                sprite.geometry.dispose();
                mesh.userData.chatBubble = null;
            }
        }, 5000);
    }

    async fetchExistingPlayers() {
        const { data } = await supabase.from('players').select('*');
        if (data) {
            data.forEach(p => {
                if (p.id !== this.localId) {
                    this.updateRemotePlayer(p);
                }
            });
        }
    }

    handlePlayerUpdate(payload) {
        const p = payload.new;
        if (!p || p.id === this.localId) return;

        if (payload.eventType === 'DELETE') {
            this.removeRemotePlayer(payload.old.id);
        } else {
            this.updateRemotePlayer(p);
        }
    }

    updateRemotePlayer(data) {
        if (!this.remotePlayers[data.id]) {
            // Create simple avatar
            const geo = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x5555ff }); // Blue players
            const mesh = new THREE.Mesh(geo, mat);

            // Create Name Tag using a Canvas and Sprite
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.font = '40px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(data.name, 128, 64);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const nameSprite = new THREE.Sprite(spriteMaterial);
            nameSprite.scale.set(2, 1, 1);
            nameSprite.position.set(0, 1.5, 0); // Position above head
            mesh.add(nameSprite);

            this.scene.add(mesh);
            this.remotePlayers[data.id] = mesh;
        }

        const mesh = this.remotePlayers[data.id];
        // Jump position (TODO Smooth interpolation)
        mesh.position.set(data.x, data.y, data.z);
        mesh.rotation.y = data.rotation_y;
    }

    removeRemotePlayer(id) {
        if (this.remotePlayers[id]) {
            this.scene.remove(this.remotePlayers[id]);
            delete this.remotePlayers[id];
        }
    }

    update(timeNow) {
        if (!this.localName) return; // Not joined yet

        // Broadcast local position
        if (timeNow - this.lastBroadcast > this.broadcastRate) {
            this.lastBroadcast = timeNow;

            const pos = this.controls.getObject().position;
            // The camera contains the actual rotation we care about
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(this.controls.getObject().quaternion);

            // Fire and forget update
            supabase.from('players').update({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                rotation_y: euler.y,
                last_updated: new Date().toISOString()
            }).eq('id', this.localId).then();
        }
    }

    // Call this if game is closed or user leaves
    async leaveGame() {
        await supabase.from('players').delete().eq('id', this.localId);
    }
}
