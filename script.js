// ==========================================
// CONFIGURATION
// ==========================================
let currentDiscordId = "1484348207143194808"; 

// ==========================================
// DOM ELEMENTS
// ==========================================
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');

const avatarEl = document.getElementById('discord-avatar');
const statusEl = document.getElementById('discord-status');
const usernameEl = document.getElementById('discord-username');
const customStatusEl = document.getElementById('discord-custom-status');

const activityCont = document.getElementById('activity-container');
const activityTitle = document.getElementById('activity-title');
const activityImg = document.getElementById('activity-image');
const activityName = document.getElementById('activity-name');
const activityState = document.getElementById('activity-state');
const activityDetails = document.getElementById('activity-details-text');

// Switcher Elements
const switcherBtn = document.getElementById('switcher-btn');
const switcherMenu = document.getElementById('switcher-menu');
const switcherOptions = document.querySelectorAll('.switcher-option');
const currentAccountLabel = document.getElementById('current-account-label');

// ==========================================
// CLOCK LOGIC
// ==========================================
function updateClock() {
    const now = new Date();
    
    // Time
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
    
    // Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-US', options);
}

setInterval(updateClock, 1000);
updateClock();

// ==========================================
// LANYARD WEBSOCKET
// ==========================================

let heartbeatInterval;
let ws;

function connectLanyard() {
    if (ws) {
        // Clean up previous connection if it exists
        ws.onclose = null; // Prevent reconnect loop from firing during manual close
        ws.close();
        clearInterval(heartbeatInterval);
    }

    ws = new WebSocket('wss://api.lanyard.rest/socket');

    ws.onopen = () => {
        console.log("Connected to Lanyard");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.op) {
            case 1: // Hello -> Setup heartbeat
                startHeartbeat(ws, data.d.heartbeat_interval);
                ws.send(JSON.stringify({
                    op: 2,
                    d: { subscribe_to_id: currentDiscordId }
                }));
                break;
            case 0: // Event Payload
                if (data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE') {
                    updateDiscordUI(data.d);
                }
                break;
        }
    };

    ws.onclose = () => {
        console.log("Disconnected from Lanyard. Reconnecting...");
        clearInterval(heartbeatInterval);
        setTimeout(connectLanyard, 5000);
    };
}

function startHeartbeat(ws, interval) {
    heartbeatInterval = setInterval(() => {
        ws.send(JSON.stringify({ op: 3 }));
    }, interval);
}

// ==========================================
// UPDATING THE UI
// ==========================================
function updateDiscordUI(data) {
    const user = data.discord_user;

    // 1. Basic Info
    usernameEl.textContent = user.global_name || user.username;
    
    // Avatar
    const avatarExt = user.avatar && user.avatar.startsWith('a_') ? 'gif' : 'png';
    const avatarUrl = user.avatar 
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${avatarExt}?size=256`
        : `https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff`;
    avatarEl.src = avatarUrl;

    // 2. Status Indicator
    statusEl.className = `status-indicator ${data.discord_status}`;

    // 3. Custom Status
    let customStatusText = "Chilling...";
    const customActivity = data.activities.find(a => a.type === 4); // Type 4 is custom status
    if (customActivity && customActivity.state) {
        customStatusText = customActivity.state;
    }
    customStatusEl.textContent = customStatusText;

    // 4. Other Activities (Games, Spotify, etc.)
    const visibleActivity = data.activities.find(a => a.type !== 4);
    
    if (visibleActivity) {
        activityCont.classList.remove('hidden');
        activityName.textContent = visibleActivity.name;
        
        if (visibleActivity.type === 2 && data.spotify) {
            // Spotify
            activityTitle.textContent = "Listening to Spotify";
            activityName.textContent = data.spotify.song;
            activityState.textContent = 'by ' + data.spotify.artist;
            activityDetails.textContent = 'on ' + data.spotify.album;
            
            activityImg.src = data.spotify.album_art_url;
            activityImg.classList.remove('hidden');
        } else {
            // Games or Rich Presence
            activityTitle.textContent = visibleActivity.type === 0 ? "Playing a game" : "Activity";
            activityState.textContent = visibleActivity.state || "";
            activityDetails.textContent = visibleActivity.details || "";
            
            // Try to get Large Image URL
            if (visibleActivity.assets && visibleActivity.assets.large_image) {
                let imgUrl = visibleActivity.assets.large_image;
                if (imgUrl.startsWith('mp:external')) {
                    imgUrl = imgUrl.replace('mp:external/', 'https://media.discordapp.net/external/');
                } else {
                    imgUrl = `https://cdn.discordapp.com/app-assets/${visibleActivity.application_id}/${imgUrl}.png`;
                }
                activityImg.src = imgUrl;
                activityImg.classList.remove('hidden');
            } else {
                activityImg.classList.add('hidden');
            }
        }
    } else {
        activityCont.classList.add('hidden');
    }
}

// ==========================================
// SWITCHER LOGIC
// ==========================================
switcherBtn.addEventListener('click', () => {
    switcherMenu.classList.toggle('hidden');
    switcherBtn.classList.toggle('open');
});

switcherOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        // Update UI
        switcherOptions.forEach(opt => opt.classList.remove('active'));
        e.target.classList.add('active');
        currentAccountLabel.textContent = e.target.textContent;
        
        // Close menu
        switcherMenu.classList.add('hidden');
        switcherBtn.classList.remove('open');
        
        // Reconnect lanyard
        currentDiscordId = e.target.getAttribute('data-id');
        
        // Show loading state temporarily
        usernameEl.textContent = "Loading...";
        customStatusEl.textContent = "Connecting to Lanyard...";
        activityCont.classList.add('hidden');
        
        connectLanyard();
    });
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!switcherBtn.contains(e.target) && !switcherMenu.contains(e.target)) {
        switcherMenu.classList.add('hidden');
        switcherBtn.classList.remove('open');
    }
});

connectLanyard();
