/**
 * AUDIO SYSTEM
 */
const AudioSys = {
    ctx: null,
    init: function () {
        if (!this.ctx) {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    play: function (freq, type, duration, vol = 0.1, slide = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    sfx: {
        move: () => AudioSys.play(120, 'square', 0.05, 0.05),
        rotate: () => AudioSys.play(200, 'square', 0.05, 0.05),
        drop: () => AudioSys.play(80, 'sawtooth', 0.1, 0.1, -20),
        lock: () => AudioSys.play(150, 'square', 0.05, 0.1),
        clear: () => { AudioSys.play(400, 'square', 0.1, 0.1); setTimeout(() => AudioSys.play(600, 'square', 0.1, 0.1), 80); },
        tetris: () => { AudioSys.play(300, 'square', 0.1, 0.1); setTimeout(() => AudioSys.play(500, 'square', 0.1, 0.1), 100); setTimeout(() => AudioSys.play(700, 'square', 0.4, 0.1), 200); },
        levelup: () => { AudioSys.play(600, 'triangle', 0.2, 0.1); setTimeout(() => AudioSys.play(800, 'triangle', 0.4, 0.1), 100); },
        gameOver: () => { AudioSys.play(300, 'sawtooth', 0.5, 0.2, -200); }
    }
};

/**
 * GAME CONFIG & STATE
 */
const COLS = 12;
const ROWS = 22;
let BLOCK_SIZE = 25;

const COLORS = [
    null,
    '#c0392b', '#27ae60', '#8e44ad', '#f1c40f',
    '#2980b9', '#d35400', '#16a085', '#7f8c8d' // 8: Obstacle Gray
];

// Level Themes (Background Border Colors)
const THEMES = [
    '#4e342e', // L1: Wood
    '#5d4037', // L2
    '#6d4c41', // L3
    '#3e2723', // L4: Dark Wood
    '#1a237e', // L5: Navy (Speed Up)
    '#311b92', // L6: Deep Purple
    '#b71c1c', // L7: Red Alert
    '#880e4f', // L8: Maroon
    '#212121', // L9: Dark Grey
    '#000000'  // L10+: Void
];

const SHAPES = [
    [],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 2, 2], [2, 2, 0], [0, 0, 0]],
    [[0, 3, 0], [3, 3, 3], [0, 0, 0]],
    [[4, 4], [4, 4]],
    [[5, 0, 0], [5, 5, 5], [0, 0, 0]],
    [[0, 0, 6], [6, 6, 6], [0, 0, 0]],
    [[0, 0, 0, 0], [7, 7, 7, 7], [0, 0, 0, 0], [0, 0, 0, 0]]
];

// DOM Elements
const homeScreen = document.getElementById('home-screen');
const gameContainer = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const overlay = document.getElementById('overlay');
const touchZone = document.getElementById('touch-zone');
const finalScoreEl = document.getElementById('final-score');
const gameWrapper = document.getElementById('game-container'); // For background color change
const leaderboardScreen = document.getElementById('leaderboard-screen');
const scoresListEl = document.getElementById('scores-list');
const nameInputContainer = document.getElementById('name-input-container');
const gameOverButtons = document.getElementById('game-over-buttons');
const playerNameInput = document.getElementById('player-name');

// State Variables
let grid = [];
let bag = [];
let piece = null;
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let isPlaying = false; // New global state
let dropCounter = 0;
let lastTime = 0;
let dropInterval = 1000;
let lockDelayTimer = 0;
const LOCK_DELAY_MS = 500;
let isTouchingGround = false;
let movesResets = 0;
const MAX_MOVES_RESET = 15;

/**
 * VISUAL EFFECTS
 */
let particles = [];

function shakeScreen(magnitude) {
    const el = document.getElementById('game-container');
    el.classList.remove('shake-s', 'shake-b');
    void el.offsetWidth; // trigger reflow
    if (magnitude === 'small') el.classList.add('shake-s');
    if (magnitude === 'big') el.classList.add('shake-b');
}

function updateTheme() {
    const themeIdx = Math.min(level - 1, THEMES.length - 1);
    document.documentElement.style.setProperty('--theme-color', THEMES[themeIdx]);
}

function createExplosion(gridX, gridY, colorId) {
    const color = COLORS[colorId];
    const centerX = gridX * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = gridY * BLOCK_SIZE + BLOCK_SIZE / 2;

    for (let i = 0; i < 6; i++) {
        particles.push({
            x: centerX + (Math.random() - 0.5) * BLOCK_SIZE,
            y: centerY + (Math.random() - 0.5) * BLOCK_SIZE,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 2,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.03,
            size: Math.random() * (BLOCK_SIZE / 2.5) + 2,
            color: color,
            gravity: 0.5
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
}

/**
 * CORE LOGIC
 */
function initGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function resize() {
    const wrapper = document.getElementById('canvas-wrapper');
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    const sizeW = Math.floor((w - 4) / COLS);
    const sizeH = Math.floor((h - 4) / ROWS);

    BLOCK_SIZE = Math.min(sizeW, sizeH);

    canvas.width = BLOCK_SIZE * COLS;
    canvas.height = BLOCK_SIZE * ROWS;

    draw();
}

function fillBag() {
    const newBag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }
    bag.push(...newBag);
}

function getPiece() {
    if (bag.length === 0) fillBag();
    if (bag.length <= 7) fillBag();
    const type = bag.shift();
    const shape = SHAPES[type];
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(p, moveX, moveY) {
    for (let y = 0; y < p.shape.length; y++) {
        for (let x = 0; x < p.shape[y].length; x++) {
            if (p.shape[y][x] !== 0) {
                const newX = p.x + x + moveX;
                const newY = p.y + y + moveY;
                if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && grid[newY][newX] !== 0)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function rotate(p) {
    const newShape = p.shape[0].map((_, i) => p.shape.map(row => row[i]).reverse());
    const clone = { ...p, shape: newShape };
    let offset = 1;
    while (collide(clone, 0, 0)) {
        clone.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (Math.abs(offset) > 2) return;
    }
    p.shape = newShape;
    p.x = clone.x;
    if (isTouchingGround && movesResets < MAX_MOVES_RESET) { lockDelayTimer = 0; movesResets++; }
    AudioSys.sfx.rotate();
}

function merge(p) {
    p.shape.forEach((row, y) => {
        row.forEach((val, x) => {
            if (val !== 0) grid[p.y + y][p.x + x] = val;
        });
    });
}

function clearLines() {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) if (grid[y][x] === 0) continue outer;

        for (let x = 0; x < COLS; x++) {
            createExplosion(x, y, grid[y][x]);
        }

        grid.splice(y, 1)[0].fill(0);
        grid.unshift(new Array(COLS).fill(0));
        linesCleared++;
        y++;
    }
    if (linesCleared > 0) {
        lines += linesCleared;
        const baseScores = [0, 40, 100, 300, 1200];
        score += baseScores[linesCleared] * level;

        // Level Up Logic: Every 10 lines
        const nextLevel = Math.floor(lines / 10) + 1;
        if (nextLevel > level) {
            level = nextLevel;
            // Aggressive Speed Curve
            // L1: 800ms, L5: 417ms, L10: 100ms
            dropInterval = Math.max(80, 800 * Math.pow(0.80, level - 1));
            AudioSys.sfx.levelup();
            updateTheme();
            shakeScreen('small');

            // Obstacle Blocks (Garbage) Logic
            if (level >= 2) {
                let garbageCount = 0;
                if (level <= 4) garbageCount = 1;       // L2-4: 1 line
                else if (level <= 9) garbageCount = 2;  // L5-9: 2 lines
                else garbageCount = 3;                  // L10+: 3 lines

                addGarbageLines(garbageCount);
            }
        }

        if (linesCleared >= 4) {
            AudioSys.sfx.tetris();
            shakeScreen('big'); // Big shake for Tetris
        } else {
            AudioSys.sfx.clear();
            shakeScreen('small'); // Small shake for regular lines
        }
        updateHUD();
    }
}

function updateHUD() {
    scoreEl.innerText = score.toString().padStart(5, '0');
    levelEl.innerText = level;
    linesEl.innerText = lines;
}

function goHome() {
    isPlaying = false;
    gameOver = false;
    homeScreen.style.display = 'flex';
    gameContainer.style.display = 'none';
    overlay.style.display = 'none';
}

function addGarbageLines(n) {
    if (n <= 0) return;

    // Check for Game Over: if any block exists in the top n rows
    for (let y = 0; y < n; y++) {
        if (grid[y].some(val => val !== 0)) {
            gameOver = true;
            isPlaying = false;
            AudioSys.sfx.gameOver();
            overlay.style.display = 'flex';
            finalScoreEl.innerText = "SCORE: " + score;
            nameInputContainer.style.display = 'flex';
            gameOverButtons.style.display = 'none';
            playerNameInput.value = '';
            playerNameInput.focus();
            return;
        }
    }

    // Shift grid up
    for (let y = 0; y < ROWS - n; y++) {
        grid[y] = grid[y + n];
    }

    // Fill bottom n rows with garbage
    for (let y = ROWS - n; y < ROWS; y++) {
        const row = new Array(COLS).fill(8); // Index 8 is Gray
        // Create 1 to COLS-1 random holes to ensure it's not a full line (which would clear instantly)
        // Let's make it 1-3 holes for difficulty
        const holes = 1 + Math.floor(Math.random() * 2);
        for (let k = 0; k < holes; k++) {
            const holeIdx = Math.floor(Math.random() * COLS);
            row[holeIdx] = 0;
        }
        grid[y] = row;
    }

    shakeScreen('big');
    AudioSys.sfx.drop(); // Reuse drop sound for garbage rise
}

function startGame() {
    // UI Switch
    homeScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    overlay.style.display = 'none';

    // Init Logic
    AudioSys.init();
    initGrid();
    particles = [];
    bag = [];
    fillBag();
    piece = getPiece();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 800; // Start slightly faster than before
    gameOver = false;
    isPlaying = true;
    updateTheme();
    updateHUD();
    resize();

    lastTime = performance.now();
    requestAnimationFrame(update);
}

function drawRect(x, y, colorId) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    ctx.fillStyle = COLORS[colorId];
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(px, py, BLOCK_SIZE, 2);
    ctx.fillRect(px, py, 2, BLOCK_SIZE);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px + BLOCK_SIZE - 2, py, 2, BLOCK_SIZE);
    ctx.fillRect(px, py + BLOCK_SIZE - 2, BLOCK_SIZE, 2);

    if (BLOCK_SIZE > 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(px + 4, py + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
    }
}

function drawGridLines() {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas.width, i * BLOCK_SIZE);
        ctx.stroke();
    }
}

function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGridLines();

    grid.forEach((row, y) => {
        row.forEach((val, x) => {
            if (val !== 0) drawRect(x, y, val);
        });
    });

    if (piece) {
        piece.shape.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) drawRect(piece.x + x, piece.y + y, val);
            });
        });
    }

    drawParticles();
}

function drop() {
    if (!collide(piece, 0, 1)) {
        piece.y++;
        isTouchingGround = false;
    } else {
        if (!isTouchingGround) {
            isTouchingGround = true;
            lockDelayTimer = 0;
            movesResets = 0;
            AudioSys.sfx.drop();
        }
    }
}

function lockPiece() {
    merge(piece);
    clearLines();
    piece = getPiece();
    isTouchingGround = false;
    AudioSys.sfx.lock();
    if (collide(piece, 0, 0)) {
        gameOver = true;
        isPlaying = false;
        AudioSys.sfx.gameOver();
        shakeScreen('big');

        // Show Game Over Overlay
        setTimeout(() => {
            overlay.style.display = 'flex';
            finalScoreEl.innerText = "SCORE: " + score;
            // Show input, hide buttons
            nameInputContainer.style.display = 'flex';
            gameOverButtons.style.display = 'none';
            playerNameInput.value = '';
            playerNameInput.focus();
        }, 500);
    }
}

function update(time = 0) {
    if (!isPlaying) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    updateParticles();

    if (dropCounter > dropInterval) {
        drop();
        dropCounter = 0;
    }

    if (isTouchingGround) {
        lockDelayTimer += deltaTime;
        if (lockDelayTimer > LOCK_DELAY_MS) {
            if (collide(piece, 0, 1)) lockPiece();
            else isTouchingGround = false;
        }
    } else if (collide(piece, 0, 1)) {
        isTouchingGround = true;
        lockDelayTimer = 0;
        movesResets = 0;
    }
    draw();
    requestAnimationFrame(update);
}

/**
 * INPUT SYSTEM
 */
const Input = {
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    accX: 0,
    accY: 0,
    moveThreshold: 0,
    isSwiping: false,
    axisLocked: 'none',
    startTime: 0,
    isMouseDown: false,

    setup: function () {
        document.addEventListener('keydown', (e) => {
            if (!isPlaying) return;
            if (e.keyCode === 37 && !collide(piece, -1, 0)) { piece.x--; AudioSys.sfx.move(); }
            if (e.keyCode === 39 && !collide(piece, 1, 0)) { piece.x++; AudioSys.sfx.move(); }
            if (e.keyCode === 40 && !collide(piece, 0, 1)) { piece.y++; score++; }
            if (e.keyCode === 38) rotate(piece);
            if (e.keyCode === 32) {
                while (!collide(piece, 0, 1)) { piece.y++; score += 2; }
                lockPiece();
                shakeScreen('small'); // Shake on hard drop
            }
        });

        const handleStart = (x, y) => {
            if (!isPlaying) return;
            this.startX = x;
            this.startY = y;
            this.lastX = x;
            this.lastY = y;
            this.accX = 0;
            this.accY = 0;
            this.isSwiping = false;
            this.axisLocked = 'none';
            this.startTime = Date.now();
            this.moveThreshold = BLOCK_SIZE * 0.9;
        };

        const handleMove = (x, y) => {
            if (!isPlaying) return;

            const deltaX = x - this.lastX;
            const deltaY = y - this.lastY;

            if (this.axisLocked === 'none') {
                const totalDistX = Math.abs(x - this.startX);
                const totalDistY = Math.abs(y - this.startY);
                if (totalDistX > 10 || totalDistY > 10) {
                    if (totalDistY > totalDistX * 1.5) this.axisLocked = 'vertical';
                    else if (totalDistX > totalDistY * 1.5) this.axisLocked = 'horizontal';
                }
            }

            if (this.axisLocked === 'vertical') {
                this.accY += deltaY;
                this.accX = 0;
            } else if (this.axisLocked === 'horizontal') {
                this.accX += deltaX;
                this.accY = 0;
            } else {
                this.accX += deltaX;
                this.accY += deltaY;
            }

            while (Math.abs(this.accX) > this.moveThreshold) {
                const dir = this.accX > 0 ? 1 : -1;
                if (!collide(piece, dir, 0)) {
                    piece.x += dir;
                    AudioSys.sfx.move();
                    this.isSwiping = true;
                    if (isTouchingGround && movesResets < MAX_MOVES_RESET) {
                        lockDelayTimer = 0;
                        movesResets++;
                    }
                }
                this.accX -= (dir * this.moveThreshold);
            }

            const dropThreshold = this.moveThreshold * 0.8;
            while (this.accY > dropThreshold) {
                if (!collide(piece, 0, 1)) {
                    piece.y++;
                    score++;
                    updateHUD();
                    this.isSwiping = true;
                    lockDelayTimer = 0;
                }
                this.accY -= dropThreshold;
            }

            this.lastX = x;
            this.lastY = y;
        };

        const handleEnd = (x, y) => {
            if (!isPlaying) return;
            const distY = y - this.startY;
            const distX = x - this.startX;

            if (this.axisLocked !== 'horizontal' && distY > 60 && Math.abs(distX) < 40) {
                while (!collide(piece, 0, 1)) {
                    piece.y++;
                    score += 2;
                }
                lockPiece();
                AudioSys.sfx.drop();
                shakeScreen('small'); // Shake on flick drop
                return;
            }

            if (!this.isSwiping && Math.abs(distX) < 15 && Math.abs(distY) < 15) {
                rotate(piece);
            }
        };

        // Event Binding
        touchZone.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        touchZone.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        touchZone.addEventListener('touchend', (e) => { e.preventDefault(); handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: false });

        touchZone.addEventListener('mousedown', (e) => { this.isMouseDown = true; handleStart(e.clientX, e.clientY); });
        window.addEventListener('mousemove', (e) => { if (this.isMouseDown) handleMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup', (e) => { if (this.isMouseDown) { this.isMouseDown = false; handleEnd(e.clientX, e.clientY); } });
    }
};

// Buttons
document.getElementById('home-start-btn').addEventListener('click', startGame);
document.getElementById('home-scores-btn').addEventListener('click', () => { showLeaderboard(); });
document.getElementById('lb-back-btn').addEventListener('click', () => {
    leaderboardScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
});
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('home-btn').addEventListener('click', goHome);
document.getElementById('submit-score-btn').addEventListener('click', submitScore);


/**
 * LEADERBOARD LGOIC
 */
function getLeaderboard() {
    const scores = localStorage.getItem('atari_tetris_scores');
    return scores ? JSON.parse(scores) : [];
}

function saveScore(name, newScore) {
    let scores = getLeaderboard();
    scores.push({ name: name.toUpperCase() || 'ANON', score: newScore, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 20); // Keep top 20
    localStorage.setItem('atari_tetris_scores', JSON.stringify(scores));
}

function renderLeaderboard() {
    const scores = getLeaderboard();
    scoresListEl.innerHTML = '';
    if (scores.length === 0) {
        scoresListEl.innerHTML = '<div style="text-align:center; color:#666; margin-top:50px;">NO RECORDS YET</div>';
        return;
    }

    scores.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'score-entry';
        div.innerHTML = `
            <span class="score-rank">${index + 1}.</span>
            <span class="score-name">${entry.name}</span>
            <span class="score-val">${entry.score}</span>
        `;
        scoresListEl.appendChild(div);
    });
}

function showLeaderboard() {
    homeScreen.style.display = 'none';
    leaderboardScreen.style.display = 'flex';
    renderLeaderboard();
}

function submitScore() {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert("PLEASE ENTER YOUR NAME");
        return;
    }
    saveScore(name, score);

    // Switch to Leaderboard view
    overlay.style.display = 'none';
    gameContainer.style.display = 'none';
    leaderboardScreen.style.display = 'flex';
    renderLeaderboard();

    // Change back button behavior in leaderboard to go home
    document.getElementById('lb-back-btn').onclick = () => {
        leaderboardScreen.style.display = 'none';
        goHome();
        // Reset back button
        document.getElementById('lb-back-btn').onclick = () => {
            leaderboardScreen.style.display = 'none';
            homeScreen.style.display = 'flex';
        };
    };
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

Input.setup();
