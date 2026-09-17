// ==========================================
// VARIABEL GLOBAL & SETUP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = 500;
const GAME_HEIGHT = 600;

const scoreDisplay = document.getElementById('score-display');
const waveDisplay = document.getElementById('wave-display');
const hiDisplay = document.getElementById('hi-display');
const livesDisplay = document.getElementById('lives-display');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

let gameState = 'START';
let score = 0;
let lives = 3;
let wave = 1;
let highScore = parseInt(localStorage.getItem('galaxian_hi')) || 0;

let player;
let aliens = [];
let playerBullets = [];
let alienBullets = [];
let stars = [];

const inputState = { left: false, right: false, fire: false };

let audioCtx;
let formationDirection = 1;
let formationSpeed = 0.5;
let diveTimer = 120;

const ALIEN_STATES = {
    FORMATION: 'FORMATION',
    DIVE_OUT: 'DIVE_OUT',
    DIVE_ATTACK: 'DIVE_ATTACK',
    RETURNING: 'RETURNING'
};

// ==========================================
// CLASS BULLET
// ==========================================
class Bullet {
    constructor(x, y, speed, color) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = speed;
        this.color = color;
        this.active = true;
    }
    update() {
        this.y += this.speed;
        if (this.y < 0 || this.y > GAME_HEIGHT) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// ==========================================
// CLASS PLAYER
// ==========================================
class Player {
    constructor() {
        this.width = 40;
        this.height = 20;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - 60;
        this.speed = 5;
        this.cooldown = 0;
        this.invincible = 0;
    }
    update() {
        if (inputState.left && this.x > 0) this.x -= this.speed;
        if (inputState.right && this.x < GAME_WIDTH - this.width) this.x += this.speed;
        if (this.cooldown > 0) this.cooldown--;
        if (this.invincible > 0) this.invincible--;
    }
    draw(ctx) {
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;
        // Badan pesawat
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x + 15, this.y, 10, 10);
        ctx.fillRect(this.x + 18, this.y - 5, 4, 5);
        ctx.fillRect(this.x, this.y + 10, this.width, 10);
        // Sayap cyan
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.x - 3, this.y + 15, 6, 5);
        ctx.fillRect(this.x + this.width - 3, this.y + 15, 6, 5);
    }
    shoot() {
        if (this.cooldown <= 0) {
            playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -8, '#ffff00'));
            this.cooldown = 18;
            playSound(880, 'square', 0.08, 0.05);
        }
    }
}

// ==========================================
// CLASS ALIEN (dengan pixel art)
// ==========================================
class Alien {
    constructor(homeX, homeY, type, row, col) {
        this.homeX = homeX;
        this.homeY = homeY;
        this.x = homeX;
        this.y = homeY;
        this.width = 24;
        this.height = 18;
        this.type = type;
        this.row = row;
        this.col = col;
        this.alive = true;
        this.state = ALIEN_STATES.FORMATION;
        this.diveProgress = 0;
        this.startX = homeX;
        this.startY = homeY;
        this.hasShot = false;
    }
    update() {
        if (!this.alive) return;
        if (this.state === ALIEN_STATES.FORMATION) {
            this.x += formationSpeed * formationDirection;
        } else if (this.state === ALIEN_STATES.DIVE_OUT || this.state === ALIEN_STATES.DIVE_ATTACK) {
            this.updateDive();
        } else if (this.state === ALIEN_STATES.RETURNING) {
            this.y += 4;
            if (this.y <= this.homeY) {
                this.y = this.homeY;
                this.x = this.homeX;
                this.state = ALIEN_STATES.FORMATION;
            }
        }
    }
    updateDive() {
        this.diveProgress += 0.015;
        if (this.state === ALIEN_STATES.DIVE_OUT) {
            if (this.diveProgress < 0.15) {
                this.y = this.startY - this.diveProgress * 100;
            } else {
                this.state = ALIEN_STATES.DIVE_ATTACK;
                this.diveProgress = 0;
                this.startX = this.x;
                this.startY = this.y;
            }
        } else if (this.state === ALIEN_STATES.DIVE_ATTACK) {
            const t = this.diveProgress;
            const amplitude = 80;
            this.x = this.startX + Math.sin(t * Math.PI * 2) * amplitude * (1 - t);
            this.y = this.startY + (GAME_HEIGHT + 50 - this.startY) * (t * t);
            if (!this.hasShot && t > 0.4 && t < 0.6) {
                alienBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 5, '#ff0055'));
                this.hasShot = true;
            }
            if (this.y > GAME_HEIGHT + 30) {
                this.state = ALIEN_STATES.RETURNING;
                this.diveProgress = 0;
                this.y = -30;
            }
        }
    }
    draw(ctx) {
        if (!this.alive) return;
        const colors = ['#ff0055', '#00ffff', '#00ff00'];
        const color = colors[this.type];
        const pixelSize = 3;
        const alienPattern = [
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 0, 1, 1, 0, 1, 0],
            [1, 0, 0, 0, 0, 0, 0, 1]
        ];
        ctx.fillStyle = color;
        for (let row = 0; row < alienPattern.length; row++) {
            for (let col = 0; col < alienPattern[row].length; col++) {
                if (alienPattern[row][col] === 1) {
                    ctx.fillRect(
                        this.x + col * pixelSize,
                        this.y + row * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
        }
    }
}

// ==========================================
// STARS (BACKGROUND)
// ==========================================
function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            speed: Math.random() * 0.8 + 0.2,
            size: Math.random() < 0.3 ? 2 : 1
        });
    }
}

function updateStars() {
    for (let star of stars) {
        star.y += star.speed;
        if (star.y > GAME_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * GAME_WIDTH;
        }
    }
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let star of stars) {
        ctx.globalAlpha = 0.5 + star.speed * 0.3;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1.0;
}

// ==========================================
// INIT GAME
// ==========================================
function initGame() {
    player = new Player();
    aliens = [];
    playerBullets = [];
    alienBullets = [];
    formationDirection = 1;
    diveTimer = 120;

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
            let type = r === 0 ? 0 : (r < 3 ? 1 : 2);
            let x = 70 + c * 45;
            let y = 60 + r * 40;
            aliens.push(new Alien(x, y, type, r, c));
        }
    }
    updateHUD();
}

function updateHUD() {
    scoreDisplay.textContent = 'SCORE: ' + String(score).padStart(4, '0');
    waveDisplay.textContent = 'WAVE: ' + wave;
    livesDisplay.textContent = '♥ ' + lives;
    hiDisplay.textContent = 'HI: ' + String(highScore).padStart(4, '0');
}

// ==========================================
// COLLISION
// ==========================================
function isColliding(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y);
}

function checkCollisions() {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        let bullet = playerBullets[i];
        for (let j = aliens.length - 1; j >= 0; j--) {
            let alien = aliens[j];
            if (alien.alive && bullet.active && isColliding(bullet, alien)) {
                alien.alive = false;
                bullet.active = false;
                score += 100;
                updateHUD();
                playSound(150, 'sawtooth', 0.2, 0.1);
                break;
            }
        }
    }

    if (player.invincible <= 0) {
        for (let i = alienBullets.length - 1; i >= 0; i--) {
            let bullet = alienBullets[i];
            if (bullet.active && isColliding(bullet, player)) {
                bullet.active = false;
                playerHit();
                break;
            }
        }
        for (let alien of aliens) {
            if (alien.alive && isColliding(alien, player)) {
                alien.alive = false;
                playerHit();
                break;
            }
        }
    }
}

function playerHit() {
    lives--;
    updateHUD();
    playSound(80, 'square', 0.5, 0.15);
    if (lives <= 0) {
        gameState = 'GAMEOVER';
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('galaxian_hi', highScore.toString());
        }
        overlay.classList.remove('hidden');
        overlay.querySelector('h1').textContent = 'GAME OVER';
        overlay.querySelector('h2').textContent = 'SKOR: ' + score;
        overlay.querySelector('p').textContent = 'Tekan START untuk main lagi';
        startBtn.textContent = 'RESTART';
    } else {
        player.invincible = 120;
    }
}

// ==========================================
// ALIEN DIVE
// ==========================================
function triggerAlienDive() {
    diveTimer--;
    if (diveTimer <= 0) {
        const candidates = aliens.filter(a => a.alive && a.state === ALIEN_STATES.FORMATION);
        if (candidates.length > 0) {
            const randomAlien = candidates[Math.floor(Math.random() * candidates.length)];
            randomAlien.state = ALIEN_STATES.DIVE_OUT;
            randomAlien.diveProgress = 0;
            randomAlien.startX = randomAlien.x;
            randomAlien.startY = randomAlien.y;
            randomAlien.hasShot = false;
            diveTimer = Math.max(30, 120 - (wave * 10));
        }
    }
}

function updateBullets(bullets) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (!bullets[i].active) bullets.splice(i, 1);
    }
}

function drawBullets(bullets) {
    for (let bullet of bullets) bullet.draw(ctx);
}

// ==========================================
// AUDIO
// ==========================================
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(frequency, type, duration, volume = 0.1) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    updateStars();
    drawStars();

    if (gameState === 'PLAYING') {
        player.update();
        if (inputState.fire) player.shoot();

        let hitEdge = false;
        for (let alien of aliens) {
            if (alien.alive && alien.state === ALIEN_STATES.FORMATION) {
                if (alien.x <= 10 || alien.x >= GAME_WIDTH - alien.width - 10) hitEdge = true;
            }
        }
        if (hitEdge) {
            formationDirection *= -1;
            for (let alien of aliens) {
                if (alien.alive && alien.state === ALIEN_STATES.FORMATION) alien.y += 10;
            }
        }

        for (let alien of aliens) alien.update();
        triggerAlienDive();
        updateBullets(playerBullets);
        updateBullets(alienBullets);
        checkCollisions();

        player.draw(ctx);
        for (let alien of aliens) {
            if (alien.alive) alien.draw(ctx);
        }
        drawBullets(playerBullets);
        drawBullets(alienBullets);

        if (aliens.every(a => !a.alive)) {
            wave++;
            initGame();
        }
    }

    requestAnimationFrame(gameLoop);
}

// ==========================================
// EVENT LISTENERS
// ==========================================
window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = true;
    if (e.key === ' ') inputState.fire = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = false;
    if (e.key === ' ') inputState.fire = false;
});

function setupTouchButton(buttonId, stateKey) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const startAction = (e) => {
        e.preventDefault();
        inputState[stateKey] = true;
        btn.classList.add('active');
    };
    const endAction = (e) => {
        e.preventDefault();
        inputState[stateKey] = false;
        btn.classList.remove('active');
    };
    btn.addEventListener('touchstart', startAction);
    btn.addEventListener('touchend', endAction);
    btn.addEventListener('touchcancel', endAction);
    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('mouseup', endAction);
    btn.addEventListener('mouseleave', endAction);
}

setupTouchButton('btn-left', 'left');
setupTouchButton('btn-right', 'right');
setupTouchButton('btn-fire', 'fire');

startBtn.addEventListener('click', function () {
    initAudio();
    if (gameState === 'START' || gameState === 'GAMEOVER') {
        gameState = 'PLAYING';
        overlay.classList.add('hidden');
        initGame();
    }
});

// ==========================================
// INIT
// ==========================================
initStars();
updateHUD();
requestAnimationFrame(gameLoop);