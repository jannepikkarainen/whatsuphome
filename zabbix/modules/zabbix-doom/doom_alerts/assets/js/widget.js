'use strict';
console.log('[DoomAlerts] widget.js loading – CWidget defined:', typeof CWidget !== 'undefined');

/* ═══════════════════════════════════════════════════════════════════════════
   DOOM: Alert Slayer  –  Zabbix 7.0 custom widget
   ─────────────────────────────────────────────────────────────────────────
   DoomGame        – self-contained pseudo-3D raycasting engine (Doom-style)
   CDoomAlertsWidget – Zabbix CWidget wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── constants ─────────────────────────────────────────────────────────── */
const DOOM_W         = 320;
const DOOM_H         = 200;
const DOOM_HUD_H     = 36;
const DOOM_GAME_H    = DOOM_H - DOOM_HUD_H;
const DOOM_FOV       = Math.PI / 3;
const DOOM_HALF_FOV  = DOOM_FOV / 2;
const DOOM_PLANE_LEN = Math.tan(DOOM_HALF_FOV);
const DOOM_MAX_DIST  = 16;
const DOOM_SHOOT_CD  = 0.28;
// Demons only give chase once the player is within this many tiles; beyond
// it they idle in place. Keeps a map full of alerts from all charging the
// player at once — gives the player time to pick targets off at range.
const DOOM_AGGRO     = 6.5;

// Severity 0-5 → demon config. speed is in tiles/second (frame-rate independent).
// size is a fraction of full floor-to-ceiling wall height (see _drawSprites
// anchoring) — kept <=1.0 so even the biggest demon never stands taller
// than the room.
const SEVERITY_CFG = [
    { name:'Zombie',     color:[120,120,120], hp: 20,  speed:0.55, score:10,   size:0.52 },
    { name:'Imp',        color:[ 80,160,220], hp: 35,  speed:0.65, score:50,   size:0.60 },
    { name:'Demon',      color:[220,190, 30], hp: 60,  speed:0.75, score:100,  size:0.68 },
    { name:'Cacodemon',  color:[230,110, 20], hp:100,  speed:0.85, score:200,  size:0.78 },
    { name:'Baron',      color:[200,  0,  0], hp:180,  speed:0.95, score:500,  size:0.90 },
    { name:'Cyberdemon', color:[140,  0,200], hp:350,  speed:1.10, score:1000, size:1.00 },
];

const DOOM_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
    [1,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,1],
    [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
const MAP_W = DOOM_MAP[0].length;
const MAP_H = DOOM_MAP.length;

/* ═══════════════════════════════════════════════════════════════════════
   DoomGame – standalone raycasting engine
   ═══════════════════════════════════════════════════════════════════════ */
class DoomGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');

        // Offscreen pixel buffer at classic Doom resolution
        this.offscreen       = document.createElement('canvas');
        this.offscreen.width  = DOOM_W;
        this.offscreen.height = DOOM_H;
        this.offCtx  = this.offscreen.getContext('2d');
        this.imgData = this.offCtx.createImageData(DOOM_W, DOOM_H);
        this.buf32   = new Uint32Array(this.imgData.data.buffer);
        this.zBuf    = new Float64Array(DOOM_W);

        this.player = { x:2.5, y:2.5, angle:0, health:100, maxHealth:100, ammo:50, maxAmmo:50,
                        invuln:0, regenTimer:0 };
        this.godMode = false;
        this.enemies   = [];
        this.particles = [];

        this.keys         = new Set();
        this.mouseDX      = 0;
        this.pointerLocked= false;

        this.shootCooldown = 0;
        this.muzzleFlash   = 0;
        this.gunRecoil     = 0;
        this.gunBobTime    = 0;
        this.faceExpr      = 'normal';
        this.faceTimer     = 0;
        this.hitFlash      = 0;
        this.kills         = 0;
        this.score         = 0;
        this.state         = 'intro';
        this.focused       = false;

        this.onKill = null; // (alertId, eventId, name) => void

        this._wallTex     = this._makeWallTexture();
        this._demonSprites = SEVERITY_CFG.map((cfg, i) => this._bakeDemonSprite(cfg, i));
        this._lastTs  = 0;
        this._rafId   = null;

        // "Real DOOM" mode: the actual id Software engine compiled to WASM
        // (doomgeneric), replacing this canvas. See _launchRealDoom().
        this._realDoomActive   = false;
        this._realDoomEl       = null;
        this._realDoomMount    = null;
        this._realDoomPendingEl= null;
        this._wasmModule       = null;
        this._wasmSyncInterval = null;
        this._wasmNextTag      = 1;
        this._wasmTagMap       = new Map(); // int tag -> enemy object
        this._lastBtnState     = null;

        this._bindInput();
        this._buildMobileControls();
        this._buildRealDoomButton();
    }

    /* ── input ──────────────────────────────────────────────────────── */
    _bindInput() {
        const c = this.canvas;
        c.setAttribute('tabindex', '0');

        c.addEventListener('keydown', e => {
            this.keys.add(e.code);
            if (e.code === 'Space') { this._shoot(); e.preventDefault(); }
            if (e.code === 'KeyG' && this.state === 'playing') {
                this.godMode = !this.godMode;
                if (this.godMode) this.player.health = this.player.maxHealth;
            }
            if (e.code === 'KeyR' && this.state === 'intro' && !this._realDoomActive) {
                this._launchRealDoom();
            }
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                 'KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
        });
        c.addEventListener('keyup', e => this.keys.delete(e.code));

        c.addEventListener('click', e => {
            if (!this.focused) { this.focused = true; return; }
            if (this.state === 'intro') { this._startGame(); return; }
            if (this.state === 'dead')  { this._restartGame(); return; }
            c.requestPointerLock?.();
            this._shoot();
        });

        c.addEventListener('mousedown', e => {
            if (e.button === 0 && this.state === 'playing') this._shoot();
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = (document.pointerLockElement === c);
        });

        c.addEventListener('mousemove', e => {
            if (this.pointerLocked) this.mouseDX += e.movementX * 0.004;
        });
    }

    _buildMobileControls() {
        const wrap = this.canvas.parentElement;
        if (!wrap) return;

        this._mobileEls = [];

        const dpad = document.createElement('div');
        dpad.className = 'doom-dpad';
        const grid = [
            [null, 'KeyW', null],
            ['KeyA', null,  'KeyD'],
            [null, 'KeyS',  null],
        ];
        const labels = { KeyW:'↑', KeyA:'←', KeyD:'→', KeyS:'↓' };
        grid.flat().forEach(code => {
            const b = document.createElement('button');
            if (!code) { b.disabled = true; b.style.opacity = '0'; }
            else {
                b.textContent = labels[code];
                b.addEventListener('pointerdown', () => this.keys.add(code));
                b.addEventListener('pointerup',   () => this.keys.delete(code));
                b.addEventListener('pointerleave',() => this.keys.delete(code));
            }
            dpad.appendChild(b);
        });
        wrap.appendChild(dpad);
        this._mobileEls.push(dpad);

        const fire = document.createElement('button');
        fire.className = 'doom-fire-btn';
        fire.textContent = '🔫';
        fire.addEventListener('pointerdown', () => this._shoot());
        wrap.appendChild(fire);
        this._mobileEls.push(fire);

        ['◄','►'].forEach((sym, i) => {
            const b = document.createElement('button');
            b.style.cssText = `position:absolute;bottom:56px;${i===0?'right:104px':'right:20px'};
                width:40px;height:40px;border-radius:4px;background:rgba(100,0,0,.7);
                border:1px solid #800;color:#fff;font-size:18px;cursor:pointer;
                touch-action:none;user-select:none;opacity:.6`;
            b.textContent = sym;
            const code = i === 0 ? 'KeyQ' : 'KeyE';
            b.addEventListener('pointerdown', () => this.keys.add(code));
            b.addEventListener('pointerup',   () => this.keys.delete(code));
            b.addEventListener('pointerleave',() => this.keys.delete(code));
            wrap.appendChild(b);
            this._mobileEls.push(b);
        });
    }

    /* ── wall textures (64×64, pre-baked into Uint32) ───────────────
       Two alternating styles like Doom's tech-base levels: rusty metal
       panels (with rivets) and mossy brick. Picked per-cell so walls
       read as distinct panels instead of one flat noisy blob. ─────── */
    _makeWallTexture() {
        return { metal: this._bakeMetalTex(), brick: this._bakeBrickTex(), S: 64 };
    }

    _bakeMetalTex() {
        const S = 64, buf = new Uint32Array(S*S);
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const panel  = (Math.floor(x/16) + Math.floor(y/32)) & 1;
                const border = (x % 16 < 1) || (y % 32 < 1);
                const n      = Math.sin(x*0.6+y*0.3)*6 + Math.sin(x*0.13-y*0.21)*5;
                let r,g,b;
                if (border) { r=18; g=20; b=18; }
                else {
                    const base = (panel ? 78 : 68) + n;
                    r=(base*0.75)|0; g=(base*0.95)|0; b=(base*0.80)|0;
                    // rivets at panel corners
                    const rx = x % 16, ry = y % 32;
                    if ((rx===3||rx===12) && (ry===3||ry===28)) { r=140;g=150;b=140; }
                }
                buf[y*S+x] = (255<<24)|((b|0)<<16)|((g|0)<<8)|(r|0);
            }
        }
        return buf;
    }

    _bakeBrickTex() {
        const S = 64, buf = new Uint32Array(S*S);
        for (let y = 0; y < S; y++) {
            const brow = Math.floor(y/16);
            const off  = (brow & 1) ? 16 : 0;
            const hm   = (y % 16) === 0;
            for (let x = 0; x < S; x++) {
                const vm = ((x+off) % 32) === 0;
                let r,g,b;
                if (hm || vm) { r=22; g=18; b=16; }
                else {
                    const n = Math.sin(x*0.37+y*0.19)*14 + Math.sin(x*0.08+y*0.5)*8;
                    const mossy = ((Math.floor((x+off)/32) + brow) % 5) === 0;
                    const base = 96 + n;
                    if (mossy) { r=(base*0.55)|0; g=(base*0.75)|0; b=(base*0.45)|0; }
                    else       { r=(base*0.95)|0; g=(base*0.55)|0; b=(base*0.42)|0; }
                }
                buf[y*S+x] = (255<<24)|((b|0)<<16)|((g|0)<<8)|(r|0);
            }
        }
        return buf;
    }

    /* ── demon sprites (baked once per severity as a small pixel-art
       bitmap, then nearest-neighbour sampled — reads as a blocky Doom
       monster sprite instead of a procedural blob). Each severity gets
       its own silhouette instead of one shared humanoid template, echoing
       the classic Doom roster: trooper → imp → demon → cacodemon → baron
       → cyberdemon. Coordinate system: origin at bottom-centre (feet on
       the floor line), y grows *upward* as negative, matching how
       _drawSprites anchors the sprite to the floor. ──────────────────── */
    _bakeDemonSprite(cfg, sev) {
        const [r,g,b] = cfg.color;
        const W = 112, H = 120;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const skin    = `rgb(${r},${g},${b})`;
        const shade   = `rgb(${(r*0.55)|0},${(g*0.55)|0},${(b*0.55)|0})`;
        const dark    = `rgb(${(r*0.32)|0},${(g*0.32)|0},${(b*0.32)|0})`;
        const outline = `rgb(${(r*0.16)|0},${(g*0.16)|0},${(b*0.16)|0})`;
        const eyeCol  = sev >= 4 ? '#ffee33' : '#ff2200';

        ctx.save();
        ctx.translate(W/2, H);   // (0,0) = floor line, y negative = up
        ctx.lineJoin = 'round';
        ctx.strokeStyle = outline; ctx.lineWidth = 2;

        const glowEyes = (cx, cy, rad, spread) => {
            ctx.shadowColor = eyeCol; ctx.shadowBlur = 5;
            ctx.fillStyle = eyeCol;
            [-1,1].forEach(s => { ctx.beginPath(); ctx.arc(cx+s*spread, cy, rad, 0, Math.PI*2); ctx.fill(); });
            ctx.shadowBlur = 0;
        };
        const horns = (baseY, spreadX, len, tilt) => {
            ctx.fillStyle = '#d8cfa8'; ctx.lineWidth = 1.5;
            [-1,1].forEach(s => {
                ctx.beginPath();
                ctx.moveTo(s*spreadX*0.5, baseY);
                ctx.lineTo(s*(spreadX+len*tilt), baseY-len);
                ctx.lineTo(s*spreadX*1.3, baseY-len*0.15);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            });
        };
        const teethRow = (cx, y, w, n, up) => {
            ctx.fillStyle = '#eee';
            const step = w*2/n;
            for (let i=0;i<n;i++) {
                const x0 = cx-w+i*step;
                ctx.beginPath();
                ctx.moveTo(x0, y); ctx.lineTo(x0+step*0.5, y+(up?-5:5)); ctx.lineTo(x0+step, y);
                ctx.closePath(); ctx.fill();
            }
        };

        if (sev === 0) {
            /* ── Zombie trooper: gaunt human silhouette, sidearm raised ── */
            ctx.fillStyle = dark;
            [-1,1].forEach(s => { ctx.beginPath(); ctx.rect(s*9-3, -26, 7, 26); ctx.fill(); ctx.stroke(); });
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.rect(-11, -50, 22, 25); ctx.fill(); ctx.stroke();
            ctx.fillStyle = shade; ctx.beginPath(); ctx.rect(2, -50, 9, 25); ctx.fill();
            ctx.fillStyle = dark; ctx.beginPath(); ctx.rect(-11, -30, 22, 5); ctx.fill(); // belt
            // arms — left hangs, right raised holding pistol
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.rect(-17, -46, 6, 20); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.rect(11, -50, 6, 16); ctx.fill(); ctx.stroke();
            ctx.fillStyle = outline; ctx.beginPath(); ctx.rect(15, -54, 10, 5); ctx.fill();
            // head
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0, -58, 9, 10, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            glowEyes(0, -59, 2, 4);
            ctx.strokeStyle = outline; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(-4,-52); ctx.lineTo(4,-52); ctx.stroke();

        } else if (sev === 1) {
            /* ── Imp: hunched, spiny, clawed ── */
            ctx.fillStyle = dark;
            [-1,1].forEach(s => { ctx.beginPath(); ctx.rect(s*10-4, -20, 8, 20); ctx.fill(); ctx.stroke(); });
            // hunched leaning torso
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.moveTo(-14,-18); ctx.lineTo(-16,-38); ctx.lineTo(-6,-48);
            ctx.lineTo(12,-46); ctx.lineTo(15,-30); ctx.lineTo(10,-18);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // back spikes
            ctx.fillStyle = shade;
            for (let i=0;i<4;i++) {
                const yy = -22-i*7;
                ctx.beginPath(); ctx.moveTo(-14,yy); ctx.lineTo(-21,yy-5); ctx.lineTo(-12,yy-4); ctx.closePath(); ctx.fill();
            }
            // arms with claws
            [-1,1].forEach(s => {
                ctx.fillStyle = skin;
                ctx.beginPath(); ctx.rect(s*18-4, -40, 8, 20); ctx.fill(); ctx.stroke();
                ctx.fillStyle = outline;
                for (let i=-1;i<=1;i++) {
                    ctx.beginPath(); ctx.moveTo(s*18-4+4+i*3,-20); ctx.lineTo(s*18-4+4+i*3+s*2,-14); ctx.lineTo(s*18-4+4+i*3-1,-20);
                    ctx.closePath(); ctx.fill();
                }
            });
            // head with brow + horns
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(-1,-52,10,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            horns(-58, 6, 10, 0.6);
            glowEyes(-1, -53, 2.2, 4.5);
            teethRow(-1, -46, 5, 4, true);

        } else if (sev === 2) {
            /* ── Demon (Pinky): low, wide quadruped, huge mouth ── */
            ctx.fillStyle = shade;
            for (let i=0;i<2;i++) [-1,1].forEach(s => {
                ctx.beginPath(); ctx.rect(s*(9+i*10)-4, -12, 8, 12); ctx.fill(); ctx.stroke();
            });
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0,-26,24,16,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            // beady eyes on top
            glowEyes(0, -36, 1.8, 7);
            // huge front mouth
            ctx.fillStyle = '#200';
            ctx.beginPath(); ctx.ellipse(0,-22,14,9,0,0,Math.PI*2); ctx.fill();
            teethRow(0, -25, 12, 6, false);
            teethRow(0, -19, 12, 6, true);

        } else if (sev === 3) {
            /* ── Cacodemon: floating ball, one giant eye ── */
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.beginPath(); ctx.ellipse(0,-4,16,4,0,0,Math.PI*2); ctx.fill(); // ground shadow
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0,-46,24,26,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = shade;
            ctx.beginPath(); ctx.ellipse(10,-40,14,20,0,0,Math.PI*2); ctx.fill();
            // stubby wings
            ctx.fillStyle = dark;
            [-1,1].forEach(s => {
                ctx.beginPath(); ctx.moveTo(s*22,-52); ctx.lineTo(s*34,-46); ctx.lineTo(s*22,-38);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            });
            // horn
            ctx.fillStyle = '#d8cfa8';
            ctx.beginPath(); ctx.moveTo(-5,-70); ctx.lineTo(0,-84); ctx.lineTo(5,-70); ctx.closePath(); ctx.fill(); ctx.stroke();
            // one giant eye
            ctx.fillStyle = '#ffe27a';
            ctx.beginPath(); ctx.arc(0,-48,11,0,Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.shadowColor = eyeCol; ctx.shadowBlur = 6;
            ctx.fillStyle = eyeCol;
            ctx.beginPath(); ctx.arc(0,-48,5,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            // mouth with fangs, underside
            ctx.fillStyle = '#200';
            ctx.beginPath(); ctx.ellipse(0,-26,12,7,0,0,Math.PI*2); ctx.fill();
            teethRow(0, -29, 10, 5, false);
            teethRow(0, -24, 10, 5, true);

        } else if (sev === 4) {
            /* ── Baron of Hell: tall, muscular, curled horns, hooves ── */
            ctx.fillStyle = dark;
            [-1,1].forEach(s => {
                ctx.beginPath(); ctx.rect(s*13-6, -28, 11, 26); ctx.fill(); ctx.stroke();
                ctx.fillStyle = outline; ctx.beginPath(); ctx.moveTo(s*13-6,-2); ctx.lineTo(s*13+5,-2); ctx.lineTo(s*13-1,4); ctx.closePath(); ctx.fill();
                ctx.fillStyle = dark;
            });
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.moveTo(-20,-26); ctx.lineTo(-24,-52); ctx.lineTo(-13,-64);
            ctx.lineTo(13,-64); ctx.lineTo(24,-52); ctx.lineTo(20,-26);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = shade;
            ctx.beginPath(); ctx.moveTo(3,-64); ctx.lineTo(24,-52); ctx.lineTo(20,-26); ctx.lineTo(2,-26); ctx.closePath(); ctx.fill();
            // muscle lines
            ctx.strokeStyle = outline; ctx.lineWidth = 1.2;
            [-9,9].forEach(x => { ctx.beginPath(); ctx.moveTo(x,-56); ctx.lineTo(x,-30); ctx.stroke(); });
            ctx.strokeStyle = outline; ctx.lineWidth = 2;
            [-1,1].forEach(s => {
                ctx.fillStyle = skin;
                ctx.beginPath(); ctx.rect(s*27-6, -58, 12, 28); ctx.fill(); ctx.stroke();
                ctx.fillStyle = outline;
                ctx.beginPath(); ctx.moveTo(s*27-6,-30); ctx.lineTo(s*27+6,-30); ctx.lineTo(s*27,-22); ctx.closePath(); ctx.fill();
            });
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0,-70,12,11,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            horns(-78, 8, 16, 1.1);
            glowEyes(0, -71, 2.6, 5.5);
            teethRow(0, -63, 6, 5, true);

        } else {
            /* ── Cyberdemon: goat-legged war machine, cannon arm ── */
            const metal = '#8a8f96', metalDk = '#4a4d52', metalLt = '#c4c8cc';
            // mechanical digitigrade legs with a visible knee joint
            [-1,1].forEach(s => {
                const mx = vx => s*vx; // mirror helper: keeps polygon winding valid on both legs
                ctx.fillStyle = metal;
                ctx.beginPath(); ctx.rect(s*14-6, -46, 11, 22); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(mx(7),-24); ctx.lineTo(mx(22),-24); ctx.lineTo(mx(20),-4); ctx.lineTo(mx(8),-4);
                ctx.closePath(); ctx.fillStyle = metalDk; ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#222';
                ctx.beginPath(); ctx.rect(s>0 ? 14 : -24, -6, 10, 6); ctx.fill(); ctx.stroke();
                ctx.fillStyle = metalLt;
                ctx.beginPath(); ctx.arc(s*14,-24,3,0,Math.PI*2); ctx.fill();
            });
            // broad organic torso
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.moveTo(-22,-44); ctx.lineTo(-27,-66); ctx.lineTo(-14,-78);
            ctx.lineTo(14,-78); ctx.lineTo(27,-66); ctx.lineTo(22,-44);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = shade;
            ctx.beginPath(); ctx.moveTo(4,-78); ctx.lineTo(27,-66); ctx.lineTo(22,-44); ctx.lineTo(3,-44); ctx.closePath(); ctx.fill();
            // left arm: normal clawed limb
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.rect(-38,-70,10,26); ctx.fill(); ctx.stroke();
            ctx.fillStyle = outline;
            for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.moveTo(-38+5+i*3,-44); ctx.lineTo(-38+5+i*3-2,-38); ctx.lineTo(-38+5+i*3+1,-44); ctx.closePath(); ctx.fill(); }
            // right arm: rocket cannon
            ctx.fillStyle = metal;
            ctx.beginPath(); ctx.rect(24,-70,10,20); ctx.fill(); ctx.stroke();
            ctx.fillStyle = metalDk;
            ctx.beginPath(); ctx.rect(20,-52,20,12); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.ellipse(40,-46,4,6,0,0,Math.PI*2); ctx.fill();
            // small head with horns
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0,-82,10,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            horns(-89, 7, 13, 1.0);
            glowEyes(0, -83, 2.4, 5);

        }

        ctx.restore();

        // Crop to the actual drawn silhouette. Creatures fill very different
        // fractions of the shared canvas (Cyberdemon nearly all of it, the
        // squat Demon much less) — without cropping, the per-severity
        // `size` scaling in SEVERITY_CFG would be diluted by however much
        // transparent padding each creature happens to have.
        const full = ctx.getImageData(0, 0, W, H);
        const fbuf = new Uint32Array(full.data.buffer);
        let minX=W, minY=H, maxX=-1, maxY=-1;
        for (let y=0; y<H; y++) {
            for (let x=0; x<W; x++) {
                if ((fbuf[y*W+x] >>> 24) & 0xFF) {
                    if (x<minX) minX=x; if (x>maxX) maxX=x;
                    if (y<minY) minY=y; if (y>maxY) maxY=y;
                }
            }
        }
        if (maxX < 0) { minX=0; minY=0; maxX=W-1; maxY=H-1; }
        const cw = maxX-minX+1, ch = maxY-minY+1;
        const cropped = ctx.getImageData(minX, minY, cw, ch);
        return { buf: new Uint32Array(cropped.data.buffer), W: cw, H: ch };
    }

    /* ── lifecycle ──────────────────────────────────────────────────── */
    _startGame() {
        this.state   = 'playing';
        this.focused = true;
        this.canvas.focus();
        this.canvas.requestPointerLock?.();
    }

    _restartGame() {
        Object.assign(this.player, { x:2.5, y:2.5, angle:0, health:100, ammo:50, invuln:0, regenTimer:0 });
        this.enemies = []; this.particles = [];
        this.kills = 0; this.score = 0;
        this.hitFlash = 0; this.faceExpr = 'normal';
        this.state = 'playing';
        this.canvas.focus();
        this.canvas.requestPointerLock?.();
    }

    start() {
        if (this._rafId) return;
        const loop = ts => {
            const dt = Math.min((ts - this._lastTs) / 1000, 0.05);
            this._lastTs = ts;
            this._update(dt);
            this._render();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(ts => { this._lastTs = ts; this._rafId = requestAnimationFrame(loop); });
    }

    stop() {
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    /** Move the game to a new canvas (e.g. after Zabbix widget HTML refresh). */
    rebindCanvas(canvas) {
        const wasRunning = !!this._rafId;
        if (wasRunning) this.stop();
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this._bindInput();
        this._buildMobileControls();
        this._buildRealDoomButton();
        if (this._realDoomActive && this._realDoomEl) {
            // Zabbix rebuilt the widget's DOM; re-attach the still-running WASM
            // module's DOM (same node, so the running game is untouched) to the new wrap.
            canvas.parentElement.appendChild(this._realDoomEl);
            this._setCanvasControlsVisible(false);
        } else if (wasRunning) {
            this.start();
        }
    }

    /* ── "Real DOOM" mode: the actual id Software engine, compiled to WASM ──
       This is doomgeneric (https://github.com/ozkl/doomgeneric — a portable
       build of id's own GPL-released DOOM source) built for this widget with
       a couple of small hooks (see doomgeneric_src/doomgeneric/doomgeneric_widget.c
       and the dg_alertTag field added to mobj_t in p_mobj.h): DG_ListMonsters()
       lists the level's live untagged monsters, DG_TagMonster() links one to an
       alert, and P_KillMobj (p_inter.c) calls back into JS the instant a tagged
       monster dies — so shooting an actual DOOM monster acknowledges the real
       alert it's linked to. No overlay, no fake sprites: whatever's on screen
       IS the alert.
       Boots straight into E1M1 via `-warp 1` (skips the title/menu entirely —
       nothing to fumble through in a small dashboard tile). Built MODULARIZE=1
       so each widget instance on a dashboard gets its own isolated module. ─── */
    _buildRealDoomButton() {
        const wrap = this.canvas.parentElement;
        if (!wrap) return;
        const btn = document.createElement('button');
        btn.className = 'doom-realdoom-btn';
        btn.textContent = '💿 PLAY REAL DOOM';
        btn.addEventListener('click', e => { e.stopPropagation(); this._launchRealDoom(); });
        wrap.appendChild(btn);
        this._realDoomBtn = btn;
        this._syncRealDoomBtn();
    }

    _syncRealDoomBtn() {
        if (this._realDoomBtn) {
            this._realDoomBtn.style.display =
                (this.state === 'intro' && !this._realDoomActive) ? 'block' : 'none';
        }
    }

    _setCanvasControlsVisible(show) {
        this.canvas.style.display = show ? '' : 'none';
        (this._mobileEls || []).forEach(el => { el.style.display = show ? '' : 'none'; });
    }

    _launchRealDoom() {
        if (this._realDoomActive) return;
        this._realDoomActive = true;
        this.stop();
        this._setCanvasControlsVisible(false);
        this._syncRealDoomBtn();

        const wrap = this.canvas.parentElement;
        if (this._realDoomEl) {
            this._realDoomEl.style.display = '';
            wrap.appendChild(this._realDoomEl);
            this._startWasmTagSync();
            return;
        }

        const el = document.createElement('div');
        el.className = 'doom-realdoom-wrap';
        const back = document.createElement('button');
        back.className = 'doom-realdoom-back';
        back.textContent = '◀ BACK TO ALERT MODE';
        back.addEventListener('click', () => this._exitRealDoom());
        const mount = document.createElement('div');
        mount.className = 'doom-realdoom-mount';
        const pending = document.createElement('div');
        pending.className = 'doom-realdoom-pending';
        pending.style.display = 'none';
        el.appendChild(back);
        el.appendChild(mount);
        el.appendChild(pending);
        wrap.appendChild(el);
        this._realDoomEl        = el;
        this._realDoomMount     = mount;
        this._realDoomPendingEl = pending;
        this._loadRealDoom(mount);
    }

    _exitRealDoom() {
        this._realDoomActive = false;
        if (this._realDoomEl) this._realDoomEl.style.display = 'none';
        this._stopWasmTagSync();
        this._setCanvasControlsVisible(true);
        this._syncRealDoomBtn();
        this.canvas.focus();
        this.start();
    }

    async _loadRealDoom(mount) {
        mount.innerHTML = '<div class="doom-realdoom-loading">Booting id Software’s actual DOOM engine<br>'
            + '(compiled to WebAssembly)…</div>';
        try {
            await DoomGame._ensureDoomWasmScript();
            mount.innerHTML = '';
            const canvas = document.createElement('canvas');
            canvas.width  = 320;
            canvas.height = 200;
            canvas.className = 'doom-realdoom-canvas';
            mount.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            let imgData = null;

            this._wasmModule = await window.createDoomWidgetModule({
                // Don't rely on document.currentScript auto-detection (unreliable
                // for a dynamically-injected script) to find doomwidget.wasm/.data —
                // point it at the same place we loaded doomwidget.js from.
                locateFile: (path) => DoomGame._wasmAssetUrl(path),
                dgPresentFrame: function (ptr, w, h) {
                    if (!imgData || imgData.width !== w || imgData.height !== h) {
                        imgData = ctx.createImageData(w, h);
                    }
                    imgData.data.set(this.HEAPU8.subarray(ptr, ptr + w * h * 4));
                    ctx.putImageData(imgData, 0, 0);
                },
                dgOnMonsterKilled: (tag) => this._onWasmMonsterKilled(tag),
                print: () => {}, printErr: () => {},
            });

            this._wasmNextTag = 1;
            this._wasmTagMap  = new Map(); // int tag -> enemy object
            this._bindWasmInput(canvas);
            this._startWasmTagSync();
        } catch (err) {
            mount.innerHTML = '<div class="doom-realdoom-error">Could not load the real DOOM engine.<br>'
                + (err?.message || err) + '</div>';
        }
    }

    /** Same-origin URL of a doomwasm/ asset, derived from this <script>'s own src
     *  so it works regardless of the Zabbix install's base path/subdirectory. */
    static _wasmAssetUrl(file) {
        const marker = '/assets/js/widget.js';
        for (const s of document.getElementsByTagName('script')) {
            const idx = (s.src || '').indexOf(marker);
            if (idx !== -1) return s.src.slice(0, idx) + '/assets/doomwasm/' + file;
        }
        return 'assets/doomwasm/' + file;
    }

    /** Loads the compiled doomgeneric module script once; shared across every
     *  widget instance (each still gets its own module — see MODULARIZE above). */
    static _ensureDoomWasmScript() {
        if (window.createDoomWidgetModule) return Promise.resolve();
        if (DoomGame._doomWasmScriptPromise) return DoomGame._doomWasmScriptPromise;
        DoomGame._doomWasmScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src     = DoomGame._wasmAssetUrl('doomwidget.js');
            script.onload  = () => resolve();
            script.onerror = () => reject(new Error('failed to load doomwidget.js'));
            document.head.appendChild(script);
        });
        return DoomGame._doomWasmScriptPromise;
    }

    /** Keyboard-only controls (vanilla DOOM has no mouse-look hook in doomgeneric's
     *  platform API) — arrows to move/turn, WASD mirrors the raycaster's own
     *  scheme, Ctrl/click to fire, Space to use switches/doors. */
    _bindWasmInput(canvas) {
        const KEY = { up:0xad, down:0xaf, left:0xac, right:0xae,
                      strafeL:0xa0, strafeR:0xa1, fire:0xa3, use:0xa2, enter:13 };
        const send = (pressed, code) => this._wasmModule?.ccall(
            'DG_AddKey', null, ['number', 'number'], [pressed ? 1 : 0, code]);
        const map = e => {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': return KEY.up;
                case 'ArrowDown':  case 'KeyS': return KEY.down;
                case 'ArrowLeft':               return KEY.left;
                case 'ArrowRight':              return KEY.right;
                case 'KeyA':                    return KEY.strafeL;
                case 'KeyD':                    return KEY.strafeR;
                case 'ControlLeft': case 'ControlRight': return KEY.fire;
                case 'Space':                   return KEY.use;
                case 'Enter':                   return KEY.enter;
                default: return null;
            }
        };
        canvas.setAttribute('tabindex', '0');
        canvas.addEventListener('keydown', e => {
            const code = map(e);
            if (code != null) { send(true, code); e.preventDefault(); }
        });
        canvas.addEventListener('keyup', e => {
            const code = map(e);
            if (code != null) { send(false, code); e.preventDefault(); }
        });
        canvas.addEventListener('mousedown', e => { if (e.button === 0) { canvas.focus(); send(true, KEY.fire); } });
        canvas.addEventListener('mouseup',   e => { if (e.button === 0) send(false, KEY.fire); });
        canvas.addEventListener('click', () => canvas.focus());
        canvas.addEventListener('blur', () => Object.values(KEY).forEach(c => send(false, c)));
        canvas.focus();
    }

    /* ── alert <-> monster tag sync ─────────────────────────────────────
       this.enemies is the same canonical alert list the raycaster uses
       (addAlert/removeAlert are unchanged and mode-agnostic). Every tick
       here just looks for alerts not yet linked to a WASM monster and
       hands them out against whatever untagged live monsters the level
       currently has. A level's monster count is fixed and usually smaller
       than the live alert count, so extras just wait their turn — shown
       as a small pending count rather than not shown at all. ────────── */
    _startWasmTagSync() {
        this._stopWasmTagSync();
        this._wasmSyncInterval = setInterval(() => this._wasmSyncTags(), 1000);
        this._wasmSyncTags();
    }

    _stopWasmTagSync() {
        if (this._wasmSyncInterval) { clearInterval(this._wasmSyncInterval); this._wasmSyncInterval = null; }
    }

    _wasmSyncTags() {
        const mod = this._wasmModule;
        if (!mod) return;
        const untagged = this.enemies.filter(e => !e.dead && e.wasmTag == null);
        if (this._realDoomPendingEl) {
            this._realDoomPendingEl.style.display = untagged.length ? 'block' : 'none';
            this._realDoomPendingEl.textContent = `⏳ ${untagged.length} more alert${untagged.length === 1 ? '' : 's'} waiting for a target…`;
        }
        if (untagged.length === 0) return;

        const MAX = 32;
        const idsPtr = mod._malloc(MAX * 4), typesPtr = mod._malloc(MAX * 4), healthsPtr = mod._malloc(MAX * 4);
        const n = mod.ccall('DG_ListMonsters', 'number',
            ['number', 'number', 'number', 'number'], [idsPtr, typesPtr, healthsPtr, MAX]);
        const ids = Array.from(mod.HEAP32.subarray(idsPtr / 4, idsPtr / 4 + n));
        mod._free(idsPtr); mod._free(typesPtr); mod._free(healthsPtr);

        for (let i = 0; i < ids.length && i < untagged.length; i++) {
            const enemy = untagged[i];
            const tag = this._wasmNextTag++;
            enemy.wasmTag = tag;
            this._wasmTagMap.set(tag, enemy);
            mod.ccall('DG_TagMonster', null, ['number', 'number'], [ids[i], tag]);
        }
    }

    _onWasmMonsterKilled(tag) {
        const enemy = this._wasmTagMap?.get(tag);
        this._wasmTagMap?.delete(tag);
        if (!enemy) return;
        this.kills++;
        this.score += SEVERITY_CFG[enemy.severity]?.score ?? 100;
        if (this.onKill) this.onKill(enemy.alertId, enemy.eventId, enemy.name);
        this.enemies = this.enemies.filter(e => e !== enemy);
    }

    /* ── shooting ───────────────────────────────────────────────────── */
    _shoot() {
        if (this.state !== 'playing' || this.shootCooldown > 0) return;
        if (!this.godMode && this.player.ammo <= 0) return;
        if (!this.godMode) this.player.ammo--;
        this.shootCooldown = DOOM_SHOOT_CD;
        this.muzzleFlash   = 0.12;
        this.gunRecoil     = 1.0;
        if (this.player.ammo < 3) this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 8);

        const t = this._rayCastEnemy(this.player.angle);
        if (t) {
            t.hp -= 30 + Math.random() * 25;
            t.painTimer = 0.18;
            this._spawnBlood(t.x, t.y, 10);
            if (t.hp <= 0) this._killEnemy(t);
        }
    }

    _rayCastEnemy(angle) {
        let best = null, bestDist = Infinity;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dx = e.x - this.player.x, dy = e.y - this.player.y;
            const dist = Math.hypot(dx, dy);
            let a = Math.atan2(dy, dx) - angle;
            while (a >  Math.PI) a -= Math.PI*2;
            while (a < -Math.PI) a += Math.PI*2;
            const half = (SEVERITY_CFG[e.severity]?.size ?? 0.8) * 0.5 / dist;
            if (Math.abs(a) > half + 0.08) continue;
            const col = Math.floor(((a / DOOM_FOV) + 0.5) * DOOM_W);
            if (col < 0 || col >= DOOM_W) continue;
            if (dist >= this.zBuf[col] - 0.1) continue;
            if (dist < bestDist) { bestDist = dist; best = e; }
        }
        return best;
    }

    _killEnemy(enemy) {
        enemy.dead = true; enemy.deathTimer = 0;
        this.kills++;
        this.score += SEVERITY_CFG[enemy.severity]?.score ?? 100;
        this._spawnBlood(enemy.x, enemy.y, 24);
        if (this.onKill) this.onKill(enemy.alertId, enemy.eventId, enemy.name);
    }

    /* ── alert management (called by widget) ────────────────────────── */
    addAlert(alert) {
        const id = String(alert.eventid ?? alert.alertid);
        if (this.enemies.find(e => e.alertId === id)) return;
        const sev = Math.min(5, Math.max(0, parseInt(alert.severity) || 3));
        const cfg = SEVERITY_CFG[sev];
        let sx, sy, tries = 0;
        do {
            sx = 1.5 + Math.floor(Math.random() * (MAP_W-3)) + Math.random()*0.8;
            sy = 1.5 + Math.floor(Math.random() * (MAP_H-3)) + Math.random()*0.8;
            tries++;
        } while (tries < 80 && (
            DOOM_MAP[Math.floor(sy)]?.[Math.floor(sx)] === 1 ||
            Math.hypot(sx - this.player.x, sy - this.player.y) < 3.5
        ));
        const enemy = {
            alertId: id, eventId: String(alert.eventid ?? id),
            name: String(alert.name ?? 'Alert').substring(0, 40),
            host: String(alert.hosts?.[0]?.name ?? alert.host ?? '?').substring(0, 20),
            severity: sev, x: sx, y: sy,
            hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed,
            dead: false, deathTimer: 0, painTimer: 0,
            walkAnim: Math.random() * Math.PI * 2, attackTimer: 0,
        };
        this.enemies.push(enemy);
    }

    removeAlert(id) {
        id = String(id);
        this.enemies = this.enemies.filter(e => e.alertId !== id);
    }

    /* ── particles ──────────────────────────────────────────────────── */
    _spawnBlood(x, y, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.02 + Math.random() * 0.05;
            this.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
                life: 0.4 + Math.random()*0.6, r: 150+(Math.random()*60|0), g:0, b:0 });
        }
    }

    /* ── update ─────────────────────────────────────────────────────── */
    _update(dt) {
        if (this._lastBtnState !== this.state) {
            this._lastBtnState = this.state;
            this._syncRealDoomBtn();
        }
        if (this.state !== 'playing') return;
        this._updateInput(dt);
        this._updateEnemies(dt);
        this.particles = this.particles.filter(p => {
            p.life -= dt; p.x += p.vx; p.y += p.vy; return p.life > 0;
        });
        this.shootCooldown = Math.max(0, this.shootCooldown - dt);
        this.muzzleFlash   = Math.max(0, this.muzzleFlash   - dt);
        this.hitFlash      = Math.max(0, this.hitFlash       - dt);
        this.faceTimer     = Math.max(0, this.faceTimer       - dt);
        this.gunRecoil     = Math.max(0, this.gunRecoil - dt * 6);
        const p = this.player;
        p.invuln = Math.max(0, p.invuln - dt);
        if (p.regenTimer > 0) p.regenTimer -= dt;
        else if (p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + dt * 4);
        const moving = ['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown'].some(k => this.keys.has(k));
        if (moving) this.gunBobTime += dt * 6;
        if (this.faceTimer <= 0)
            this.faceExpr = this.enemies.filter(e=>!e.dead).length > 6 ? 'evil' : 'normal';
        this.enemies = this.enemies.filter(e => !e.dead || e.deathTimer < 2);
    }

    _updateInput(dt) {
        const p = this.player, spd = 0.05, turn = 0.045;
        p.angle += this.mouseDX; this.mouseDX = 0;
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) p.angle -= turn;
        if (this.keys.has('ArrowRight')|| this.keys.has('KeyE')) p.angle += turn;
        let dx = 0, dy = 0;
        const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))   { dx += cos*spd; dy += sin*spd; }
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) { dx -= cos*spd; dy -= sin*spd; }
        if (this.keys.has('KeyA')) { dx += sin*spd; dy -= cos*spd; }
        if (this.keys.has('KeyD')) { dx -= sin*spd; dy += cos*spd; }
        const nx = p.x+dx, ny = p.y+dy;
        if (DOOM_MAP[Math.floor(p.y)]?.[Math.floor(nx)] !== 1) p.x = nx;
        if (DOOM_MAP[Math.floor(ny)]?.[Math.floor(p.x)] !== 1) p.y = ny;
    }

    _updateEnemies(dt) {
        const p = this.player;
        for (const e of this.enemies) {
            if (e.dead) { e.deathTimer += dt; continue; }
            if (e.painTimer > 0) { e.painTimer -= dt; continue; }
            e.walkAnim += dt * 3;
            const dx = p.x-e.x, dy = p.y-e.y, dist = Math.hypot(dx, dy);
            // Only chase within the aggro radius — otherwise a map full of
            // alerts would all sprint at the player simultaneously.
            if (dist > 0.5 && dist <= DOOM_AGGRO) {
                const step = e.speed * dt;
                const nx = e.x+(dx/dist)*step, ny = e.y+(dy/dist)*step;
                if (DOOM_MAP[Math.floor(e.y)]?.[Math.floor(nx)] !== 1 && !this._eBlocking(nx,e.y,e)) e.x = nx;
                if (DOOM_MAP[Math.floor(ny)]?.[Math.floor(e.x)] !== 1 && !this._eBlocking(e.x,ny,e)) e.y = ny;
            }
            if (dist < 0.65) {
                e.attackTimer += dt;
                if (e.attackTimer >= 1.5) {
                    e.attackTimer = 0;
                    if (!this.godMode && p.invuln <= 0) {
                        p.health -= 3 + Math.random()*6 + e.severity*2;
                        p.invuln = 0.5;
                        p.regenTimer = 3;
                        this.hitFlash = 0.35; this.faceExpr = 'pain'; this.faceTimer = 0.6;
                        if (p.health <= 0) {
                            p.health = 0; this.state = 'dead'; this.faceExpr = 'dead';
                            if (document.pointerLockElement) document.exitPointerLock();
                        }
                    }
                }
            } else { e.attackTimer = 0; }
        }
    }

    _eBlocking(x, y, excl) {
        return this.enemies.some(e => e !== excl && !e.dead && Math.hypot(e.x-x, e.y-y) < 0.4);
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDERING
       ═══════════════════════════════════════════════════════════════ */
    _render() {
        const W = DOOM_W, GH = DOOM_GAME_H, buf = this.buf32;
        this._fillBg(buf, W, GH);
        this._castWalls(buf, W, GH);
        this.enemies.sort((a,b) => b._d2 - a._d2);
        this._drawSprites(buf, W, GH);
        this.offCtx.putImageData(this.imgData, 0, 0);
        const dW = this.canvas.width, dH = this.canvas.height;
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.offscreen, 0, 0, DOOM_W, DOOM_H, 0, 0, dW, dH);
        this._drawHUD(ctx, dW, dH);
        if (this.hitFlash > 0) {
            ctx.fillStyle = `rgba(200,0,0,${this.hitFlash*0.55})`;
            ctx.fillRect(0, 0, dW, dH);
        }
        if      (this.state === 'intro') this._drawIntro(ctx, dW, dH);
        else if (this.state === 'dead')  this._drawDeath(ctx, dW, dH);
    }

    _fillBg(buf, W, GH) {
        const half = GH >> 1;
        for (let y = 0; y < GH; y++) {
            const isCeil = y < half;
            const t = isCeil ? 1-(y/half) : (y-half)/(GH-half);
            const r = isCeil ? (15+t*5)|0 : (25+t*10)|0;
            const g = isCeil ? (5+t*2)|0  : (12+t*5)|0;
            const b = isCeil ? 5          : (5+t*3)|0;
            const pix = (255<<24)|(b<<16)|(g<<8)|r;
            for (let x = 0; x < W; x++) buf[y*W+x] = pix;
        }
    }

    _castWalls(buf, W, GH) {
        const p = this.player, half = GH>>1, tex = this._wallTex, TS = tex.S;
        for (let col = 0; col < W; col++) {
            const rayA = p.angle - DOOM_HALF_FOV + (col/W)*DOOM_FOV;
            const rdx = Math.cos(rayA), rdy = Math.sin(rayA);
            let mx = Math.floor(p.x), my = Math.floor(p.y);
            const ddx = Math.abs(1/rdx), ddy = Math.abs(1/rdy);
            let sdx, sdy, sx, sy, side = 0;
            if (rdx < 0) { sx=-1; sdx=(p.x-mx)*ddx; } else { sx=1; sdx=(mx+1-p.x)*ddx; }
            if (rdy < 0) { sy=-1; sdy=(p.y-my)*ddy; } else { sy=1; sdy=(my+1-p.y)*ddy; }
            let hit = false;
            while (!hit) {
                if (sdx < sdy) { sdx+=ddx; mx+=sx; side=0; } else { sdy+=ddy; my+=sy; side=1; }
                if (DOOM_MAP[my]?.[mx] === 1) hit = true;
            }
            let dist = side === 0 ? sdx-ddx : sdy-ddy;
            dist = Math.max(0.001, dist);
            this.zBuf[col] = dist;
            const lH = (GH/dist)|0;
            const yS = Math.max(0, (half-(lH>>1)));
            const yE = Math.min(GH-1, (half+(lH>>1)));
            let wx = side===0 ? p.y+dist*rdy : p.x+dist*rdx;
            wx -= Math.floor(wx);
            let tX = (wx*TS)|0;
            if (side===0 && rdx>0) tX = TS-tX-1;
            if (side===1 && rdy<0) tX = TS-tX-1;
            const fog = Math.max(0, 1-dist/DOOM_MAX_DIST);
            const br  = fog * (side===1 ? 0.62 : 1.0);
            const wallBuf = ((mx+my) & 1) ? tex.brick : tex.metal;
            const step = TS/lH;
            let tPos = (yS-half+(lH>>1))*step;
            for (let y = yS; y <= yE; y++) {
                const ty = Math.min(TS-1, Math.max(0, tPos|0)); tPos += step;
                const px32 = wallBuf[ty*TS+tX];
                const r = ((px32)    &0xFF)*br|0;
                const g = ((px32>>8) &0xFF)*br|0;
                const b = ((px32>>16)&0xFF)*br|0;
                buf[y*W+col] = (255<<24)|(b<<16)|(g<<8)|r;
            }
            // ── floor casting: tiled checker floor receding into distance ──
            for (let y = yE+1; y < GH; y++) {
                const rowDist = GH / (2 * Math.max(1, y-half));
                const fx = p.x + rowDist*rdx, fy = p.y + rowDist*rdy;
                const checker = (Math.floor(fx) + Math.floor(fy)) & 1;
                const ffog = Math.max(0, 1-rowDist/DOOM_MAX_DIST);
                const base = checker ? 58 : 46;
                const r=(base*0.72*ffog)|0, g=(base*0.66*ffog)|0, b=(base*0.58*ffog)|0;
                buf[y*W+col] = (255<<24)|(b<<16)|(g<<8)|r;
            }
        }
    }

    _drawSprites(buf, W, GH) {
        const p = this.player, half = GH>>1;
        const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
        const plX = -sin*DOOM_PLANE_LEN, plY = cos*DOOM_PLANE_LEN;
        const inv = 1/(plX*sin - cos*plY);
        for (const e of this.enemies) {
            const ex = e.x-p.x, ey = e.y-p.y;
            e._d2 = ex*ex+ey*ey;
            const tX = inv*(sin*ex    - cos*ey);
            const tY = inv*(-plY*ex   + plX*ey);
            if (tY <= 0.05) continue;
            const sX = ((W/2)*(1+tX/tY))|0;
            const sz = SEVERITY_CFG[e.severity]?.size ?? 0.8;
            const fullLH = GH/tY;
            const sH = Math.abs(fullLH*sz)|0;
            const sprite = this._demonSprites[e.severity];
            const sW = Math.max(1, (sH * (sprite.W/sprite.H))|0);
            // Anchor feet to the floor line at this distance (same row a
            // wall's base would occupy there) instead of centering the
            // sprite on the horizon — otherwise tall demons render with
            // their heads poking above the ceiling instead of standing on
            // the floor.
            const floorRow = half + (fullLH/2);
            const yE = Math.min(GH-1, floorRow)|0;
            const yS = Math.max(0, floorRow-sH)|0;
            const xS = Math.max(0, sX-(sW>>1));
            const xE = Math.min(W-1, sX+(sW>>1));
            const fog = Math.max(0, 1-tY/DOOM_MAX_DIST);
            if (fog < 0.04) continue;
            const deathF = e.dead ? Math.min(1, e.deathTimer/1.2) : 0;
            const bob = Math.sin(e.walkAnim) * 0.03;
            for (let sx = xS; sx <= xE; sx++) {
                if (tY >= this.zBuf[sx]) continue;
                const u = (sx-xS)/sW;
                for (let sy = yS; sy <= yE; sy++) {
                    let v = (sy-yS)/sH + bob;
                    if (v < 0 || v >= 1) continue;
                    if (e.dead && v < deathF) continue;
                    const px = sprite.buf[(v*sprite.H|0)*sprite.W + (u*sprite.W|0)];
                    const alpha = (px >>> 24) & 0xFF;
                    if (alpha < 40) continue;
                    let r = px & 0xFF, g = (px>>8) & 0xFF, b = (px>>16) & 0xFF;
                    if (e.painTimer > 0) { r=255; g=90; b=90; }
                    buf[sy*W+sx] = (255<<24)|((b*fog|0)<<16)|((g*fog|0)<<8)|(r*fog|0);
                }
            }
        }
    }

    /* ── HUD ────────────────────────────────────────────────────────── */
    _drawHUD(ctx, W, H) {
        const p  = this.player;
        const hY = H - Math.floor(H*0.18);
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, hY, W, H-hY);
        ctx.strokeStyle='#8B0000'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,hY); ctx.lineTo(W,hY); ctx.stroke();

        const fs = Math.max(9, Math.floor(W/30));
        ctx.font = `bold ${fs}px monospace`;
        const hpPct = p.health/p.maxHealth;
        const hCol  = hpPct>0.5 ? '#ff4444' : hpPct>0.25 ? '#ffaa00' : '#ff2020';
        ctx.fillStyle = hCol;
        ctx.fillText(`${Math.ceil(p.health)}%`, 8, hY+fs+4);
        ctx.fillStyle='#600'; ctx.fillRect(8, hY+fs+8, 60, 7);
        ctx.fillStyle=hCol;   ctx.fillRect(8, hY+fs+8, 60*hpPct, 7);
        ctx.strokeStyle='#444'; ctx.lineWidth=1; ctx.strokeRect(8, hY+fs+8, 60, 7);

        const fW = Math.floor((H-hY)*0.9), fX = Math.floor(W/2-fW/2);
        this._drawFace(ctx, fX, hY+2, fW, H-hY-4);

        ctx.textAlign='right'; ctx.font=`bold ${fs}px monospace`;
        ctx.fillStyle = p.ammo>10 ? '#ffcc00' : '#ff6600';
        ctx.fillText(`${p.ammo} ammo`, W-8, hY+fs+4);
        ctx.font=`${Math.max(8,fs-2)}px monospace`;
        ctx.fillStyle='#ccc'; ctx.fillText(`score:${this.score}`,   W-8, hY+fs*2+6);
        ctx.fillStyle='#f88'; ctx.fillText(`kills:${this.kills}`,   W-8, hY+fs*3+8);
        const alive = this.enemies.filter(e=>!e.dead).length;
        ctx.fillStyle = alive>0 ? '#ff4444' : '#44ff44';
        ctx.fillText(`demons:${alive}`, W-8, hY+fs*4+10);
        ctx.textAlign='left';

        this._drawGun(ctx, W, hY);

        // Crosshair
        const cx = W/2, cy = hY/2, arm = Math.max(5, W/40), gap = Math.max(2, arm/2);
        ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(cx-arm,cy); ctx.lineTo(cx-gap,cy);
        ctx.moveTo(cx+gap,cy); ctx.lineTo(cx+arm,cy);
        ctx.moveTo(cx,cy-arm); ctx.lineTo(cx,cy-gap);
        ctx.moveTo(cx,cy+gap); ctx.lineTo(cx,cy+arm);
        ctx.stroke();
        if (this.muzzleFlash > 0) {
            ctx.fillStyle=`rgba(255,200,50,${this.muzzleFlash*6})`;
            ctx.beginPath(); ctx.arc(cx,cy,gap*1.5,0,Math.PI*2); ctx.fill();
        }
        if (this.godMode) {
            ctx.textAlign='center';
            ctx.font=`bold ${Math.max(9,fs-1)}px monospace`;
            ctx.fillStyle='#ffdd33';
            ctx.fillText('GOD MODE', W/2, 12);
            ctx.textAlign='left';
        }
    }

    _drawGun(ctx, W, hY) {
        // Recoil/bob nudge the gun a little, but it must never dip past the
        // hY boundary — that strip is the status bar where the face lives,
        // and every part drawn here uses y<=0 offsets from gy so the whole
        // sprite stays above that line.
        const recoil=this.gunRecoil*8, bob=Math.sin(this.gunBobTime)*3;
        const gx=W/2, gy=Math.min(hY-6, hY-16+recoil+bob), gw=W*0.22, gh=W*0.15;
        ctx.save(); ctx.translate(gx,gy);
        ctx.fillStyle='#4a4a4a'; ctx.fillRect(-gw*0.06,-gh,gw*0.12,gh*0.5);
        ctx.fillStyle='#3a3a3a'; ctx.fillRect(-gw*0.3,-gh*0.55,gw*0.6,gh*0.4);
        ctx.fillStyle='#2a2a2a'; ctx.fillRect(-gw*0.12,-gh*0.22,gw*0.24,gh*0.16);
        ctx.fillStyle='#5a5a5a'; ctx.fillRect(-gw*0.05,-gh,gw*0.04,gh*0.5);
        if (this.muzzleFlash > 0) {
            const f=this.muzzleFlash;
            ctx.fillStyle=`rgba(255,220,60,${f*8})`; ctx.beginPath(); ctx.arc(0,-gh,gw*0.2,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=`rgba(255,255,200,${f*6})`; ctx.beginPath(); ctx.arc(0,-gh,gw*0.1,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    _drawFace(ctx, x, y, w, h) {
        const expr=this.faceExpr, cx=x+w/2, cy=y+h/2;
        ctx.fillStyle='#c08040';
        ctx.beginPath(); ctx.ellipse(cx,cy,w/2.1,h/2.1,0,0,Math.PI*2); ctx.fill();
        if (this.player.health < 60) {
            ctx.fillStyle='rgba(140,0,0,0.55)';
            ctx.beginPath(); ctx.ellipse(cx-w*0.12,cy-h*0.1,w*0.07,h*0.22,-0.3,0,Math.PI*2); ctx.fill();
        }
        const eyeY=cy-h*0.1, eyeR=w*0.10, eyeOff=w*0.22;
        if (expr === 'dead') {
            ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
            [-1,1].forEach(s => {
                const ex=cx+s*eyeOff;
                ctx.beginPath();
                ctx.moveTo(ex-eyeR,eyeY-eyeR); ctx.lineTo(ex+eyeR,eyeY+eyeR);
                ctx.moveTo(ex+eyeR,eyeY-eyeR); ctx.lineTo(ex-eyeR,eyeY+eyeR);
                ctx.stroke();
            });
        } else {
            ctx.fillStyle='#111';
            [-1,1].forEach(s => { ctx.beginPath(); ctx.arc(cx+s*eyeOff,eyeY,eyeR,0,Math.PI*2); ctx.fill(); });
            ctx.fillStyle='#fff';
            [-1,1].forEach(s => { ctx.beginPath(); ctx.arc(cx+s*eyeOff-eyeR*0.3,eyeY-eyeR*0.3,eyeR*0.3,0,Math.PI*2); ctx.fill(); });
            if (expr === 'evil') {
                ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
                [-1,1].forEach(s => {
                    ctx.beginPath();
                    ctx.moveTo(cx+s*(eyeOff-eyeR),eyeY-eyeR*1.5); ctx.lineTo(cx+s*(eyeOff+eyeR),eyeY-eyeR*0.8);
                    ctx.stroke();
                });
            }
        }
        const mY=cy+h*0.25;
        ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.beginPath();
        if      (expr==='pain') ctx.arc(cx,mY+h*0.06,w*0.16,Math.PI,0);
        else if (expr==='evil') ctx.arc(cx,mY-h*0.04,w*0.18,0,Math.PI);
        else if (expr==='dead') { ctx.moveTo(cx-w*0.2,mY); ctx.lineTo(cx+w*0.2,mY); }
        else                    ctx.arc(cx,mY-h*0.02,w*0.14,0.15,Math.PI-0.15);
        ctx.stroke();
    }

    _drawIntro(ctx, W, H) {
        ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,0,W,H);
        ctx.textAlign='center'; ctx.strokeStyle='#000';
        ctx.font=`bold ${Math.floor(W/10)}px monospace`;
        ctx.lineWidth=3; ctx.fillStyle='#cc0000';
        ctx.strokeText('DOOM ALERTS',W/2,H*0.22); ctx.fillText('DOOM ALERTS',W/2,H*0.22);
        const ls=Math.max(11,Math.floor(W/38));
        ctx.font=`${ls}px monospace`; ctx.fillStyle='#ffaaaa';
        ['Active Zabbix alerts spawn as demons.','SHOOT them to ACKNOWLEDGE the alert!','',
         'WASD / Arrows – move & turn','Mouse (click to capture) – aim','Click / Space – shoot','',
         'Disaster=Cyberdemon  ·  Info=Zombie','','[ CLICK TO START ]  ·  [R] REAL DOOM'
        ].forEach((l,i) => ctx.fillText(l, W/2, H*0.32+i*(ls+4)));
        ctx.textAlign='left';
    }

    _drawDeath(ctx, W, H) {
        ctx.fillStyle='rgba(160,0,0,0.65)'; ctx.fillRect(0,0,W,H);
        ctx.textAlign='center';
        ctx.font=`bold ${Math.floor(W/8)}px monospace`;
        ctx.fillStyle='#ff0000'; ctx.strokeStyle='#000'; ctx.lineWidth=3;
        ctx.strokeText('YOU DIED',W/2,H*0.42); ctx.fillText('YOU DIED',W/2,H*0.42);
        const sm=Math.max(12,Math.floor(W/30));
        ctx.font=`${sm}px monospace`; ctx.fillStyle='#ffcccc';
        ctx.fillText(`Score: ${this.score}   Kills: ${this.kills}`,W/2,H*0.57);
        ctx.fillText('Click to respawn',W/2,H*0.66);
        ctx.textAlign='left';
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   CDoomAlertsWidget – Zabbix widget wrapper
   In Zabbix 8.0 module assets may load before CWidget is defined; use a
   compatible stub so the class definition doesn't throw a ReferenceError.
   ═══════════════════════════════════════════════════════════════════════ */
const _DoomBase = (typeof CWidget !== 'undefined') ? CWidget : class {
    onStart()  {}
    onStop()   {}
    onLoad()   {}
    onResize() {}
};

class CDoomAlertsWidget extends _DoomBase {

    onStart() {
        if (typeof super.onStart === 'function') super.onStart();
        this._game       = null;
        this._alertCache = new Map();
        this._interval   = null;
        this._msgTimeout = null;
        this._container  = null;
        this._canvas     = null;
        this._overlay    = null;
        // Fallback: try to init after a short delay in case onLoad() is not called
        setTimeout(() => { if (!this._game) { this._initGame(); this._scheduleRefresh(); } }, 300);
    }

    onLoad() {
        // Called by Zabbix after widget HTML is injected into the DOM.
        if (typeof super.onLoad === 'function') super.onLoad();
        if (!this._game)     this._initGame();
        if (!this._interval) this._scheduleRefresh();
    }

    onStop() {
        if (typeof super.onStop === 'function') super.onStop();
        if (this._game)      { this._game.stop(); this._game = null; }
        if (this._interval)  { clearInterval(this._interval); this._interval = null; }
        if (this._msgTimeout){ clearTimeout(this._msgTimeout); this._msgTimeout = null; }
    }

    onResize() {
        if (typeof super.onResize === 'function') super.onResize();
        this._syncSize();
    }

    /* ── find container in DOM (try multiple access patterns) ───────── */
    _getContainer() {
        // Try various Zabbix CWidget content-area property names (7.x: _target, 8.x: varies)
        for (const prop of ['_target', '_content_body', '_body', '_contents']) {
            const el = this[prop];
            if (!el) continue;
            if (el.classList?.contains('doom-alerts-widget')) return el;
            const found = el.querySelector?.('.doom-alerts-widget');
            if (found) return found;
        }
        // Fall back to uniqueid data attribute (works when PHP passes a stable id)
        if (this._uniqueid) {
            const found = document.querySelector(`.doom-alerts-widget[data-uniqueid="${this._uniqueid}"]`);
            if (found) return found;
        }
        // Last resort: first doom widget on the page
        return document.querySelector('.doom-alerts-widget');
    }

    _initGame() {
        const container = this._getContainer();
        if (!container) return;

        this._container = container;
        const canvas = container.querySelector('.doom-canvas');
        this._canvas  = canvas;
        this._overlay = container.querySelector('.doom-overlay-msg');

        this._syncSize();
        this._injectCss();

        this._game = new DoomGame(canvas);
        this._game.onKill = (alertId, eventId, name) => this._onKill(alertId, eventId, name);
        this._game.start();
    }

    _syncSize() {
        if (!this._canvas || !this._container) return;
        this._canvas.width  = this._container.clientWidth  || 400;
        this._canvas.height = this._container.clientHeight || 300;
    }

    _injectCss() {
        if (document.getElementById('doom-alerts-css')) return;
        const s = document.createElement('style');
        s.id = 'doom-alerts-css';
        s.textContent = `
.doom-alerts-widget{position:relative;width:100%;height:100%;background:#000;overflow:hidden;font-family:monospace}
.doom-canvas{display:block;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;outline:none}
.doom-overlay-msg{position:absolute;top:6%;left:50%;transform:translateX(-50%) scale(.85);
  max-width:92%;text-align:center;padding:10px 24px;pointer-events:none;z-index:40;
  background:linear-gradient(180deg,#c00000,#4a0000);border:3px solid #ffcc00;border-radius:9px;
  color:#fff200;font-family:Impact,'Arial Narrow',Haettenschweiler,sans-serif;
  letter-spacing:.5px;text-shadow:2px 2px 0 #000,0 0 16px rgba(255,70,0,.95);
  box-shadow:0 0 24px 7px rgba(255,50,0,.75),inset 0 0 14px rgba(0,0,0,.6);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0}
.doom-overlay-msg.show{opacity:1;animation:doomBannerPop .35s cubic-bezier(.2,1.4,.4,1) forwards,
  doomBannerPulse .6s ease-in-out .35s 4}
.doom-banner-title{font-size:1em;line-height:1.2}
.doom-banner-sub{font-size:.48em;font-family:monospace;font-weight:bold;color:#ffe0e0;
  letter-spacing:0;text-shadow:1px 1px 0 #000;margin-top:3px}
@keyframes doomBannerPop{0%{transform:translateX(-50%) scale(.3) rotate(-4deg);opacity:0}
  55%{transform:translateX(-50%) scale(1.15) rotate(2deg);opacity:1}
  100%{transform:translateX(-50%) scale(1) rotate(0);opacity:1}}
@keyframes doomBannerPulse{0%,100%{box-shadow:0 0 24px 7px rgba(255,50,0,.75)}
  50%{box-shadow:0 0 38px 15px rgba(255,150,0,.95)}}
.doom-dpad{position:absolute;bottom:12px;left:12px;display:grid;
  grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);gap:2px;opacity:.6}
.doom-dpad button{background:rgba(180,0,0,.7);border:1px solid #800;border-radius:4px;
  color:#fff;font-size:18px;cursor:pointer;touch-action:none;user-select:none}
.doom-dpad button:active{background:rgba(255,50,50,.9)}
.doom-fire-btn{position:absolute;bottom:20px;right:20px;width:70px;height:70px;
  border-radius:50%;background:rgba(180,0,0,.85);border:2px solid #f00;color:#fff;
  font-size:28px;cursor:pointer;touch-action:none;user-select:none;opacity:.7}
.doom-fire-btn:active{opacity:1}
.doom-realdoom-btn{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);
  z-index:15;padding:10px 18px;font:bold 14px Impact,'Arial Narrow',sans-serif;
  letter-spacing:.5px;color:#fff200;background:linear-gradient(180deg,#c00000,#4a0000);
  border:2px solid #ffcc00;border-radius:6px;cursor:pointer;white-space:nowrap;
  box-shadow:0 0 14px 3px rgba(255,50,0,.6);text-shadow:1px 1px 0 #000}
.doom-realdoom-btn:hover{filter:brightness(1.2)}
.doom-realdoom-wrap{position:absolute;inset:0;z-index:30;background:#000}
.doom-realdoom-back{position:absolute;top:6px;left:6px;z-index:31;padding:5px 10px;
  font:bold 11px monospace;color:#fff200;background:rgba(120,0,0,.85);
  border:1px solid #ffcc00;border-radius:4px;cursor:pointer}
.doom-realdoom-mount{position:absolute;inset:6px;top:34px;display:flex;
  align-items:center;justify-content:center;overflow:hidden}
.doom-realdoom-canvas{width:100%;height:100%;object-fit:contain;
  image-rendering:pixelated;outline:none;background:#000}
.doom-realdoom-pending{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
  z-index:32;padding:4px 10px;font:bold 11px monospace;color:#ffe27a;
  background:rgba(20,20,20,.8);border:1px solid #a06000;border-radius:4px;
  white-space:nowrap;pointer-events:none}
.doom-realdoom-loading,.doom-realdoom-error{position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;text-align:center;color:#ffaaaa;
  font:13px monospace;padding:20px;background:#000}`;
        document.head.appendChild(s);
    }

    /* ── alert refresh ──────────────────────────────────────────────── */
    _scheduleRefresh() {
        const secs = parseInt(this._container?.dataset?.refresh ?? '30', 10) || 30;
        this._fetchAlerts();
        this._interval = setInterval(() => this._fetchAlerts(), secs * 1000);
    }

    async _fetchAlerts() {
        try {
            const minSev = parseInt(this._getContainer()?.dataset?.minSeverity ?? '0', 10) || 0;
            const result = await this._api('problem.get', {
                output:       ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
                selectHosts:  ['name'],
                acknowledged: false,
                suppressed:   false,
                recent:       true,
                severities:   [0,1,2,3,4,5].filter(s => s >= minSev),
            });
            if (!Array.isArray(result) || !this._game) return;
            const live = new Set(result.map(p => String(p.eventid)));
            result.forEach(p => {
                this._alertCache.set(String(p.eventid), p);
                this._game.addAlert(p);
            });
            for (const [id] of this._alertCache) {
                if (!live.has(id)) { this._game.removeAlert(id); this._alertCache.delete(id); }
            }
        } catch(e) { console.warn('[DoomAlerts] fetchAlerts:', e); }
    }

    async _onKill(alertId, eventId, name) {
        try {
            await this._api('event.acknowledge', {
                eventids: [eventId],
                action:   6,
                message:  '[DOOM] Eliminated! Acknowledged via DOOM Alerts widget.',
            });
            this._alertCache.delete(String(eventId));
            this._showMsg('☠ ACKNOWLEDGED!', name);
        } catch(e) {
            console.warn('[DoomAlerts] acknowledge:', e);
            this._showMsg('⚠ ACK FAILED', name);
        }
    }

    /* ── Zabbix API (same-origin session cookie) ────────────────────── */
    async _api(method, params) {
        const headers = { 'Content-Type': 'application/json' };
        const csrf    = document.querySelector('meta[name="csrf-token"]');
        if (csrf) headers['X-CSRF-Token'] = csrf.content;
        const res = await fetch('api_jsonrpc.php', {
            method: 'POST', credentials: 'same-origin', headers,
            body: JSON.stringify({ jsonrpc:'2.0', method, params, id:1 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (j.error) throw new Error(j.error.data ?? j.error.message);
        return j.result;
    }

    _showMsg(title, sub) {
        const ov = this._overlay;
        if (!ov) return;
        const w = this._container?.clientWidth || 400;
        ov.style.fontSize = Math.max(15, Math.min(34, w/13)) + 'px';
        ov.innerHTML = '';
        const t = document.createElement('div');
        t.className = 'doom-banner-title'; t.textContent = title;
        ov.appendChild(t);
        if (sub) {
            const s = document.createElement('div');
            s.className = 'doom-banner-sub'; s.textContent = `"${sub}"`;
            ov.appendChild(s);
        }
        ov.style.display = 'block';
        ov.classList.remove('show');
        void ov.offsetWidth; // force reflow so the pop animation restarts on repeat kills
        ov.classList.add('show');
        if (this._msgTimeout) clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => {
            ov.classList.remove('show');
            setTimeout(() => { if (ov) ov.style.display = 'none'; }, 250);
        }, 3800);
    }
}

// Export so Zabbix widget framework can find the class by naming convention
window.CDoomAlertsWidget = CDoomAlertsWidget;

/* ── Self-bootstrap (MutationObserver fallback) ───────────────────────────
   Boots DoomGame directly on any .doom-alerts-widget that appears in the
   DOM.  Works even if Zabbix 8.x doesn't call CDoomAlertsWidget lifecycle
   methods, and handles multiple widgets on one dashboard.
   ──────────────────────────────────────────────────────────────────────── */
(function () {

    async function _apiCall(method, params) {
        const headers = { 'Content-Type': 'application/json' };
        const csrf = document.querySelector('meta[name="csrf-token"]');
        if (csrf) headers['X-CSRF-Token'] = csrf.content;
        const res = await fetch('api_jsonrpc.php', {
            method: 'POST', credentials: 'same-origin', headers,
            body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (j.error) throw new Error(j.error.data ?? j.error.message);
        return j.result;
    }

    function injectCss() {
        if (document.getElementById('doom-alerts-css')) return;
        const s = document.createElement('style');
        s.id = 'doom-alerts-css';
        s.textContent = `
.doom-alerts-widget{position:relative;width:100%;height:100%;background:#000;overflow:hidden;font-family:monospace}
.doom-canvas{display:block;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;outline:none}
.doom-overlay-msg{position:absolute;top:6%;left:50%;transform:translateX(-50%) scale(.85);
  max-width:92%;text-align:center;padding:10px 24px;pointer-events:none;z-index:40;
  background:linear-gradient(180deg,#c00000,#4a0000);border:3px solid #ffcc00;border-radius:9px;
  color:#fff200;font-family:Impact,'Arial Narrow',Haettenschweiler,sans-serif;
  letter-spacing:.5px;text-shadow:2px 2px 0 #000,0 0 16px rgba(255,70,0,.95);
  box-shadow:0 0 24px 7px rgba(255,50,0,.75),inset 0 0 14px rgba(0,0,0,.6);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0}
.doom-overlay-msg.show{opacity:1;animation:doomBannerPop .35s cubic-bezier(.2,1.4,.4,1) forwards,
  doomBannerPulse .6s ease-in-out .35s 4}
.doom-banner-title{font-size:1em;line-height:1.2}
.doom-banner-sub{font-size:.48em;font-family:monospace;font-weight:bold;color:#ffe0e0;
  letter-spacing:0;text-shadow:1px 1px 0 #000;margin-top:3px}
@keyframes doomBannerPop{0%{transform:translateX(-50%) scale(.3) rotate(-4deg);opacity:0}
  55%{transform:translateX(-50%) scale(1.15) rotate(2deg);opacity:1}
  100%{transform:translateX(-50%) scale(1) rotate(0);opacity:1}}
@keyframes doomBannerPulse{0%,100%{box-shadow:0 0 24px 7px rgba(255,50,0,.75)}
  50%{box-shadow:0 0 38px 15px rgba(255,150,0,.95)}}
.doom-dpad{position:absolute;bottom:12px;left:12px;display:grid;
  grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);gap:2px;opacity:.6}
.doom-dpad button{background:rgba(180,0,0,.7);border:1px solid #800;border-radius:4px;
  color:#fff;font-size:18px;cursor:pointer;touch-action:none;user-select:none}
.doom-dpad button:active{background:rgba(255,50,50,.9)}
.doom-fire-btn{position:absolute;bottom:20px;right:20px;width:70px;height:70px;
  border-radius:50%;background:rgba(180,0,0,.85);border:2px solid #f00;color:#fff;
  font-size:28px;cursor:pointer;touch-action:none;user-select:none;opacity:.7}
.doom-fire-btn:active{opacity:1}
.doom-realdoom-btn{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);
  z-index:15;padding:10px 18px;font:bold 14px Impact,'Arial Narrow',sans-serif;
  letter-spacing:.5px;color:#fff200;background:linear-gradient(180deg,#c00000,#4a0000);
  border:2px solid #ffcc00;border-radius:6px;cursor:pointer;white-space:nowrap;
  box-shadow:0 0 14px 3px rgba(255,50,0,.6);text-shadow:1px 1px 0 #000}
.doom-realdoom-btn:hover{filter:brightness(1.2)}
.doom-realdoom-wrap{position:absolute;inset:0;z-index:30;background:#000}
.doom-realdoom-back{position:absolute;top:6px;left:6px;z-index:31;padding:5px 10px;
  font:bold 11px monospace;color:#fff200;background:rgba(120,0,0,.85);
  border:1px solid #ffcc00;border-radius:4px;cursor:pointer}
.doom-realdoom-mount{position:absolute;inset:6px;top:34px;display:flex;
  align-items:center;justify-content:center;overflow:hidden}
.doom-realdoom-canvas{width:100%;height:100%;object-fit:contain;
  image-rendering:pixelated;outline:none;background:#000}
.doom-realdoom-pending{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
  z-index:32;padding:4px 10px;font:bold 11px monospace;color:#ffe27a;
  background:rgba(20,20,20,.8);border:1px solid #a06000;border-radius:4px;
  white-space:nowrap;pointer-events:none}
.doom-realdoom-loading,.doom-realdoom-error{position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;text-align:center;color:#ffaaaa;
  font:13px monospace;padding:20px;background:#000}`;
        document.head.appendChild(s);
    }

    function boot(el) {
        if (el.dataset.doomBooted) return;
        el.dataset.doomBooted = '1';
        console.log('[DoomAlerts] booting container', el.id || el.dataset.uniqueid || '?');
        injectCss();

        const canvas = el.querySelector('canvas.doom-canvas');
        if (!canvas) { console.warn('[DoomAlerts] no canvas in container'); return; }

        function syncSize() {
            const w = el.clientWidth  || 400;
            const h = el.clientHeight || 300;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w; canvas.height = h;
            }
        }
        syncSize();

        // If the parent element already has a running game (Zabbix refreshed the widget
        // HTML but the parent div persists), rebind to the new canvas instead of restarting.
        const parent = el.parentElement;
        if (parent && parent._doomCtx) {
            const ctx = parent._doomCtx;
            ctx.game.rebindCanvas(canvas);
            ctx.overlay = el.querySelector('.doom-overlay-msg');
            new ResizeObserver(syncSize).observe(el);
            console.log('[DoomAlerts] rebind to new canvas – game state preserved');
            return;
        }

        const game       = new DoomGame(canvas);
        const alertCache = new Map();
        const minSev     = parseInt(el.dataset.minSeverity ?? '0', 10) || 0;
        const overlay    = el.querySelector('.doom-overlay-msg');

        let msgHideTimer = null;
        function showMsg(title, sub) {
            if (!overlay) return;
            const w = el.clientWidth || 400;
            overlay.style.fontSize = Math.max(15, Math.min(34, w/13)) + 'px';
            overlay.innerHTML = '';
            const t = document.createElement('div');
            t.className = 'doom-banner-title'; t.textContent = title;
            overlay.appendChild(t);
            if (sub) {
                const s = document.createElement('div');
                s.className = 'doom-banner-sub'; s.textContent = '"' + sub + '"';
                overlay.appendChild(s);
            }
            overlay.style.display = 'block';
            overlay.classList.remove('show');
            void overlay.offsetWidth; // force reflow so the pop animation restarts on repeat kills
            overlay.classList.add('show');
            clearTimeout(msgHideTimer);
            msgHideTimer = setTimeout(() => {
                overlay.classList.remove('show');
                setTimeout(() => { overlay.style.display = 'none'; }, 250);
            }, 3800);
        }

        game.onKill = async (alertId, eventId, name) => {
            try {
                await _apiCall('event.acknowledge', {
                    eventids: [eventId], action: 6,
                    message: 'Acknowledged by DOOM: Alert Slayer',
                });
                alertCache.delete(String(eventId));
                showMsg('☠ ACKNOWLEDGED!', name);
            } catch (e) {
                console.warn('[DoomAlerts] ack failed:', e);
                showMsg('⚠ ACK FAILED', name);
            }
        };

        game.start();

        async function fetchAlerts() {
            try {
                const severities = [];
                for (let s = minSev; s <= 5; s++) severities.push(s);
                const problems = await _apiCall('problem.get', {
                    recent: true, acknowledged: false, suppressed: false,
                    severities, output: ['eventid', 'name', 'severity'], limit: 30,
                });
                const seen = new Set();
                for (const p of problems) {
                    const key = String(p.eventid);
                    seen.add(key);
                    if (!alertCache.has(key)) {
                        alertCache.set(key, p);
                        // addAlert() reads alert.eventid (lowercase i) — must match exactly
                        game.addAlert({ eventid: key, name: p.name,
                                        severity: parseInt(p.severity, 10) });
                    }
                }
                for (const [k] of alertCache) {
                    if (!seen.has(k)) { alertCache.delete(k); game.removeAlert(k); }
                }
            } catch (e) {
                console.warn('[DoomAlerts] fetch alerts:', e);
            }
        }

        const secs = parseInt(el.dataset.refresh ?? '30', 10) || 30;
        fetchAlerts();
        const timer = setInterval(fetchAlerts, secs * 1000);

        new ResizeObserver(syncSize).observe(el);

        // Store context on parent so rebindCanvas() can find it on next Zabbix widget refresh
        const ctx = { game, overlay, alertCache };
        if (parent) parent._doomCtx = ctx;

        // When element is removed (Zabbix refresh), DON'T stop — parent keeps ctx for rebind
        new MutationObserver((_, obs) => {
            if (!document.contains(el)) obs.disconnect();
            // game and timer live on — rebind will reuse them
        }).observe(document.body, { childList: true, subtree: true });
    }

    function scan() {
        document.querySelectorAll('.doom-alerts-widget:not([data-doom-booted])').forEach(boot);
    }

    // Watch for containers being inserted
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    // Also try right now (widget may already be in DOM)
    if (document.readyState !== 'loading') {
        scan();
    } else {
        document.addEventListener('DOMContentLoaded', scan);
    }

    console.log('[DoomAlerts] MutationObserver self-bootstrap registered');
}());
