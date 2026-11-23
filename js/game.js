// AETHERBREAKER: SINGULARITY — Core Game Loop, Wave Director, Combat Physics, HUD & FX Lab

import { ProceduralAudioEngine } from './audio.js?v=3d2';
import { SpacetimeGrid } from './grid.js?v=3d2';
import { WebGLPostRenderer } from './renderer.js?v=3d2';
import { SpriteAtlasManager } from './sprites.js?v=3d2';
import { ARMapSystem } from './ar_map.js?v=3d2';
import {
  SHIP_CLASSES,
  UPGRADES,
  MESH_RING_X,
  MESH_RING_Y,
  MESH_RING_Z,
  generateLightningPoints,
  createEnemy,
  createBoss
} from './entities.js?v=3d2';

const PACING_PRESETS = [
  { id: 'tactical', label: 'TACTICAL', scale: 0.72, desc: 'Readable 3D canyon dogfighting speed' },
  { id: 'cinematic', label: 'CINEMATIC', scale: 0.54, desc: 'Deliberate tactical slow-cruise' },
  { id: 'hyper', label: 'HYPER', scale: 1.0, desc: 'Classic high-speed arcade intensity' }
];

const PALETTES = [
  { gridBase: [0.09, 0.36, 0.72], gridHot: [0.18, 0.96, 1.0] },
  { gridBase: [0.32, 0.14, 0.72], gridHot: [1.0, 0.24, 0.78] },
  { gridBase: [0.08, 0.48, 0.45], gridHot: [0.2, 1.0, 0.65] },
  { gridBase: [0.55, 0.18, 0.24], gridHot: [1.0, 0.75, 0.2] }
];

const MODES = [
  {
    id: 'odyssey',
    name: 'ODYSSEY CAMPAIGN',
    desc: 'Endless roguelite waves. Draft upgrades after every wave. 3D Bosses every 5 waves.'
  },
  {
    id: 'boss_rush',
    name: 'BOSS RUSH',
    desc: 'Straight into colossal 3D Wireframe Bosses with double augmentation drafts between kills.'
  },
  {
    id: 'zen_lab',
    name: 'ZEN FX & PHYSICS LAB',
    desc: 'Godmode sandbox. Spawn black holes, test 3D bosses, and tune live WebGL2 shaders.'
  }
];

class AetherbreakerGame {
  constructor() {
    this.glCanvas = document.getElementById('glCanvas');
    this.hudCanvas = document.getElementById('hudCanvas');
    this.hudCtx = this.hudCanvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new WebGLPostRenderer(this.glCanvas);
    this.atlas = new SpriteAtlasManager(canvas => this.renderer.setSpriteAtlas(canvas));
    this.renderer.setSpriteAtlas(this.atlas.canvas);
    this.grid = new SpacetimeGrid(this.width, this.height, 58, 34);
    this.arMap = new ARMapSystem(this.width, this.height);
    this.audio = new ProceduralAudioEngine();

    this.camModes = ['chase_3d', 'cockpit_3d', 'tactical_3d', 'topdown_25d'];
    this.camLabels = {
      chase_3d: '3D CHASE POV',
      cockpit_3d: '3D COCKPIT POV',
      tactical_3d: '3D TACTICAL',
      topdown_25d: '2.5D OVERHEAD'
    };
    this.camModeIdx = 0;
    this.pacingIdx = 0;
    this.aimWorld = { x: this.width * 0.5, y: this.height * 0.3, z: 55 };

    // State
    this.state = 'MENU'; // MENU | PLAYING | UPGRADE | PAUSED | GAMEOVER
    this.selectedShipId = 'vanguard';
    this.selectedMode = 'odyssey';
    this.time = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = 0;

    // FX Lab Settings
    this.fx = {
      bloom: 1.25,
      elasticity: 1.0,
      aberration: 1.0,
      lensing: 1.2,
      timeScale: 0.82,
      clickBlackHole: false
    };

    // Camera / Shader dynamics
    this.trauma = 0;
    this.chronoShift = 0;
    this.hitStopTimer = 0;
    this.bulletTimeTimer = 0;
    this.paletteIdx = 0;

    // Input
    this.keys = new Set();
    this.mouse = { x: this.width * 0.5, y: this.height * 0.3, left: false, right: false };
    this.autoFire = false;

    // Gameplay pools
    this.player = null;
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.singularities = [];
    this.particles = [];
    this.shockwaves = [];
    this.lightningArcs = [];
    this.railBeams = [];
    this.decoys = [];
    this.floatingTexts = [];
    this.stars = [];

    // Wave / Score progression
    this.wave = 1;
    this.waveQueue = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.peakCombo = 1;
    this.kills = 0;
    this.parries = 0;
    this.banner = { text: '', sub: '', timer: 0, maxTimer: 2.5, color: '#2cf5ff' };
    this.upgradeChoices = [];
    this.pendingDrafts = 0;
    this.pendingDraftReason = 'WAVE CLEARED // MODULE SYNC';

    this._initStarfield();
    this._bindDOM();
    this._buildMenuCards();
    this._loadBestStats();
    this._resize();

    window.addEventListener('resize', () => this._resize());
    this._lastTime = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _initStarfield() {
    this.stars = [];
    for (let i = 0; i < 140; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 1.5 + Math.random() * 2.5,
        depth: 0.2 + Math.random() * 0.8,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.hudCanvas.width = Math.floor(this.width * this.dpr);
    this.hudCanvas.height = Math.floor(this.height * this.dpr);
    this.renderer.resize(this.width, this.height);
    this.grid.resize(this.width, this.height, this.state === 'MENU');
    this.arMap.resize(this.width, this.height);
  }

  _bindDOM() {
    const $ = id => document.getElementById(id);

    this.dom = {
      arVideo: $('arVideo'),
      menuOverlay: $('menuOverlay'),
      upgradeModal: $('upgradeModal'),
      pauseOverlay: $('pauseOverlay'),
      gameOverOverlay: $('gameOverOverlay'),
      topControls: $('topControls'),
      fxDrawer: $('fxDrawer'),
      btnCamMode: $('btnCamMode'),
      btnPacing: $('btnPacing'),
      btnArSector: $('btnArSector'),
      btnLidar: $('btnLidar'),
      btnArCam: $('btnArCam'),
      btnAutoFire: $('btnAutoFire'),
      btnFxLab: $('btnFxLab'),
      btnMute: $('btnMute'),
      btnPause: $('btnPause')
    };

    $('btnStartGame').addEventListener('click', () => this.startRun());
    $('btnResume').addEventListener('click', () => this.togglePause(false));
    $('btnPauseFx').addEventListener('click', () => this.toggleFxDrawer(true));
    $('btnRestart').addEventListener('click', () => this.startRun());
    $('btnQuitMenu').addEventListener('click', () => this.returnToMenu());
    $('btnRetryRun').addEventListener('click', () => this.startRun());
    $('btnOverMenu').addEventListener('click', () => this.returnToMenu());

    this.dom.btnCamMode.addEventListener('click', () => this.cycleCameraMode());
    this.dom.btnPacing.addEventListener('click', () => this.cyclePacing());
    this.dom.btnArSector.addEventListener('click', () => this.cycleArSector());
    this.dom.btnLidar.addEventListener('click', () => this.triggerLidarScan());
    this.dom.btnArCam.addEventListener('click', () => this.toggleArCam());
    this.dom.btnAutoFire.addEventListener('click', () => this.toggleAutoFire());
    this.dom.btnFxLab.addEventListener('click', () => this.toggleFxDrawer());
    $('btnCloseFx').addEventListener('click', () => this.toggleFxDrawer(false));
    this.dom.btnMute.addEventListener('click', () => this.toggleMute());
    this.dom.btnPause.addEventListener('click', () => this.togglePause());

    $('btnLabLidar').addEventListener('click', () => this.triggerLidarScan());
    $('btnLabBeacon').addEventListener('click', () => this.deployArBeacon());
    $('btnLabSector').addEventListener('click', () => this.cycleArSector());
    $('btnLabCam').addEventListener('click', () => this.cycleCameraMode());

    // FX Lab sliders
    const bindSlider = (sliderId, valId, key) => {
      const el = $(sliderId);
      const val = $(valId);
      el.addEventListener('input', () => {
        this.fx[key] = parseFloat(el.value);
        val.textContent = this.fx[key].toFixed(2);
      });
    };
    bindSlider('sliderBloom', 'valBloom', 'bloom');
    bindSlider('sliderElasticity', 'valElasticity', 'elasticity');
    bindSlider('sliderAberration', 'valAberration', 'aberration');
    bindSlider('sliderLensing', 'valLensing', 'lensing');
    bindSlider('sliderTimeScale', 'valTimeScale', 'timeScale');

    // Sandbox Triggers
    $('btnToggleClickBH').addEventListener('click', () => {
      this.fx.clickBlackHole = !this.fx.clickBlackHole;
      const btn = $('btnToggleClickBH');
      btn.classList.toggle('active', this.fx.clickBlackHole);
      btn.textContent = `Click = Black Hole: ${this.fx.clickBlackHole ? 'ON' : 'OFF'}`;
    });
    $('btnSpawnBH').addEventListener('click', () => {
      this.audio.init();
      this.spawnSingularity(
        this.width * (0.25 + Math.random() * 0.5),
        this.height * (0.25 + Math.random() * 0.5),
        true
      );
    });
    $('btnTriggerNova').addEventListener('click', () => {
      this.audio.init();
      this.triggerGridSupernova(this.width * 0.5, this.height * 0.5, 520, 42);
    });
    $('btnMaxOverdrive').addEventListener('click', () => {
      if (this.player) {
        this.player.overdrive = 100;
        this.addBanner('OVERDRIVE CHARGED', 'PRESS [E] OR [F] TO UNLEASH NOVABEAM', '#ffb830', 2.0);
      }
    });
    $('btnSpawnBoss5').addEventListener('click', () => this.spawnLabBoss(1));
    $('btnSpawnBoss10').addEventListener('click', () => this.spawnLabBoss(2));
    $('btnSpawnBoss15').addEventListener('click', () => this.spawnLabBoss(3));
    $('btnGrantUpgrade').addEventListener('click', () => {
      if (this.state === 'PLAYING') this.openUpgradeDraft('LAB AUGMENTATION');
    });
    $('btnMaxUpgrades').addEventListener('click', () => this.maxAllUpgrades());
    $('btnClearEnemies').addEventListener('click', () => this.purgeArena());

    // Keyboard & Mouse
    window.addEventListener('keydown', e => this._onKeyDown(e));
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => this._onMouseDown(e));
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  _buildMenuCards() {
    const shipGrid = document.getElementById('shipGrid');
    shipGrid.innerHTML = '';
    SHIP_CLASSES.forEach(ship => {
      const card = document.createElement('div');
      card.className = `ship-card ${ship.id === this.selectedShipId ? 'selected' : ''}`;
      card.style.setProperty('--ship-color', ship.hex);
      card.innerHTML = `
        <div class="ship-top">
          <div class="ship-name">${ship.name}</div>
          <div class="ship-role">${ship.role}</div>
        </div>
        <div class="ship-preview-wrap">
          <img class="ship-preview-img" src="assets/planes/${ship.id}.svg" alt="${ship.name}" />
          <span class="ship-model-tag">${ship.aircraftModel}</span>
        </div>
        <div class="ship-weapon">${ship.weaponName}</div>
        <div class="ship-desc">${ship.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.selectedShipId = ship.id;
        shipGrid.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      shipGrid.appendChild(card);
    });

    const modeGrid = document.getElementById('modeGrid');
    modeGrid.innerHTML = '';
    MODES.forEach(mode => {
      const card = document.createElement('div');
      card.className = `mode-card ${mode.id === this.selectedMode ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="mode-title">${mode.name}</div>
        <div class="mode-desc">${mode.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.selectedMode = mode.id;
        modeGrid.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      modeGrid.appendChild(card);
    });
  }

  _loadBestStats() {
    try {
      const bestScore = Number(localStorage.getItem('ab_best_score') || 0);
      const bestWave = Number(localStorage.getItem('ab_best_wave') || 0);
      const bar = document.getElementById('bestStatsBar');
      if (bestScore > 0) {
        bar.textContent = `RECORD SCORE: ${bestScore.toLocaleString()}   //   MAX WAVE: ${bestWave}`;
      } else {
        bar.textContent = 'SYSTEM READY // CHOOSE YOUR VESSEL AND BREACH THE GRID';
      }
    } catch {
      // Ignore storage failures
    }
  }

  _saveBestStats() {
    if (this.selectedMode === 'zen_lab') return;
    try {
      const prevScore = Number(localStorage.getItem('ab_best_score') || 0);
      const prevWave = Number(localStorage.getItem('ab_best_wave') || 0);
      if (this.score > prevScore) localStorage.setItem('ab_best_score', String(Math.floor(this.score)));
      if (this.wave > prevWave) localStorage.setItem('ab_best_wave', String(this.wave));
    } catch {
      // Ignore storage failures
    }
  }

  _onKeyDown(e) {
    this.keys.add(e.code);

    if (e.code === 'Tab') {
      e.preventDefault();
      if (this.state !== 'MENU') this.toggleFxDrawer();
      return;
    }

    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.state === 'UPGRADE') {
      if (e.code === 'Digit1' && this.upgradeChoices[0]) this.selectUpgrade(this.upgradeChoices[0].id);
      if (e.code === 'Digit2' && this.upgradeChoices[1]) this.selectUpgrade(this.upgradeChoices[1].id);
      if (e.code === 'Digit3' && this.upgradeChoices[2]) this.selectUpgrade(this.upgradeChoices[2].id);
      return;
    }

    if (e.code === 'Escape') {
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.togglePause();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      this.tryPhaseDash();
    } else if (e.code === 'KeyQ') {
      this.trySingularityWell();
    } else if (e.code === 'KeyE' || e.code === 'KeyF') {
      this.tryOverdrive();
    } else if (e.code === 'KeyC') {
      this.toggleAutoFire();
    } else if (e.code === 'KeyV') {
      this.cycleCameraMode();
    } else if (e.code === 'KeyP') {
      this.cyclePacing();
    } else if (e.code === 'KeyN') {
      this.cycleArSector();
    } else if (e.code === 'KeyL') {
      this.triggerLidarScan();
    } else if (e.code === 'KeyR') {
      this.toggleArCam();
    } else if (e.code === 'KeyB') {
      this.deployArBeacon();
    }
  }

  _onMouseDown(e) {
    // Ignore clicks on UI panels/buttons
    if (e.target.closest('.glass-panel, .hud-btn, .upgrade-card, button, input')) return;

    this.audio.init();
    if (this.state === 'PLAYING') {
      const wPt = this.renderer.screenToWorldPlane(e.clientX, e.clientY, this.player ? this.player.z : 55);
      if (e.button === 0) {
        if (this.fx.clickBlackHole) {
          this.spawnSingularity(wPt.x, wPt.y, true);
          return;
        }
        this.mouse.left = true;
      } else if (e.button === 2) {
        this.mouse.right = true;
        this.trySingularityWell();
      }
    }
  }

  cycleCameraMode() {
    this.camModeIdx = (this.camModeIdx + 1) % this.camModes.length;
    const mode = this.camModes[this.camModeIdx];
    const label = this.camLabels[mode];
    this.dom.btnCamMode.innerHTML = `CAM: ${label} <kbd>V</kbd>`;
    this.addBanner(`CAMERA // ${label}`, '3D PERSPECTIVE VIEWPORT SHIFT', '#2cf5ff', 1.4);
  }

  cyclePacing() {
    this.pacingIdx = (this.pacingIdx + 1) % PACING_PRESETS.length;
    const preset = PACING_PRESETS[this.pacingIdx];
    if (this.dom.btnPacing) {
      this.dom.btnPacing.innerHTML = `PACE: ${preset.label} <kbd>P</kbd>`;
    }
    this.addBanner(
      `PACING // ${preset.label} (${Math.round(preset.scale * 100)}%)`,
      preset.desc.toUpperCase(),
      '#2eff9f',
      1.4
    );
  }

  cycleArSector() {
    const sec = this.arMap.cycleSector();
    this.dom.btnArSector.innerHTML = `SECTOR: ${sec.shortName} <kbd>N</kbd>`;
    this.addBanner(sec.name, '3D AUGMENTED REALITY TOPOLOGY LOADED', '#2eff9f', 1.8);
  }

  triggerLidarScan() {
    if (!this.player) return;
    this.arMap.triggerLidarScan(this.player.x, this.player.y);
    this.audio.playParry();
    this.addFloatingText(this.player.x, this.player.y - 30, '3D LIDAR SWEEP!', '#2eff9f', 15, this.player.z + 20);
  }

  deployArBeacon() {
    if (this.state !== 'PLAYING') return;
    const tx = Math.max(40, Math.min(this.width - 40, this.aimWorld.x));
    const ty = Math.max(40, Math.min(this.height - 40, this.aimWorld.y));
    this.arMap.deployArBeacon(tx, ty);
    this.audio.playLevelUp();
    this.addFloatingText(tx, ty - 20, 'AR PYLON DEPLOYED', '#2cf5ff', 14, 70);
  }

  async toggleArCam() {
    const res = await this.arMap.toggleCameraAR(this.dom.arVideo);
    const active = res.mode !== 'off';
    this.dom.btnArCam.classList.toggle('active', active);
    this.dom.btnArCam.innerHTML = `AR: ${res.mode.toUpperCase()} <kbd>R</kbd>`;
    this.addBanner(res.message, 'AUGMENTED REALITY OVERLAY', '#2eff9f', 1.9);
  }

  toggleAutoFire() {
    this.autoFire = !this.autoFire;
    this.dom.btnAutoFire.classList.toggle('active', this.autoFire);
  }

  toggleMute() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    this.dom.btnMute.innerHTML = `AUDIO: ${muted ? 'OFF' : 'ON'} <kbd>M</kbd>`;
    this.dom.btnMute.classList.toggle('active', !muted);
  }

  toggleFxDrawer(force) {
    const show = force !== undefined ? force : this.dom.fxDrawer.classList.contains('hidden');
    this.dom.fxDrawer.classList.toggle('hidden', !show);
    this.dom.btnFxLab.classList.toggle('active', show);
  }

  togglePause(force) {
    if (this.state === 'PLAYING' && force !== false) {
      this.state = 'PAUSED';
      this.dom.pauseOverlay.classList.remove('hidden');
    } else if (this.state === 'PAUSED' && force !== true) {
      this.state = 'PLAYING';
      this.dom.pauseOverlay.classList.add('hidden');
    }
  }

  returnToMenu() {
    this.state = 'MENU';
    this.dom.menuOverlay.classList.remove('hidden');
    this.dom.upgradeModal.classList.add('hidden');
    this.dom.pauseOverlay.classList.add('hidden');
    this.dom.gameOverOverlay.classList.add('hidden');
    this.dom.topControls.classList.add('hidden');
    this.dom.fxDrawer.classList.add('hidden');
    this.audio.setBulletTime(false);
    this._loadBestStats();
  }

  startRun() {
    this.audio.init();
    this.audio.startMusic();
    this.audio.setBulletTime(false);

    const shipDef = SHIP_CLASSES.find(s => s.id === this.selectedShipId) || SHIP_CLASSES[0];
    this.player = {
      ship: shipDef,
      x: this.width * 0.5,
      y: this.height * 0.65,
      vx: 0,
      vy: 0,
      z: 55,
      vz: 0,
      heading: -Math.PI * 0.5,
      thrustSpeed: 150,
      angle: -Math.PI * 0.5,
      prevAngle: -Math.PI * 0.5,
      bank: 0,
      pitch: 0,
      wingSweep: 0,
      throttle: 0.25,
      muzzleFlashTimer: 0,
      contrailsLeft: [],
      contrailsRight: [],
      radius: 16,
      hp: shipDef.maxHp,
      maxHp: shipDef.maxHp,
      invuln: 1.5,
      fireTimer: 0,
      dashCooldown: 0,
      dashTimer: 0,
      dashDirX: 0,
      dashDirY: -1,
      singularityCooldown: 0,
      overdrive: this.selectedMode === 'zen_lab' ? 100 : 35,
      novabeamTimer: 0,
      orbitals: shipDef.id === 'tesla' ? 1 : 0,
      orbitalAngle: 0,
      overchargeTimer: 0,
      entropyShieldReady: false,
      entropyTimer: 0,
      upgrades: {},
      trail: []
    };

    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.singularities = [];
    this.particles = [];
    this.shockwaves = [];
    this.lightningArcs = [];
    this.railBeams = [];
    this.decoys = [];
    this.floatingTexts = [];

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.peakCombo = 1;
    this.kills = 0;
    this.parries = 0;
    this.trauma = 0;
    this.chronoShift = 0;
    this.bulletTimeTimer = 0;
    this.hitStopTimer = 0;
    this.paletteIdx = 0;
    this.pendingDrafts = 0;
    this.grid.resize(this.width, this.height, true);

    this.dom.menuOverlay.classList.add('hidden');
    this.dom.upgradeModal.classList.add('hidden');
    this.dom.pauseOverlay.classList.add('hidden');
    this.dom.gameOverOverlay.classList.add('hidden');
    this.dom.topControls.classList.remove('hidden');

    this.dom.btnMute.innerHTML = `AUDIO: ${this.audio.muted ? 'OFF' : 'ON'} <kbd>M</kbd>`;
    this.dom.btnMute.classList.toggle('active', !this.audio.muted);
    this.dom.btnAutoFire.classList.toggle('active', this.autoFire);

    this.state = 'PLAYING';

    if (this.selectedMode === 'zen_lab') {
      this.wave = 1;
      this.waveQueue = [];
      this.toggleFxDrawer(true);
      this.addBanner('ZEN FX & PHYSICS LAB', 'CLICK TO TEST WEAPONS OR USE LAB TRIGGERS', '#2cf5ff', 3.2);
    } else if (this.selectedMode === 'boss_rush') {
      this.wave = 5;
      this.toggleFxDrawer(false);
      this._startWave(5);
    } else {
      this.wave = 1;
      this.toggleFxDrawer(false);
      this._startWave(1);
    }
  }

  _startWave(waveNum) {
    this.wave = waveNum;
    this.paletteIdx = Math.floor((waveNum - 1) / 2) % PALETTES.length;
    this.waveQueue = [];
    this.spawnTimer = 1.0;

    if (waveNum % 5 === 0) {
      const bossTier = ((waveNum / 5 - 1) % 3) + 1;
      const boss = createBoss(bossTier, this.width, this.height, waveNum);
      this.enemies.push(boss);
      this.audio.playBossAlarm();
      this.addBanner(`WARNING // WAVE ${waveNum}`, boss.name, '#ff335f', 3.0);
      this.addShockwave(boss.x, boss.y, 440, [1.0, 0.22, 0.45], 22);
      this.grid.applyImpulse(boss.x, boss.y, 380, 35);
      // Support escorts on higher boss waves
      for (let i = 0; i < 3 + Math.min(5, Math.floor(waveNum / 5)); i++) {
        this.waveQueue.push(i % 2 === 0 ? 'swarmer' : 'lancer');
      }
      return;
    }

    this.addBanner(`WAVE ${waveNum}`, 'HOSTILE SIGNATURES DETECTED', '#2cf5ff', 2.1);

    const count = 5 + waveNum * 2;
    const pool = ['swarmer'];
    if (waveNum >= 1) pool.push('lancer');
    if (waveNum >= 2) pool.push('weaver', 'splitter');
    if (waveNum >= 3) pool.push('aegis', 'gravity_mine');
    if (waveNum >= 4) pool.push('prism_sniper', 'carrier');

    for (let i = 0; i < count; i++) {
      this.waveQueue.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    // Always include at least two weavers when wave >= 2 so laser links shine
    if (waveNum >= 2) {
      this.waveQueue.push('weaver', 'weaver');
    }
  }

  spawnLabBoss(tier) {
    if (this.state !== 'PLAYING') return;
    const boss = createBoss(tier, this.width, this.height, tier * 5);
    this.enemies.push(boss);
    this.audio.playBossAlarm();
    this.addBanner(`LAB DEPLOYMENT`, boss.name, '#ffb830', 2.4);
    this.grid.applyImpulse(boss.x, boss.y, 340, 32);
  }

  purgeArena() {
    this.enemies.forEach(e => this.spawnBurst(e.x, e.y, e.color, 18, 220));
    this.enemies = [];
    this.enemyBullets = [];
    this.waveQueue = [];
    this.addShockwave(this.width * 0.5, this.height * 0.5, 550, [0.2, 0.95, 1.0], 26);
  }

  maxAllUpgrades() {
    if (!this.player) return;
    UPGRADES.forEach(u => {
      this.applyUpgradeToPlayer(u.id);
      this.applyUpgradeToPlayer(u.id);
    });
    this.player.overdrive = 100;
    this.audio.playLevelUp();
    this.addBanner('GODMODE ACTIVATED', 'ALL 18 AUGMENTATIONS INTEGRATED', '#2eff9f', 2.5);
  }

  getUpgradeStacks(id) {
    return (this.player && this.player.upgrades[id]) || 0;
  }

  applyUpgradeToPlayer(id) {
    if (!this.player) return;
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return;
    const cur = this.player.upgrades[id] || 0;
    if (cur >= def.maxStacks) return;
    this.player.upgrades[id] = cur + 1;

    if (id === 'orbital_aegis') {
      this.player.orbitals += 2;
    } else if (id === 'hyper_capacitor') {
      this.player.maxHp += 25;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    } else if (id === 'vampiric_nanites') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
    } else if (id === 'entropy_shield') {
      this.player.entropyShieldReady = true;
      this.player.entropyTimer = 0;
    }
  }

  openUpgradeDraft(reasonText = 'WAVE CLEARED // MODULE SYNC') {
    const available = UPGRADES.filter(u => this.getUpgradeStacks(u.id) < u.maxStacks);
    if (available.length === 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      this._advanceNextWave();
      return;
    }

    // Shuffle and pick 3
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    this.upgradeChoices = shuffled.slice(0, 3);
    this.state = 'UPGRADE';

    document.getElementById('upgradeReasonBadge').textContent = reasonText;
    const container = document.getElementById('upgradeCards');
    container.innerHTML = '';

    this.upgradeChoices.forEach((u, idx) => {
      const stacks = this.getUpgradeStacks(u.id);
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.style.setProperty('--card-color', u.color);
      card.innerHTML = `
        <div>
          <div class="upgrade-meta">
            <span class="badge" style="color:${u.color};border-color:${u.color};background:rgba(255,255,255,0.06)">${u.rarity}</span>
            <span class="upgrade-key">${idx + 1}</span>
          </div>
          <div class="upgrade-title">${u.name}</div>
          <div class="upgrade-desc">${u.desc}</div>
        </div>
        <div class="upgrade-stack">RANK ${stacks} &rarr; ${stacks + 1} / ${u.maxStacks}</div>
      `;
      card.addEventListener('click', () => this.selectUpgrade(u.id));
      container.appendChild(card);
    });

    this.dom.upgradeModal.classList.remove('hidden');
    this.audio.playLevelUp();
  }

  selectUpgrade(id) {
    this.applyUpgradeToPlayer(id);
    this.dom.upgradeModal.classList.add('hidden');

    if (this.pendingDrafts > 0) {
      this.pendingDrafts--;
      this.openUpgradeDraft(this.pendingDraftReason);
      return;
    }

    this.state = 'PLAYING';
    this.mouse.left = false;
    this.keys.clear();

    if (this.selectedMode !== 'zen_lab' && this.enemies.length === 0 && this.waveQueue.length === 0) {
      this._advanceNextWave();
    }
  }

  _advanceNextWave() {
    if (this.selectedMode === 'boss_rush') {
      this._startWave(this.wave + 5);
    } else {
      this._startWave(this.wave + 1);
    }
  }

  addBanner(text, sub = '', color = '#2cf5ff', duration = 2.2) {
    this.banner = { text, sub, color, timer: duration, maxTimer: duration };
  }

  addFloatingText(x, y, text, color = '#ffffff', size = 14, z = 58) {
    if (this.floatingTexts.length > 65) this.floatingTexts.shift();
    this.floatingTexts.push({
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 45,
      vy: -55 - Math.random() * 25,
      text,
      color,
      size,
      life: 0.78,
      maxLife: 0.78
    });
  }

  addShockwave(x, y, maxRadius, color = [0.2, 0.95, 1.0], thickness = 24, z = 35) {
    if (this.shockwaves.length < 16) {
      this.shockwaves.push({
        x, y, z, radius: 12, maxRadius, thickness, color, life: 0.55, maxLife: 0.55
      });
    }
  }

  spawnBurst(x, y, color, count = 24, speed = 260, size = 7, z = 55) {
    const cap = 12000;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= cap) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.2 + Math.random() * 0.95);
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: (Math.random() - 0.45) * spd * 0.7,
        size: size * (0.5 + Math.random() * 0.9),
        r: color[0],
        g: color[1],
        b: color[2],
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        stretch: 0.032,
        drag: 0.94
      });
    }
  }

  tryPhaseDash() {
    const p = this.player;
    if (!p || p.dashCooldown > 0) return;

    const camMode = this.camModes[this.camModeIdx];
    const isPov = camMode === 'chase_3d' || camMode === 'cockpit_3d';
    let dx = 0;
    let dy = 0;

    if (isPov) {
      const h = p.heading ?? p.angle;
      const fwd = (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ? -0.55 : 1.0;
      let strafe = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 0.9;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 0.9;
      const ch = Math.cos(h);
      const sh = Math.sin(h);
      dx = ch * fwd - sh * strafe;
      dy = sh * fwd + ch * strafe;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    } else {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;

      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.angle);
        dy = Math.sin(p.angle);
      } else {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }
    }

    const echoStacks = this.getUpgradeStacks('phase_echo');
    const cdMult = Math.pow(0.82, echoStacks);
    const dashSpeed = isPov ? 720 : 820;
    p.dashCooldown = p.ship.dashCooldown * cdMult;
    p.dashTimer = 0.2;
    p.invuln = Math.max(p.invuln, 0.32);
    p.dashDirX = dx;
    p.dashDirY = dy;
    p.vx = dx * dashSpeed;
    p.vy = dy * dashSpeed;

    this.audio.playDash();
    this.grid.applyImpulse(p.x, p.y, 180, 26);
    this.spawnBurst(p.x, p.y, p.ship.accent, 28, 300, 8);

    if (echoStacks > 0) {
      this.decoys.push({
        x: p.x,
        y: p.y,
        timer: 0.55,
        radius: 130 + echoStacks * 25,
        damage: 70 + echoStacks * 35,
        color: p.ship.color
      });
    }

    if (p.ship.id === 'solaris') {
      this.addShockwave(p.x, p.y, 175, p.ship.accent, 18);
      this.damageRadius(p.x, p.y, 165, 55, p.ship.accent);
    }

    // Immediate Chrono-Parry check at dash launch!
    this.checkBulletParry();
  }

  checkBulletParry() {
    const p = this.player;
    if (!p) return;
    let parried = 0;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) <= 58) {
        this.spawnBurst(b.x, b.y, [0.25, 1.0, 0.95], 12, 240, 7);
        this.enemyBullets.splice(i, 1);
        parried++;
      }
    }

    if (parried > 0) {
      // Clear surrounding bullets inside parry shockwave radius too
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (Math.hypot(b.x - p.x, b.y - p.y) <= 170) {
          this.spawnBurst(b.x, b.y, [0.4, 0.95, 1.0], 6, 180, 5);
          this.enemyBullets.splice(i, 1);
        }
      }

      this.parries += parried;
      this.hitStopTimer = 0.075;
      this.trauma = Math.min(1.0, this.trauma + 0.55);
      p.overdrive = Math.min(100, p.overdrive + 25);
      this.combo += parried * 2;
      this.comboTimer = 4.5;
      this.score += 350 * this.combo;

      const vamp = this.getUpgradeStacks('vampiric_nanites');
      if (vamp > 0) p.hp = Math.min(p.maxHp, p.hp + 3 * vamp);

      const chrono = this.getUpgradeStacks('chrono_reflex');
      if (chrono > 0) {
        this.bulletTimeTimer = Math.max(this.bulletTimeTimer, 1.8 + chrono * 0.7);
      } else {
        this.bulletTimeTimer = Math.max(this.bulletTimeTimer, 0.45);
      }

      this.audio.playParry();
      this.addShockwave(p.x, p.y, 260, [0.2, 1.0, 0.9], 28);
      this.grid.applyImpulse(p.x, p.y, 290, 42);
      this.damageRadius(p.x, p.y, 190, 85, [0.2, 1.0, 0.95]);
      this.addFloatingText(p.x, p.y - 26, `CHRONO PARRY x${parried}!`, '#2eff9f', 18);
    }
  }

  trySingularityWell() {
    const p = this.player;
    if (!p) return;
    if (this.selectedMode !== 'zen_lab' && p.singularityCooldown > 0) return;

    const tx = this.aimWorld.x;
    const ty = this.aimWorld.y;
    p.singularityCooldown = 6.5;

    this.spawnSingularity(tx, ty, false);

    if (this.getUpgradeStacks('binary_star') > 0) {
      const ang = Math.atan2(ty - p.y, tx - p.x) + Math.PI * 0.5;
      this.spawnSingularity(tx + Math.cos(ang) * 75, ty + Math.sin(ang) * 75, true);
    }
  }

  spawnSingularity(x, y, silent = false) {
    const p = this.player;
    const ehStacks = this.getUpgradeStacks('event_horizon');
    const isChronos = p && p.ship.id === 'chronos';
    const radiusMult = (isChronos ? 1.45 : 1.0) * (1 + ehStacks * 0.38);
    const durMult = isChronos ? 1.45 : 1.0;

    this.singularities.push({
      x: Math.max(40, Math.min(this.width - 40, x)),
      y: Math.max(40, Math.min(this.height - 40, y)),
      radius: 175 * radiusMult,
      lensingRadius: 95 * radiusMult,
      life: 3.5 * durMult,
      maxLife: 3.5 * durMult,
      dps: 72 * (1 + ehStacks * 0.45),
      spin: 0,
      strength: 1.0 + ehStacks * 0.25
    });

    if (!silent) this.audio.playBlackHole();
    this.addShockwave(x, y, 210, [0.7, 0.3, 1.0], 22);
    this.grid.applyImplosion(x, y, 250, 28);
  }

  tryOverdrive() {
    const p = this.player;
    if (!p || p.overdrive < 100 || p.novabeamTimer > 0) return;
    p.overdrive = 0;
    const res = this.getUpgradeStacks('aether_resonance');
    p.novabeamTimer = 4.0 + res * 1.8;
    this.trauma = Math.min(1.0, this.trauma + 0.65);
    this.audio.playBlackHole();
    this.addBanner('OVERDRIVE // AETHER NOVABEAM', 'PRISMATIC RELATIVISTIC DISCHARGE', '#ffb830', 2.0);
    this.addShockwave(p.x, p.y, 320, [1.0, 0.78, 0.2], 26);
  }

  triggerGridSupernova(x, y, radius = 380, force = 36) {
    this.grid.applyImpulse(x, y, radius, force);
    this.addShockwave(x, y, radius, [1.0, 0.4, 0.85], 26);
    this.spawnBurst(x, y, [1.0, 0.45, 0.9], 75, 420, 10);
    this.audio.playExplosion(1.6);
    this.trauma = Math.min(1.0, this.trauma + 0.45);
  }

  damageRadius(x, y, radius, dmg, color) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.radius) {
        this.damageEnemy(e, dmg, false, color);
      }
    }
  }

  damageEnemy(enemy, dmg, isCrit = false, hitColor = [1, 1, 1]) {
    if (!enemy || enemy.hp <= 0) return;

    const siphon = this.getUpgradeStacks('crimson_siphon');
    const comboBonus = siphon > 0 ? 1 + Math.min(1.2, this.combo * 0.02 * siphon) : 1;
    const finalDmg = dmg * comboBonus * (isCrit ? 1.85 : 1);

    enemy.hp -= finalDmg;
    enemy.hitFlash = 0.1;

    if (Math.random() < 0.55 || isCrit || enemy.isBoss) {
      this.addFloatingText(
        enemy.x + (Math.random() - 0.5) * 18,
        enemy.y - enemy.radius * 0.7,
        Math.round(finalDmg).toString() + (isCrit ? '!' : ''),
        isCrit ? '#ffb830' : '#eef8ff',
        isCrit ? 17 : 12
      );
    }

    if (enemy.hp <= 0) {
      this._onEnemyKilled(enemy);
    } else {
      this.audio.playHit();
      this.spawnBurst(enemy.x, enemy.y, hitColor, 4, 150, 5);
    }
  }

  _onEnemyKilled(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.kills++;
    this.combo++;
    this.comboTimer = 4.0;
    if (this.combo > this.peakCombo) this.peakCombo = this.combo;

    const mult = 1 + Math.min(25, Math.floor(this.combo / 4));
    this.score += enemy.score * mult;

    const capStacks = this.getUpgradeStacks('hyper_capacitor');
    if (this.player) {
      this.player.overdrive = Math.min(100, this.player.overdrive + (enemy.isBoss ? 50 : 3.4) * (1 + capStacks * 0.25));
      const vamp = this.getUpgradeStacks('vampiric_nanites');
      if (vamp > 0 && Math.random() < 0.22 * vamp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      }
    }

    const burstCount = enemy.isBoss ? 180 : 28;
    this.spawnBurst(enemy.x, enemy.y, enemy.color, burstCount, enemy.isBoss ? 480 : 280, enemy.isBoss ? 12 : 8);
    this.grid.applyImpulse(enemy.x, enemy.y, enemy.isBoss ? 420 : 125, enemy.isBoss ? 45 : 14);
    this.addShockwave(enemy.x, enemy.y, enemy.isBoss ? 450 : 95, enemy.color, enemy.isBoss ? 30 : 14);
    this.audio.playExplosion(enemy.isBoss ? 2.0 : 0.75);
    this.trauma = Math.min(1.0, this.trauma + (enemy.isBoss ? 0.85 : 0.14));

    if (enemy.isBoss) {
      this.hitStopTimer = 0.095;
      this.enemyBullets = [];
      this.addBanner('BOSS VAPORIZED', `${enemy.name} OBLITERATED`, '#2eff9f', 2.8);
    }

    // Splitter spawns 3 mini cores
    if (enemy.type === 'splitter' && !enemy.isMini) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const m = createEnemy('mini_splitter', enemy.x + Math.cos(a) * 18, enemy.y + Math.sin(a) * 18, this.wave);
        m.vx = Math.cos(a) * 200;
        m.vy = Math.sin(a) * 200;
        this.enemies.push(m);
      }
    }

    // Gravity Mine death burst
    if (enemy.type === 'gravity_mine') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.enemyBullets.push({
          x: enemy.x, y: enemy.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
          radius: 5, color: [0.9, 0.25, 1.0], life: 3.5
        });
      }
    }

    // Hawking Supernova upgrade
    const novaStacks = this.getUpgradeStacks('hawking_nova');
    if (novaStacks > 0) {
      const r = 115 + novaStacks * 35;
      this.addShockwave(enemy.x, enemy.y, r, [1.0, 0.25, 0.75], 16);
      this.grid.applyImpulse(enemy.x, enemy.y, r, 16);
      this.damageRadius(enemy.x, enemy.y, r, 36 + novaStacks * 22, [1.0, 0.3, 0.75]);
    }
  }

  _damagePlayer(dmg) {
    const p = this.player;
    if (!p || p.invuln > 0) return;
    if (this.selectedMode === 'zen_lab') {
      this.addFloatingText(p.x, p.y - 24, 'LAB SHIELD', '#2cf5ff', 13);
      p.invuln = 0.5;
      return;
    }

    if (p.entropyShieldReady) {
      p.entropyShieldReady = false;
      p.entropyTimer = 11.0;
      p.invuln = 1.0;
      this.addShockwave(p.x, p.y, 240, [0.2, 0.95, 1.0], 24);
      this.damageRadius(p.x, p.y, 200, 65, [0.2, 0.95, 1.0]);
      this.audio.playParry();
      this.addFloatingText(p.x, p.y - 24, 'AEGIS ABSORBED!', '#2cf5ff', 15);
      return;
    }

    p.hp -= dmg;
    p.invuln = 0.75;
    this.combo = 1;
    this.trauma = Math.min(1.0, this.trauma + 0.55);
    this.grid.applyImpulse(p.x, p.y, 220, 26);
    this.spawnBurst(p.x, p.y, [1.0, 0.2, 0.35], 36, 300, 9);
    this.audio.playExplosion(1.1);

    if (p.hp <= 0) {
      p.hp = 0;
      this._triggerGameOver();
    }
  }

  _triggerGameOver() {
    this.state = 'GAMEOVER';
    this.audio.setBulletTime(false);
    this._saveBestStats();

    document.getElementById('runStatsGrid').innerHTML = `
      <div class="run-stat"><span>FINAL SCORE</span><strong>${Math.floor(this.score).toLocaleString()}</strong></div>
      <div class="run-stat"><span>WAVE REACHED</span><strong>${this.wave}</strong></div>
      <div class="run-stat"><span>PEAK COMBO</span><strong>x${this.peakCombo}</strong></div>
      <div class="run-stat"><span>VAPORIZED</span><strong>${this.kills}</strong></div>
      <div class="run-stat"><span>BULLETS PARRIED</span><strong>${this.parries}</strong></div>
      <div class="run-stat"><span>VESSEL</span><strong>${this.player.ship.name}</strong></div>
    `;

    const upgDiv = document.getElementById('collectedUpgradesList');
    upgDiv.innerHTML = '';
    Object.entries(this.player.upgrades).forEach(([id, rank]) => {
      const def = UPGRADES.find(u => u.id === id);
      if (def) {
        const pill = document.createElement('span');
        pill.className = 'upg-pill';
        pill.textContent = `${def.name} Lv.${rank}`;
        upgDiv.appendChild(pill);
      }
    });

    this.dom.gameOverOverlay.classList.remove('hidden');
  }

  _loop(now) {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this._lastTime) / 1000));
    this._lastTime = now;
    this.time += rawDt;

    this.frameCount++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.4) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const audioEnergy = this.audio.getAudioEnergy();
    const camMode = this.state === 'MENU' ? 'tactical_3d' : this.camModes[this.camModeIdx];
    this.renderer.updateCamera(camMode, this.player, this.width, this.height, rawDt);
    this.aimWorld = this.renderer.screenToWorldPlane(
      this.mouse.x,
      this.mouse.y,
      this.player ? this.player.z : 55
    );

    if (this.state === 'MENU') {
      // Ambient background spacetime waves on the menu screen
      if (Math.random() < 0.04) {
        this.grid.applyImpulse(
          this.width * (0.2 + Math.random() * 0.6),
          this.height * (0.2 + Math.random() * 0.6),
          200,
          10
        );
      }
      const menuDt = rawDt * 0.6;
      this.grid.update(menuDt, audioEnergy.bass, this.fx.elasticity);
      this.arMap.update(menuDt, [], [], () => {}, []);
      this._renderScene(audioEnergy);
      this._clearHUD();
    } else if (this.state === 'PLAYING') {
      this._updatePlaying(rawDt, audioEnergy);
      this._renderScene(audioEnergy);
      this._renderHUD(audioEnergy);
    } else {
      // PAUSED / UPGRADE / GAMEOVER — keep rendering crisp frame without advancing simulation
      this._renderScene(audioEnergy);
      this._renderHUD(audioEnergy);
    }

    this._updateLabTelemetry();
    requestAnimationFrame(t => this._loop(t));
  }

  _updateLabTelemetry() {
    if (this.dom.fxDrawer.classList.contains('hidden')) return;
    document.getElementById('telRenderer').textContent = this.renderer.fallback2D ? 'Canvas 2D' : 'WebGL2 HDR';
    document.getElementById('telParticles').textContent = String(this.particles.length);
    document.getElementById('telSingularities').textContent = String(this.singularities.length);
  }

  _updatePlaying(rawDt, audioEnergy) {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      this.trauma = Math.max(0, this.trauma - rawDt * 1.4);
      return;
    }

    const pacing = PACING_PRESETS[this.pacingIdx].scale;
    const baseDt = rawDt * this.fx.timeScale * pacing;
    let worldScale = 1.0;
    let playerScale = 1.0;

    if (this.bulletTimeTimer > 0) {
      this.bulletTimeTimer -= rawDt;
      worldScale = 0.34;
      playerScale = 0.92;
      this.chronoShift = Math.min(1, this.chronoShift + rawDt * 6);
    } else {
      this.chronoShift = Math.max(0, this.chronoShift - rawDt * 4);
    }

    const pDt = baseDt * playerScale;
    const wDt = baseDt * worldScale;

    this.trauma = Math.max(0, this.trauma - rawDt * 1.35);
    if (this.comboTimer > 0) {
      this.comboTimer -= wDt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.banner.timer > 0) {
      this.banner.timer -= rawDt;
    }

    // Adaptive audio feedback
    const intensity = Math.min(1, this.enemies.length / 22 + (this.combo > 15 ? 0.25 : 0));
    const bossActive = this.enemies.some(e => e.isBoss);
    this.audio.setCombatState({
      intensity,
      combo: this.combo,
      bossActive,
      bulletTime: this.bulletTimeTimer > 0
    });

    this._updatePlayer(pDt);
    this._updateWaveDirector(wDt);
    this._updateSingularities(wDt);
    this._updateDecoys(wDt);
    this._updatePlayerBullets(wDt);
    this._updateEnemies(wDt);
    this._updateEnemyBullets(wDt);
    this._updateEffects(rawDt);

    this.arMap.update(
      wDt,
      this.enemies,
      this.singularities,
      (e, dmg, crit, col) => this.damageEnemy(e, dmg, crit, col),
      this.lightningArcs
    );
    this.grid.update(wDt, audioEnergy.bass, this.fx.elasticity);
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (!p) return;

    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.singularityCooldown = Math.max(0, p.singularityCooldown - dt);

    const oc = this.getUpgradeStacks('overclock');
    const speed = p.ship.speed * (1 + oc * 0.1);
    const camMode = this.camModes[this.camModeIdx];
    const isPov = camMode === 'chase_3d' || camMode === 'cockpit_3d';
    if (p.heading === undefined) p.heading = p.angle;
    const prevHeading = p.heading;

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      this.grid.applyDirectedForce(p.x, p.y, p.vx * 0.025, p.vy * 0.025, 95);
      this.checkBulletParry();
      p.trail.push({ x: p.x, y: p.y, z: p.z, alpha: 0.9 });
    } else if (isPov) {
      // Stable 3D POV Flight: A/D + gentle screen-edge mouse steer control flight heading (no feedback spin!)
      let steer = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;

      const normX = Math.max(-1, Math.min(1, (this.mouse.x / Math.max(1, this.width) - 0.5) * 2));
      const mouseTurn = Math.abs(normX) > 0.22
        ? Math.sign(normX) * ((Math.abs(normX) - 0.22) / 0.78) * 0.95
        : 0;
      p.heading += (steer * 2.15 + mouseTurn) * dt;

      let throttleInput = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttleInput += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttleInput -= 1;
      const targetSpeed = throttleInput > 0
        ? speed * 1.24
        : (throttleInput < 0 ? speed * 0.42 : speed * 0.74);
      p.thrustSpeed = (p.thrustSpeed ?? speed * 0.74) + (targetSpeed - (p.thrustSpeed ?? speed * 0.74)) * Math.min(1, dt * 6.0);

      const desVx = Math.cos(p.heading) * p.thrustSpeed;
      const desVy = Math.sin(p.heading) * p.thrustSpeed;
      p.vx += (desVx - p.vx) * Math.min(1, 8.5 * dt);
      p.vy += (desVy - p.vy) * Math.min(1, 8.5 * dt);
    } else {
      let mx = 0;
      let my = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
      }
      const accel = 10.5;
      p.vx += (mx * speed - p.vx) * Math.min(1, accel * dt);
      p.vy += (my * speed - p.vy) * Math.min(1, accel * dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 3D Altitude & Pitch dynamics (swoops up during Phase Dash, gentle hover in cruise)
    const targetZ = (p.dashTimer > 0 ? 84 : 55) + Math.sin(this.time * 2.4) * 3.5;
    const prevZ = p.z;
    p.z += (targetZ - p.z) * Math.min(1, dt * 8.5);
    p.pitch = Math.max(-0.28, Math.min(0.28, (p.z - prevZ) * 0.35 + (p.dashTimer > 0 ? 0.14 : 0)));

    // Solid 3D Perimeter Forcefield Boundaries
    const pad = 36;
    if (p.x < pad) { p.x = pad; p.vx = Math.max(0, p.vx); if (isPov && Math.cos(p.heading) < 0) p.heading = Math.PI - p.heading; }
    if (p.x > this.width - pad) { p.x = this.width - pad; p.vx = Math.min(0, p.vx); if (isPov && Math.cos(p.heading) > 0) p.heading = Math.PI - p.heading; }
    if (p.y < pad) { p.y = pad; p.vy = Math.max(0, p.vy); if (isPov && Math.sin(p.heading) < 0) p.heading = -p.heading; }
    if (p.y > this.height - pad) { p.y = this.height - pad; p.vy = Math.min(0, p.vy); if (isPov && Math.sin(p.heading) > 0) p.heading = -p.heading; }

    // Smooth 3D solid building hull deflection
    this.arMap.resolveEntityCollision(p);

    p.prevAngle = p.angle;
    let aimTargetX = this.aimWorld.x;
    let aimTargetY = this.aimWorld.y;

    if (isPov) {
      // Soft reticle snap onto enemies in forward hemisphere within 48px of cursor
      let bestDist = 48;
      for (const e of this.enemies) {
        const scr = this.renderer.worldToScreen(e.x, e.y, e.z ?? 55);
        if (!scr.visible) continue;
        const dScr = Math.hypot(scr.x - this.mouse.x, scr.y - this.mouse.y);
        if (dScr < bestDist) {
          let rel = Math.atan2(e.y - p.y, e.x - p.x) - p.heading;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          if (Math.abs(rel) <= 1.2) {
            bestDist = dScr;
            aimTargetX = e.x;
            aimTargetY = e.y;
          }
        }
      }
      const rawAim = Math.atan2(aimTargetY - p.y, aimTargetX - p.x);
      let gimbalDiff = rawAim - p.heading;
      while (gimbalDiff > Math.PI) gimbalDiff -= Math.PI * 2;
      while (gimbalDiff < -Math.PI) gimbalDiff += Math.PI * 2;
      gimbalDiff = Math.max(-1.15, Math.min(1.15, gimbalDiff));
      p.angle = p.heading + gimbalDiff;
    } else {
      p.angle = Math.atan2(aimTargetY - p.y, aimTargetX - p.x);
      let hDiff = p.angle - p.heading;
      while (hDiff > Math.PI) hDiff -= Math.PI * 2;
      while (hDiff < -Math.PI) hDiff += Math.PI * 2;
      p.heading += hDiff * Math.min(1, dt * 8.0);
    }

    // 3D Roll Banking Inertia & Variable-Geometry Wing Sweep
    const bodyAng = isPov ? p.heading : p.angle;
    let angDiff = (isPov ? p.heading - prevHeading : p.angle - p.prevAngle);
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;
    const turnRate = angDiff / Math.max(0.001, dt);
    const latVel = -Math.sin(bodyAng) * p.vx + Math.cos(bodyAng) * p.vy;
    const targetBank = Math.max(-1, Math.min(1, isPov ? turnRate * 0.42 : (latVel / 240 + turnRate * 0.14)));
    p.bank += (targetBank - p.bank) * Math.min(1, dt * 11.0);

    const velMag = Math.hypot(p.vx, p.vy);
    p.throttle = Math.min(1.5, Math.max(0.18, velMag / speed));
    const wantsSweep = p.dashTimer > 0 || p.novabeamTimer > 0 || velMag > speed * 0.88;
    p.wingSweep += ((wantsSweep ? 1 : 0) - p.wingSweep) * Math.min(1, dt * 7.5);
    p.muzzleFlashTimer = Math.max(0, p.muzzleFlashTimer - dt);

    // Aerodynamic 3D Wingtip Contrail Vortex Ribbons
    const span = (p.ship.wingspan || 22) * (1 - Math.abs(p.bank) * 0.22) * (1 - p.wingSweep * 0.16);
    const aft = -4 - p.wingSweep * 10;
    const ca = Math.cos(bodyAng), sa = Math.sin(bodyAng);
    const lx = p.x + ca * aft + sa * span;
    const ly = p.y + sa * aft - ca * span;
    const rx = p.x + ca * aft - sa * span;
    const ry = p.y + sa * aft + ca * span;
    const tipDZ = p.bank * 9;
    if (velMag > 85 || p.dashTimer > 0) {
      const intensity = Math.min(1, (velMag / speed) * 0.55 + Math.abs(p.bank) * 0.45 + (p.dashTimer > 0 ? 0.5 : 0));
      p.contrailsLeft.push({ x: lx, y: ly, z: p.z + tipDZ, life: 0.42, maxLife: 0.42, alpha: intensity });
      p.contrailsRight.push({ x: rx, y: ry, z: p.z - tipDZ, life: 0.42, maxLife: 0.42, alpha: intensity });
      if (p.contrailsLeft.length > 26) p.contrailsLeft.shift();
      if (p.contrailsRight.length > 26) p.contrailsRight.shift();
    }
    for (let i = p.contrailsLeft.length - 1; i >= 0; i--) {
      p.contrailsLeft[i].life -= dt;
      if (p.contrailsLeft[i].life <= 0) p.contrailsLeft.splice(i, 1);
    }
    for (let i = p.contrailsRight.length - 1; i >= 0; i--) {
      p.contrailsRight[i].life -= dt;
      if (p.contrailsRight[i].life <= 0) p.contrailsRight.splice(i, 1);
    }

    // Thruster exhaust particles
    if (velMag > 45 && Math.random() < 0.85) {
      const bx = p.x - Math.cos(bodyAng) * 16;
      const by = p.y - Math.sin(bodyAng) * 16;
      this.particles.push({
        x: bx + (Math.random() - 0.5) * 6,
        y: by + (Math.random() - 0.5) * 6,
        z: p.z,
        vx: -Math.cos(bodyAng) * 120 + (Math.random() - 0.5) * 40,
        vy: -Math.sin(bodyAng) * 120 + (Math.random() - 0.5) * 40,
        vz: (Math.random() - 0.5) * 30,
        size: 5.5,
        r: p.ship.accent[0],
        g: p.ship.accent[1],
        b: p.ship.accent[2],
        life: 0.25,
        maxLife: 0.25,
        stretch: 0.02,
        drag: 0.92
      });
    }

    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].alpha -= dt * 3.8;
      if (p.trail[i].alpha <= 0) p.trail.splice(i, 1);
    }

    // Entropy Aegis recharge
    if (this.getUpgradeStacks('entropy_shield') > 0 && !p.entropyShieldReady) {
      p.entropyTimer -= dt;
      if (p.entropyTimer <= 0) {
        p.entropyShieldReady = true;
        this.addFloatingText(p.x, p.y - 24, 'AEGIS READY', '#2cf5ff', 12);
      }
    }

    // Tesla Overcharge passive shock
    const overStacks = this.getUpgradeStacks('tesla_overcharge');
    if (overStacks > 0) {
      p.overchargeTimer -= dt;
      if (p.overchargeTimer <= 0) {
        p.overchargeTimer = Math.max(0.6, 1.8 - overStacks * 0.35);
        const nearby = this.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 220).slice(0, 2 + overStacks);
        nearby.forEach(e => {
          this.lightningArcs.push({
            pts: generateLightningPoints(p.x, p.y, e.x, e.y, 26, 4),
            color: [0.35, 0.75, 1.0],
            life: 0.18,
            maxLife: 0.18
          });
          this.damageEnemy(e, 34 * overStacks, false, [0.4, 0.85, 1.0]);
          this.audio.playLightning(0.45);
        });
      }
    }

    // Orbitals
    if (p.orbitals > 0) {
      p.orbitalAngle += dt * 3.4;
      const orbR = 54;
      for (let i = 0; i < p.orbitals; i++) {
        const a = p.orbitalAngle + (i / p.orbitals) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * orbR;
        const oy = p.y + Math.sin(a) * orbR;
        for (let b = this.enemyBullets.length - 1; b >= 0; b--) {
          const eb = this.enemyBullets[b];
          if (Math.hypot(eb.x - ox, eb.y - oy) < 16) {
            this.spawnBurst(eb.x, eb.y, p.ship.accent, 5, 120, 4);
            this.enemyBullets.splice(b, 1);
          }
        }
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const en = this.enemies[eIdx];
          if (Math.hypot(en.x - ox, en.y - oy) < en.radius + 12) {
            this.damageEnemy(en, 75 * dt, false, p.ship.accent);
          }
        }
      }
    }

    // Overdrive Novabeam
    if (p.novabeamTimer > 0) {
      p.novabeamTimer -= dt;
      this._fireNovabeam(dt);
      return;
    }

    // Primary Fire
    p.fireTimer -= dt;
    const wantsFire = this.mouse.left || this.autoFire;
    if (wantsFire && p.fireTimer <= 0) {
      const rateMult = (1 + oc * 0.18) * (this.bulletTimeTimer > 0 && this.getUpgradeStacks('chrono_reflex') > 0 ? 1.85 : 1);
      p.fireTimer = p.ship.fireRate / rateMult;
      this._firePrimary();
    }
  }

  _fireNovabeam(dt) {
    const p = this.player;
    const res = this.getUpgradeStacks('aether_resonance');
    const width = 34 + res * 16;
    const len = Math.max(this.width, this.height) * 1.25;
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    const ex = p.x + dx * len;
    const ey = p.y + dy * len;

    this.audio.playLaserLoop();
    this.trauma = Math.min(1.0, Math.max(this.trauma, 0.25));
    this.grid.applyDirectedForce(p.x + dx * 220, p.y + dy * 220, dx * 28, dy * 28, 160);

    // Beam collision with enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const proj = (e.x - p.x) * dx + (e.y - p.y) * dy;
      if (proj > 0 && proj < len) {
        const perp = Math.abs((e.x - p.x) * -dy + (e.y - p.y) * dx);
        if (perp <= width + e.radius) {
          this.damageEnemy(e, 540 * dt, Math.random() < 0.25, [1.0, 0.85, 0.35]);
        }
      }
    }

    // Beam vaporizes enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      const proj = (b.x - p.x) * dx + (b.y - p.y) * dy;
      if (proj > 0 && proj < len) {
        const perp = Math.abs((b.x - p.x) * -dy + (b.y - p.y) * dx);
        if (perp <= width + 10) {
          this.spawnBurst(b.x, b.y, [1.0, 0.85, 0.4], 4, 150, 5);
          this.enemyBullets.splice(i, 1);
        }
      }
    }

    // Emit beam core & electric arcs
    this.railBeams.push({
      x1: p.x + dx * 18,
      y1: p.y + dy * 18,
      x2: ex,
      y2: ey,
      width,
      color: [1.0, 0.82, 0.28],
      life: 0.06,
      maxLife: 0.06
    });
    if (Math.random() < 0.7) {
      const dist = 120 + Math.random() * 560;
      this.lightningArcs.push({
        pts: generateLightningPoints(p.x + dx * 22, p.y + dy * 22, p.x + dx * dist, p.y + dy * dist, 38, 4),
        color: [0.35, 0.95, 1.0],
        life: 0.08,
        maxLife: 0.08
      });
    }
  }

  _firePrimary() {
    const p = this.player;
    const split = this.getUpgradeStacks('split_shot');
    const pierce = this.getUpgradeStacks('prismatic_pierce');
    const bounce = this.getUpgradeStacks('ricochet');
    const overStacks = this.getUpgradeStacks('tesla_overcharge');
    const siphon = this.getUpgradeStacks('crimson_siphon');
    const critChance = 0.08 + overStacks * 0.15;
    const velMult = 1 + siphon * 0.15;

    this.audio.playShoot(p.ship.weaponType);
    p.muzzleFlashTimer = 0.075;

    if (p.ship.weaponType === 'pulse') {
      const count = 2 + split * 2;
      const spread = 0.09;
      for (let i = 0; i < count; i++) {
        const offsetIdx = i - (count - 1) * 0.5;
        const ang = p.angle + offsetIdx * spread * 0.55;
        const perpX = -Math.sin(p.angle) * offsetIdx * 7;
        const perpY = Math.cos(p.angle) * offsetIdx * 7;
        const spd = 820 * velMult;
        this.playerBullets.push({
          type: 'pulse',
          x: p.x + Math.cos(p.angle) * 16 + perpX,
          y: p.y + Math.sin(p.angle) * 16 + perpY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          dmg: 22,
          radius: 5,
          pierce: pierce * 2,
          bounces: bounce * 2,
          color: i % 2 === 0 ? p.ship.color : p.ship.accent,
          crit: Math.random() < critChance,
          life: 1.8,
          lensed: false,
          hitIds: new Set()
        });
      }
    } else if (p.ship.weaponType === 'tesla') {
      const chains = 4 + split * 2 + this.getUpgradeStacks('chain_lightning') * 2;
      const maxRange = 410;
      const targets = [];
      let curX = p.x;
      let curY = p.y;
      const hitSet = new Set();

      for (let c = 0; c < chains; c++) {
        let best = null;
        let bestDist = c === 0 ? maxRange : 240;
        for (const e of this.enemies) {
          if (hitSet.has(e)) continue;
          const d = Math.hypot(e.x - curX, e.y - curY);
          if (c === 0) {
            const angToE = Math.atan2(e.y - p.y, e.x - p.x);
            let diff = Math.abs(angToE - p.angle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff > 0.85) continue;
          }
          if (d < bestDist) {
            bestDist = d;
            best = e;
          }
        }
        if (!best) break;
        hitSet.add(best);
        targets.push(best);
        this.lightningArcs.push({
          pts: generateLightningPoints(curX, curY, best.x, best.y, 26, 4),
          color: c === 0 ? p.ship.color : p.ship.accent,
          life: 0.16,
          maxLife: 0.16
        });
        curX = best.x;
        curY = best.y;
      }

      if (targets.length === 0) {
        const tx = p.x + Math.cos(p.angle) * 260;
        const ty = p.y + Math.sin(p.angle) * 260;
        this.lightningArcs.push({
          pts: generateLightningPoints(p.x, p.y, tx, ty, 22, 4),
          color: p.ship.color,
          life: 0.12,
          maxLife: 0.12
        });
      } else {
        targets.forEach((e, idx) => {
          this.damageEnemy(e, (34 + pierce * 8) * Math.pow(0.88, idx), Math.random() < critChance, p.ship.accent);
        });
      }
    } else if (p.ship.weaponType === 'rail') {
      const beams = 1 + split;
      const len = Math.max(this.width, this.height) * 1.25;
      for (let b = 0; b < beams; b++) {
        const ang = p.angle + (b - (beams - 1) * 0.5) * 0.08;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const beamW = 9 + pierce * 4;
        const ex = p.x + dx * len;
        const ey = p.y + dy * len;

        this.railBeams.push({
          x1: p.x + dx * 16,
          y1: p.y + dy * 16,
          x2: ex,
          y2: ey,
          width: beamW,
          color: b % 2 === 0 ? p.ship.color : p.ship.accent,
          life: 0.18,
          maxLife: 0.18
        });
        this.grid.applyDirectedForce(p.x + dx * 200, p.y + dy * 200, dx * 24, dy * 24, 120);

        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const proj = (e.x - p.x) * dx + (e.y - p.y) * dy;
          if (proj > 0 && proj < len) {
            const perp = Math.abs((e.x - p.x) * -dy + (e.y - p.y) * dx);
            if (perp <= beamW + e.radius) {
              this.damageEnemy(e, 78 * (1 + pierce * 0.3), Math.random() < critChance, p.ship.accent);
              this._maybeChainLightning(e, 30);
            }
          }
        }
      }
    } else if (p.ship.weaponType === 'missile') {
      const count = 3 + split * 2;
      for (let i = 0; i < count; i++) {
        const ang = p.angle + (i - (count - 1) * 0.5) * 0.32;
        const spd = 460 * velMult;
        this.playerBullets.push({
          type: 'missile',
          x: p.x + Math.cos(ang) * 12,
          y: p.y + Math.sin(ang) * 12,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          speed: spd + 140,
          dmg: 32,
          radius: 6,
          pierce: pierce,
          bounces: bounce,
          color: i % 2 === 0 ? p.ship.color : p.ship.accent,
          crit: Math.random() < critChance,
          life: 2.6,
          lensed: false,
          hitIds: new Set()
        });
      }
    }
  }

  _maybeChainLightning(sourceEnemy, dmg) {
    const cl = this.getUpgradeStacks('chain_lightning');
    if (cl <= 0) return;
    let chained = 0;
    for (const e of this.enemies) {
      if (e === sourceEnemy || e.hp <= 0) continue;
      if (Math.hypot(e.x - sourceEnemy.x, e.y - sourceEnemy.y) < 195) {
        this.lightningArcs.push({
          pts: generateLightningPoints(sourceEnemy.x, sourceEnemy.y, e.x, e.y, 20, 3),
          color: [0.55, 0.85, 1.0],
          life: 0.14,
          maxLife: 0.14
        });
        this.damageEnemy(e, dmg * cl, false, [0.55, 0.85, 1.0]);
        chained++;
        if (chained >= cl + 1) break;
      }
    }
  }

  _updateWaveDirector(dt) {
    if (this.selectedMode === 'zen_lab') return;

    if (this.waveQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = this.waveQueue.shift();
        const edge = Math.floor(Math.random() * 4);
        let sx = 0, sy = 0;
        if (edge === 0) { sx = Math.random() * this.width; sy = -30; }
        else if (edge === 1) { sx = this.width + 30; sy = Math.random() * this.height; }
        else if (edge === 2) { sx = Math.random() * this.width; sy = this.height + 30; }
        else { sx = -30; sy = Math.random() * this.height; }

        this.enemies.push(createEnemy(type, sx, sy, this.wave));
        this.spawnTimer = Math.max(0.45, 1.08 - this.wave * 0.035);
      }
    } else if (this.enemies.length === 0) {
      if (this.selectedMode === 'boss_rush') {
        this.pendingDrafts = 1;
        this.pendingDraftReason = `BOSS WAVE ${this.wave} CLEARED // DOUBLE MODULE SYNC (2/2)`;
        this.openUpgradeDraft(`BOSS WAVE ${this.wave} CLEARED // DOUBLE MODULE SYNC (1/2)`);
      } else {
        this.openUpgradeDraft(`WAVE ${this.wave} CLEARED // MODULE SYNC`);
      }
    }
  }

  _updateSingularities(dt) {
    for (let i = this.singularities.length - 1; i >= 0; i--) {
      const s = this.singularities[i];
      s.life -= dt;
      s.spin += dt * 4.5;
      this.grid.applyImplosion(s.x, s.y, s.radius * 1.15, 4.8 * s.strength);

      // Orbiting accretion particles
      if (Math.random() < 0.9) {
        const a = Math.random() * Math.PI * 2;
        const r = s.radius * (0.25 + Math.random() * 0.7);
        this.particles.push({
          x: s.x + Math.cos(a) * r,
          y: s.y + Math.sin(a) * r,
          vx: -Math.sin(a) * 190 - Math.cos(a) * 90,
          vy: Math.cos(a) * 190 - Math.sin(a) * 90,
          size: 5.5,
          r: 0.65,
          g: 0.35,
          b: 1.0,
          life: 0.35,
          maxLife: 0.35,
          stretch: 0.025,
          drag: 0.96
        });
      }

      // Pull enemies inward + DoT
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const e = this.enemies[eIdx];
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < s.radius && d > 4) {
          const pull = (1 - d / s.radius) * (e.isBoss ? 140 : 480) * s.strength;
          e.x += (dx / d) * pull * dt;
          e.y += (dy / d) * pull * dt;
          this.damageEnemy(e, s.dps * dt, false, [0.72, 0.4, 1.0]);
        }
      }

      // Bend & consume enemy bullets
      for (let bIdx = this.enemyBullets.length - 1; bIdx >= 0; bIdx--) {
        const b = this.enemyBullets[bIdx];
        const dx = s.x - b.x;
        const dy = s.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < s.lensingRadius * 0.42) {
          this.enemyBullets.splice(bIdx, 1);
        } else if (d < s.radius) {
          const pull = (1 - d / s.radius) * 700;
          b.vx += (dx / d) * pull * dt;
          b.vy += (dy / d) * pull * dt;
        }
      }

      if (s.life <= 0) {
        // Hawking Collapse Implosion -> Supernova!
        this.singularities.splice(i, 1);
        this.audio.playExplosion(1.5);
        this.trauma = Math.min(1.0, this.trauma + 0.55);
        this.grid.applyImpulse(s.x, s.y, s.radius * 1.4, 40);
        this.addShockwave(s.x, s.y, s.radius * 1.35, [0.45, 0.9, 1.0], 28);
        this.spawnBurst(s.x, s.y, [0.75, 0.45, 1.0], 90, 420, 10);
        this.damageRadius(s.x, s.y, s.radius * 0.9, s.dps * 2.2, [0.6, 0.85, 1.0]);
        this.addFloatingText(s.x, s.y - 16, 'SINGULARITY COLLAPSE!', '#b066ff', 16);
      }
    }
  }

  _updateDecoys(dt) {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.timer -= dt;
      if (d.timer <= 0) {
        this.decoys.splice(i, 1);
        this.addShockwave(d.x, d.y, d.radius, d.color, 18);
        this.spawnBurst(d.x, d.y, d.color, 36, 300, 8);
        this.damageRadius(d.x, d.y, d.radius, d.damage, d.color);
        this.audio.playExplosion(0.8);
      }
    }
  }

  _updatePlayerBullets(dt) {
    const lensUpg = this.getUpgradeStacks('gravity_lensing');
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Homing behavior for missiles
      if (b.type === 'missile' && this.enemies.length > 0) {
        let best = null;
        let bestD = 550;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const targetAng = Math.atan2(best.y - b.y, best.x - b.x);
          const curAng = Math.atan2(b.vy, b.vx);
          let diff = targetAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAng = curAng + Math.max(-7 * dt, Math.min(7 * dt, diff));
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(nextAng) * spd;
          b.vy = Math.sin(nextAng) * spd;
        }
        if (Math.random() < 0.7) {
          this.particles.push({
            x: b.x, y: b.y, vx: -b.vx * 0.15, vy: -b.vy * 0.15,
            size: 4.5, r: b.color[0], g: b.color[1], b: b.color[2],
            life: 0.22, maxLife: 0.22, stretch: 0.02, drag: 0.92
          });
        }
      }

      // Photon Lensing through Singularities
      if (lensUpg > 0 && !b.lensed) {
        for (const s of this.singularities) {
          if (Math.hypot(b.x - s.x, b.y - s.y) < s.lensingRadius * 0.85) {
            b.lensed = true;
            b.dmg *= 1.85;
            b.vx *= 1.35;
            b.vy *= 1.35;
            b.color = [1.0, 0.85, 0.25];
            // Spawn duplicate angled shot
            if (this.playerBullets.length < 360) {
              const ang = Math.atan2(b.vy, b.vx) + 0.22;
              const spd = Math.hypot(b.vx, b.vy);
              this.playerBullets.push({
                ...b,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                hitIds: new Set(b.hitIds)
              });
            }
            break;
          }
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 3D solid building cover block (piercing rail/upgrades can punch through)
      const hitBldg = this.arMap.checkBulletHit(b.x, b.y, b.z ?? 55);
      if (hitBldg && b.pierce <= 0) {
        this.spawnBurst(b.x, b.y, b.color, 5, 130, 4);
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Wall bounce or cull
      if (b.x < 0 || b.x > this.width || b.y < 0 || b.y > this.height) {
        if (b.bounces > 0) {
          b.bounces--;
          if (b.x < 0 || b.x > this.width) b.vx *= -1;
          if (b.y < 0 || b.y > this.height) b.vy *= -1;
          b.x = Math.max(2, Math.min(this.width - 2, b.x));
          b.y = Math.max(2, Math.min(this.height - 2, b.y));
        } else {
          this.playerBullets.splice(i, 1);
          continue;
        }
      }

      // Hit enemies
      let consumed = false;
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const e = this.enemies[eIdx];
        if (b.hitIds.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) <= e.radius + b.radius) {
          b.hitIds.add(e);

          // Aegis frontal shield check
          if (e.type === 'aegis' && b.pierce <= 0) {
            const hitAng = Math.atan2(b.y - e.y, b.x - e.x);
            let diff = Math.abs(hitAng - e.shieldAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 1.1) {
              this.spawnBurst(b.x, b.y, [0.2, 0.95, 1.0], 8, 180, 5);
              b.vx *= -0.7;
              b.vy *= -0.7;
              consumed = true;
              break;
            }
          }

          this.damageEnemy(e, b.dmg, b.crit, b.color);
          this._maybeChainLightning(e, 24);

          if (b.pierce > 0) {
            b.pierce--;
          } else {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.playerBullets.splice(i, 1);
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.player;
    if (!p) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (e.isBoss) {
        this._updateBoss(e, dt);
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.type === 'swarmer') {
        e.vx += (nx * e.speed - e.vx) * 5 * dt;
        e.vy += (ny * e.speed - e.vy) * 5 * dt;
        // Soft separation from neighbors
        for (let j = 0; j < this.enemies.length; j++) {
          if (i === j) continue;
          const o = this.enemies[j];
          const sdx = e.x - o.x;
          const sdy = e.y - o.y;
          const sd = Math.hypot(sdx, sdy);
          if (sd > 0 && sd < 32) {
            e.vx += (sdx / sd) * 140 * dt;
            e.vy += (sdy / sd) * 140 * dt;
          }
        }
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.type === 'lancer') {
        e.timer -= dt;
        if (e.state === 'seek') {
          e.angle = Math.atan2(dy, dx);
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
          if (e.timer <= 0 && dist < 440) {
            e.state = 'telegraph';
            e.timer = 0.65;
            e.vx = 0;
            e.vy = 0;
            e.chargeVx = nx * 420;
            e.chargeVy = ny * 420;
          }
        } else if (e.state === 'telegraph') {
          e.angle = Math.atan2(e.chargeVy, e.chargeVx);
          if (e.timer <= 0) {
            e.state = 'charge';
            e.timer = 0.55;
            this.grid.applyImpulse(e.x, e.y, 120, 14);
          }
        } else {
          e.vx = e.chargeVx;
          e.vy = e.chargeVy;
          if (e.timer <= 0) {
            e.state = 'seek';
            e.timer = 1.4;
          }
        }
      } else if (e.type === 'weaver') {
        e.orbitAngle += dt * 1.1;
        const desiredR = 210;
        const tx = p.x + Math.cos(e.orbitAngle) * desiredR;
        const ty = p.y + Math.sin(e.orbitAngle) * desiredR;
        const tdx = tx - e.x;
        const tdy = ty - e.y;
        const td = Math.hypot(tdx, tdy) || 1;
        e.vx += ((tdx / td) * e.speed - e.vx) * 3.5 * dt;
        e.vy += ((tdy / td) * e.speed - e.vy) * 3.5 * dt;
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.type === 'aegis') {
        e.angle = Math.atan2(dy, dx);
        e.shieldAngle += (e.angle - e.shieldAngle) * 3 * dt;
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      } else if (e.type === 'splitter') {
        e.vx += (nx * e.speed - e.vx) * 4 * dt;
        e.vy += (ny * e.speed - e.vy) * 4 * dt;
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.type === 'gravity_mine') {
        e.angle = Math.atan2(dy, dx);
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
        this.grid.applyImplosion(e.x, e.y, 130, 1.4);
        if (dist < 170) {
          p.x -= nx * 65 * dt;
          p.y -= ny * 65 * dt;
        }
      } else if (e.type === 'prism_sniper') {
        e.timer -= dt;
        if (dist > 340) {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
        } else if (dist < 230) {
          e.vx = -nx * e.speed;
          e.vy = -ny * e.speed;
        } else {
          e.vx *= 0.9;
          e.vy *= 0.9;
        }
        e.aimAngle = Math.atan2(dy, dx);
        e.angle = e.aimAngle;
        e.locking = e.timer < 0.75;
        if (e.timer <= 0) {
          e.timer = 2.8;
          this.enemyBullets.push({
            x: e.x, y: e.y, vx: Math.cos(e.aimAngle) * 310, vy: Math.sin(e.aimAngle) * 310,
            radius: 6, color: [1.0, 0.3, 0.72], life: 3.4
          });
        }
      } else if (e.type === 'carrier') {
        e.vx = nx * e.speed * (dist > 280 ? 1 : -0.4);
        e.vy = ny * e.speed * (dist > 280 ? 1 : -0.4);
        e.angle = Math.atan2(dy, dx);
        e.timer -= dt;
        if (e.timer <= 0 && this.enemies.length < 48) {
          e.timer = 3.2;
          this.enemies.push(createEnemy('swarmer', e.x + 20, e.y, this.wave));
          this.enemies.push(createEnemy('swarmer', e.x - 20, e.y, this.wave));
        }
      }

      // Compute dynamic banking tilt & emit battle-damage smoke when hull < 55%
      const lat = -Math.sin(e.angle) * e.vx + Math.cos(e.angle) * e.vy;
      e.bank = (e.bank || 0) + (Math.max(-1, Math.min(1, lat / 180)) - (e.bank || 0)) * Math.min(1, dt * 8);
      if (e.hp / e.maxHp < 0.55 && Math.random() < 0.28 && this.particles.length < 12000) {
        this.particles.push({
          x: e.x + (Math.random() - 0.5) * e.radius * 0.7,
          y: e.y + (Math.random() - 0.5) * e.radius * 0.7,
          vx: -e.vx * 0.25 + (Math.random() - 0.5) * 30,
          vy: -e.vy * 0.25 + (Math.random() - 0.5) * 30,
          size: 5 + Math.random() * 5,
          r: 1.0, g: 0.42, b: 0.12,
          life: 0.38, maxLife: 0.38, stretch: 0.01, drag: 0.93
        });
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      this.arMap.resolveEntityCollision(e);

      // Contact collision with player
      if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius) {
        this._damagePlayer(e.contactDmg);
        if (!e.isBoss) {
          e.vx = -nx * 240;
          e.vy = -ny * 240;
        }
      }
    }

    // Weaver laser links damage player if crossed
    const weavers = this.enemies.filter(e => e.type === 'weaver');
    for (let a = 0; a < weavers.length; a++) {
      for (let b = a + 1; b < weavers.length; b++) {
        const w1 = weavers[a];
        const w2 = weavers[b];
        const d = Math.hypot(w2.x - w1.x, w2.y - w1.y);
        if (d < 340) {
          if (this._pointToSegmentDist(p.x, p.y, w1.x, w1.y, w2.x, w2.y) < p.radius + 4) {
            this._damagePlayer(14);
          }
        }
      }
    }
  }

  _pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  _updateBoss(boss, dt) {
    const p = this.player;
    boss.timer += dt;
    boss.patternTimer += dt;
    boss.rotX += dt * 0.7;
    boss.rotY += dt * 1.05;
    boss.rotZ += dt * 0.45;
    boss.turretAngle = Math.atan2(p.y - boss.y, p.x - boss.x);

    const hpRatio = boss.hp / boss.maxHp;
    if (hpRatio < 0.55 && Math.random() < 0.55 && this.particles.length < 12000) {
      this.particles.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius,
        y: boss.y + (Math.random() - 0.5) * boss.radius,
        vx: (Math.random() - 0.5) * 60,
        vy: -55 - Math.random() * 40,
        size: 8 + Math.random() * 6,
        r: 1.0, g: 0.45, b: 0.15,
        life: 0.45, maxLife: 0.45, stretch: 0.01, drag: 0.94
      });
    }
    const nextPhase = hpRatio < 0.33 ? 3 : hpRatio < 0.66 ? 2 : 1;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      this.hitStopTimer = 0.08;
      this.trauma = Math.min(1.0, this.trauma + 0.65);
      this.addShockwave(boss.x, boss.y, 440, boss.accent, 26);
      this.grid.applyImpulse(boss.x, boss.y, 380, 36);
      this.audio.playBossAlarm();
      this.addBanner(`BOSS PHASE ${boss.phase}`, boss.name, '#ffb830', 1.8);
    }

    if (boss.tier === 1) {
      // ARCHON DODECAHEDRON
      const tx = this.width * 0.5 + Math.cos(boss.timer * 0.6) * (this.width * 0.24);
      const ty = this.height * 0.3 + Math.sin(boss.timer * 0.9) * (this.height * 0.14);
      boss.x += (tx - boss.x) * 2.2 * dt;
      boss.y += (ty - boss.y) * 2.2 * dt;
      boss.spokeAngle += dt * (0.45 + boss.phase * 0.25);

      // Spiral bullet curtains
      const fireInterval = Math.max(0.11, 0.24 - boss.phase * 0.04);
      if (boss.patternTimer >= fireInterval) {
        boss.patternTimer = 0;
        const arms = 3 + boss.phase;
        for (let k = 0; k < arms; k++) {
          const a = boss.spokeAngle + (k / arms) * Math.PI * 2;
          this.enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(a) * 165, vy: Math.sin(a) * 165,
            radius: 6, color: k % 2 === 0 ? boss.color : boss.accent, life: 6.2
          });
        }
      }

      // Rotating laser spokes damage in phase 2+
      if (boss.phase >= 2) {
        const spokeLen = 360;
        for (let s = 0; s < 4; s++) {
          const a = boss.spokeAngle + (s / 4) * Math.PI * 2;
          const sx = boss.x + Math.cos(a) * spokeLen;
          const sy = boss.y + Math.sin(a) * spokeLen;
          if (this._pointToSegmentDist(p.x, p.y, boss.x, boss.y, sx, sy) < p.radius + 5) {
            this._damagePlayer(16);
          }
        }
      }
    } else if (boss.tier === 2) {
      // SERAPHIM LEVIATHAN (12-segment cyber serpent)
      const aimToP = Math.atan2(p.y - boss.y, p.x - boss.x);
      let diff = aimToP - boss.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const weave = Math.sin(boss.timer * 3.2) * 1.4;
      boss.heading += (Math.max(-2.2, Math.min(2.2, diff)) + weave) * dt * 1.35;

      const spd = 165 + boss.phase * 25;
      boss.x += Math.cos(boss.heading) * spd * dt;
      boss.y += Math.sin(boss.heading) * spd * dt;
      if (boss.x < 50 || boss.x > this.width - 50) boss.heading = Math.PI - boss.heading;
      if (boss.y < 50 || boss.y > this.height - 50) boss.heading = -boss.heading;
      boss.x = Math.max(40, Math.min(this.width - 40, boss.x));
      boss.y = Math.max(40, Math.min(this.height - 40, boss.y));

      this.grid.applyDirectedForce(boss.x, boss.y, Math.cos(boss.heading) * 10, Math.sin(boss.heading) * 10, 95);

      boss.segments[0].x = boss.x;
      boss.segments[0].y = boss.y;
      boss.segments[0].angle = boss.heading;
      for (let s = 1; s < boss.segments.length; s++) {
        const prev = boss.segments[s - 1];
        const cur = boss.segments[s];
        const sdx = prev.x - cur.x;
        const sdy = prev.y - cur.y;
        const dist = Math.hypot(sdx, sdy) || 1;
        const spacing = 27;
        if (dist > spacing) {
          cur.x = prev.x - (sdx / dist) * spacing;
          cur.y = prev.y - (sdy / dist) * spacing;
        }
        cur.angle = Math.atan2(sdy, sdx);
        if (Math.hypot(cur.x - p.x, cur.y - p.y) < cur.radius + p.radius) {
          this._damagePlayer(15);
        }
      }

      if (boss.patternTimer >= 0.48 - boss.phase * 0.08) {
        boss.patternTimer = 0;
        const seg = boss.segments[Math.floor(Math.random() * boss.segments.length)];
        const a = Math.atan2(p.y - seg.y, p.x - seg.x);
        this.enemyBullets.push({
          x: seg.x, y: seg.y, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185,
          radius: 6, color: boss.accent, life: 5.8
        });
      }
    } else {
      // OMEGA SINGULARITY
      const cx = this.width * 0.5 + Math.cos(boss.timer * 0.45) * 140;
      const cy = this.height * 0.36 + Math.sin(boss.timer * 0.7) * 75;
      boss.x += (cx - boss.x) * 2 * dt;
      boss.y += (cy - boss.y) * 2 * dt;

      // Gravitational pull / reversal on grid & player
      if (Math.floor(boss.timer / 5) % 2 === 0) {
        this.grid.applyImplosion(boss.x, boss.y, 320, 4.0);
        const dx = boss.x - p.x;
        const dy = boss.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 75 && d < 460) {
          p.x += (dx / d) * 48 * dt;
          p.y += (dy / d) * 48 * dt;
        }
      } else {
        this.grid.applyImpulse(boss.x, boss.y, 260, 1.5);
      }

      if (boss.patternTimer >= Math.max(0.1, 0.2 - boss.phase * 0.03)) {
        boss.patternTimer = 0;
        const arms = 4 + boss.phase;
        const spin = boss.timer * 2.2;
        for (let k = 0; k < arms; k++) {
          const a = spin + (k / arms) * Math.PI * 2;
          this.enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
            radius: 6.5, color: k % 2 === 0 ? boss.color : boss.accent, life: 6.2
          });
        }
      }
    }

    if (Math.hypot(boss.x - p.x, boss.y - p.y) <= boss.radius + p.radius) {
      this._damagePlayer(22);
    }
  }

  _updateEnemyBullets(dt) {
    const p = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.life <= 0 || b.x < -40 || b.x > this.width + 40 || b.y < -40 || b.y > this.height + 40) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (this.arMap.checkBulletHit(b.x, b.y, b.z ?? 55)) {
        this.spawnBurst(b.x, b.y, b.color, 4, 110, 4);
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (p && Math.hypot(b.x - p.x, b.y - p.y) <= b.radius + p.radius - 2) {
        this.enemyBullets.splice(i, 1);
        this._damagePlayer(14);
      }
    }
  }

  _updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      pt.vx *= pt.drag;
      pt.vy *= pt.drag;
      pt.vz = (pt.vz || 0) * pt.drag;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z = (pt.z ?? 50) + pt.vz * dt;
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const prog = 1 - sw.life / sw.maxLife;
      sw.radius = 12 + (sw.maxRadius - 12) * (1 - Math.pow(1 - prog, 2.5));
    }

    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) this.lightningArcs.splice(i, 1);
    }

    for (let i = this.railBeams.length - 1; i >= 0; i--) {
      this.railBeams[i].life -= dt;
      if (this.railBeams[i].life <= 0) this.railBeams.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      ft.vy *= 0.94;
    }
  }

  _renderScene(audioEnergy) {
    const r = this.renderer;
    r.beginFrame(this.arMap.arMode);

    // 1. Deep 3D Cosmic Starfield Parallax
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const sx = (st.x * 1.9 - 0.45) * this.width;
      const sy = (st.y * 1.9 - 0.45) * this.height;
      const sz = -180 - st.depth * 360;
      const tw = 0.4 + 0.5 * Math.sin(this.time * 2.2 + st.twinkle);
      r.drawParticle3D(sx, sy, sz, st.size * 1.6, 0.55, 0.78, 1.0, tw * 0.65, 0, 0, 0, 0);
    }

    // 2. Deformable 3D Spacetime Grid & 3D Augmented Reality Map
    const palette = PALETTES[this.paletteIdx % PALETTES.length];
    this.grid.renderToBatch(r, palette, audioEnergy.bass);
    this.arMap.render3D(r, this.time, audioEnergy, this.player);

    // 3. Weaver Laser Links (3D)
    const weavers = this.enemies.filter(e => e.type === 'weaver');
    for (let a = 0; a < weavers.length; a++) {
      for (let b = a + 1; b < weavers.length; b++) {
        const d = Math.hypot(weavers[b].x - weavers[a].x, weavers[b].y - weavers[a].y);
        if (d < 340) {
          r.drawLine3D(
            weavers[a].x, weavers[a].y, weavers[a].z || 55,
            weavers[b].x, weavers[b].y, weavers[b].z || 55,
            0.2, 1.0, 0.65, 0.85, 3.2
          );
        }
      }
    }

    // 4. Singularities (3D Projected Shader Uniforms + Accretion Rings)
    for (const s of this.singularities) {
      r.addSingularityUniform(s.x, s.y, 14, s.lensingRadius, s.strength);
      r.drawCircle3D(s.x, s.y, 14, s.lensingRadius * 0.34, 0.75, 0.45, 1.0, 0.85, 28, 2.5);
      r.drawCircle3D(s.x, s.y, 6, s.radius * 0.85, 0.35, 0.8, 1.0, 0.22, 32, 1.2);
    }

    // 5. Player 3D Wingtip Contrail Ribbons, Ground Shadow Tethers & Decoys
    if (this.player && this.state !== 'MENU') {
      const p = this.player;
      const c = p.ship.color;
      const drawRibbon = pts => {
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1];
          const p1 = pts[i];
          const a = (p1.life / p1.maxLife) * p1.alpha * 0.65;
          r.drawLine3D(p0.x, p0.y, p0.z ?? p.z, p1.x, p1.y, p1.z ?? p.z, c[0], c[1], c[2], a, 2.2);
        }
      };
      drawRibbon(p.contrailsLeft);
      drawRibbon(p.contrailsRight);

      r.drawLine3D(p.x, p.y, 0, p.x, p.y, p.z, c[0], c[1], c[2], 0.22, 1.2);
      r.drawCircle3D(p.x, p.y, 1, 18, c[0], c[1], c[2], 0.3, 16, 1.4);
    }
    for (const e of this.enemies) {
      const ez = e.z || 55;
      r.drawLine3D(e.x, e.y, 0, e.x, e.y, ez, e.color[0], e.color[1], e.color[2], e.isBoss ? 0.28 : 0.16, 1.1);
      r.drawCircle3D(e.x, e.y, 1, e.radius * 0.85, e.color[0], e.color[1], e.color[2], 0.22, 14, 1.2);
    }
    for (const d of this.decoys) {
      const pulse = 1 + Math.sin(this.time * 25) * 0.2;
      r.drawCircle3D(d.x, d.y, 55, 16 * pulse, d.color[0], d.color[1], d.color[2], 0.9, 16, 2.4);
    }

    r.flushLayer();

    // 6. Enemy & Boss 3D Aircraft
    for (const e of this.enemies) {
      this._renderEnemy(e);
    }

    // 7. Player 3D Fighter Jet, Afterburners, Mach Cone & Orbitals
    if (this.player && this.state !== 'MENU') {
      this._renderPlayer();
    }

    r.flushLayer();

    // 8. 3D Bullets
    const pz = this.player ? this.player.z : 55;
    for (const b of this.playerBullets) {
      const ang = Math.atan2(b.vy, b.vx);
      const tail = b.type === 'missile' ? 18 : 22;
      const bz = b.z ?? pz;
      r.drawLine3D(
        b.x, b.y, bz,
        b.x - Math.cos(ang) * tail, b.y - Math.sin(ang) * tail, bz,
        b.color[0], b.color[1], b.color[2], 0.98, b.type === 'missile' ? 3.5 : 2.8
      );
      r.drawParticle3D(b.x, b.y, bz, 8, b.color[0], b.color[1], b.color[2], 0.9, b.vx * 0.02, b.vy * 0.02, 0, 0.02);
    }

    for (const b of this.enemyBullets) {
      const bz = b.z ?? 55;
      r.drawParticle3D(b.x, b.y, bz, b.radius * 2.1, b.color[0], b.color[1], b.color[2], 0.95, 0, 0, 0, 0);
      r.drawCircle3D(b.x, b.y, bz, b.radius, 1.0, 0.9, 0.95, 0.9, 10, 1.6);
    }

    // 9. 3D Rail Beams & Fractal Lightning Arcs
    for (const rb of this.railBeams) {
      const alpha = rb.life / rb.maxLife;
      const bz = rb.z ?? pz;
      r.drawLine3D(rb.x1, rb.y1, bz, rb.x2, rb.y2, bz, rb.color[0], rb.color[1], rb.color[2], alpha * 0.55, rb.width);
      r.drawLine3D(rb.x1, rb.y1, bz, rb.x2, rb.y2, bz, 1.0, 1.0, 1.0, alpha * 0.95, rb.width * 0.35);
    }

    for (const arc of this.lightningArcs) {
      const alpha = arc.life / arc.maxLife;
      r.drawPoly(arc.pts, arc.color[0], arc.color[1], arc.color[2], alpha, false, 3.0, 55);
      r.drawPoly(arc.pts, 1.0, 1.0, 1.0, alpha * 0.85, false, 1.2, 55);
    }

    // 10. 3D Shockwaves
    for (const sw of this.shockwaves) {
      const alpha = sw.life / sw.maxLife;
      const sz = sw.z ?? 35;
      r.addShockwaveUniform(sw.x, sw.y, sz, sw.radius, sw.thickness);
      r.drawCircle3D(sw.x, sw.y, sz, sw.radius, sw.color[0], sw.color[1], sw.color[2], alpha * 0.8, 36, 2.5);
    }

    // 11. 3D GPU Particle System
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      const alpha = Math.max(0, pt.life / pt.maxLife);
      r.drawParticle3D(pt.x, pt.y, pt.z ?? 50, pt.size, pt.r, pt.g, pt.b, alpha, pt.vx, pt.vy, pt.vz || 0, pt.stretch);
    }

    const shakeMag = this.trauma * this.trauma * 14;
    const shakeX = (Math.random() * 2 - 1) * shakeMag;
    const shakeY = (Math.random() * 2 - 1) * shakeMag;

    r.endFrame({
      time: this.time,
      bloomIntensity: this.fx.bloom,
      aberration: this.fx.aberration + this.trauma * 2.2 + this.chronoShift * 1.4,
      lensingStrength: this.fx.lensing,
      chronoShift: this.chronoShift,
      shakeX,
      shakeY
    });
  }

  _renderPlayer() {
    const r = this.renderer;
    const p = this.player;
    const c = p.ship.color;
    const ac = p.ship.accent;
    const camMode = this.camModes[this.camModeIdx];
    const isCockpit = camMode === 'cockpit_3d';
    const bodyAng = (camMode === 'chase_3d' || isCockpit) ? (p.heading ?? p.angle) : p.angle;
    const swept = p.wingSweep > 0.5;
    const sprite = this.atlas.getPlayerSprite(p.ship.id, p.bank, swept);
    const abFrame = Math.floor(this.time * 28) % 4;
    const abSprite = this.atlas.getSprite(`afterburner_${abFrame}`);

    const alpha = p.invuln > 0 && Math.floor(this.time * 24) % 2 === 0 ? 0.48 : 1.0;
    const cb = Math.cos(bodyAng), sb = Math.sin(bodyAng);
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);

    if (!isCockpit) {
      // Phase Dash Ghost Afterimages
      for (const tr of p.trail) {
        r.drawSprite3D(sprite, tr.x, tr.y, tr.z ?? p.z, 62, 62, bodyAng, p.pitch, p.bank, c[0], c[1], c[2], tr.alpha * 0.4, 0, true, 0.8, false);
      }

      // Animated Shock-Diamond Afterburner Plumes
      const plumeScale = 0.55 + p.throttle * 0.65 + (p.dashTimer > 0 ? 0.75 : 0);
      const nozzles = p.ship.nozzles || [-5, 5];
      for (const nz of nozzles) {
        const lx = -24 - plumeScale * 10;
        const ly = nz * (1 - Math.abs(p.bank) * 0.25);
        const ax = p.x + cb * lx - sb * ly;
        const ay = p.y + sb * lx + cb * ly;
        r.drawSprite3D(abSprite, ax, ay, p.z, 20, 30 * plumeScale, bodyAng, p.pitch, p.bank, 1, 1, 1, 0.92 * alpha, 0, true, 0.85, false);
      }

      // 3D Textured Fighter Jet Airframe (yaw, pitch, roll-bank in true 3D perspective)
      r.drawSprite3D(sprite, p.x, p.y, p.z, 62, 62, bodyAng, p.pitch, p.bank, 1, 1, 1, alpha, p.invuln > 0.5 ? 0.35 : 0, false, 0.75, false);

      // 3D Volumetric Dorsal Canopy Crest Line
      r.drawLine3D(
        p.x + cb * 14, p.y + sb * 14, p.z + 9,
        p.x - cb * 14, p.y - sb * 14, p.z + 5,
        c[0], c[1], c[2], 0.55 * alpha, 1.8
      );

      // Supersonic Prandtl-Glauert Mach Vapor Cone during Phase Dash
      if (p.dashTimer > 0) {
        const mc = this.atlas.getSprite('mach_cone');
        r.drawSprite3D(mc, p.x + cb * 6, p.y + sb * 6, p.z, 78, 72, bodyAng, p.pitch, p.bank, c[0], c[1], c[2], 0.85, 0, true, 0.8, false);
      }
    }

    // Wing / Nose Hardpoint Muzzle Flashes (oriented along gimbal aim)
    if (p.muzzleFlashTimer > 0) {
      const mf = this.atlas.getSprite('muzzle_flash');
      const fAlpha = p.muzzleFlashTimer / 0.075;
      [-11, 11].forEach(wy => {
        const fx = p.x + ca * 26 - sa * wy;
        const fy = p.y + sa * 26 + ca * wy;
        r.drawSprite3D(mf, fx, fy, p.z, 22, 22, p.angle, 0, 0, ac[0], ac[1], ac[2], fAlpha, 0, true, 0.9, true);
      });
    }

    // Entropy Aegis Shield Ring
    if (p.entropyShieldReady) {
      r.drawCircle3D(p.x, p.y, p.z, p.radius + 14, 0.2, 0.95, 1.0, 0.65, 24, 1.8);
    }

    // Orbitals
    if (p.orbitals > 0) {
      const orbR = 56;
      for (let i = 0; i < p.orbitals; i++) {
        const a = p.orbitalAngle + (i / p.orbitals) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * orbR;
        const oy = p.y + Math.sin(a) * orbR;
        const oz = p.z + Math.sin(a * 2 + this.time * 4) * 10;
        r.drawCircle3D(ox, oy, oz, 7, ac[0], ac[1], ac[2], 0.95, 10, 2.2);
        r.drawParticle3D(ox, oy, oz, 11, c[0], c[1], c[2], 0.75, 0, 0, 0, 0);
      }
    }
  }

  _renderEnemy(e) {
    const r = this.renderer;
    const flash = e.hitFlash > 0 ? 1.0 : 0.0;
    const ez = e.z || 55;
    const abFrame = Math.floor(this.time * 24) % 4;
    const abSprite = this.atlas.getSprite(`afterburner_${abFrame}`);
    const rotorSprite = this.atlas.getSprite('rotor_blur');
    const turretSprite = this.atlas.getSprite('turret_gun');
    const radomeSprite = this.atlas.getSprite('radome_dish');

    if (e.isBoss) {
      if (e.tier === 1) {
        const bossSpr = this.atlas.getSprite('boss_archon');
        const yaw = Math.PI * 0.5;
        const bank = Math.sin(this.time * 0.9) * 0.22;
        [-32, -11, 11, 32].forEach(nx => {
          r.drawSprite3D(abSprite, e.x + nx, e.y - 70, ez, 24, 44, yaw, 0, bank, 1, 1, 1, 0.9, 0, true);
        });
        r.drawSprite3D(bossSpr, e.x, e.y, ez, 204, 204, yaw, 0, bank, 1, 1, 1, 1, flash, false, 0.8);
        r.drawBox3D(e.x, e.y, ez - 14, 130, 75, 28, e.color[0], e.color[1], e.color[2], 0.22, 1.2);

        [[-64, -6], [-38, 12], [38, 12], [64, -6]].forEach(([px, py], idx) => {
          r.drawSprite3D(rotorSprite, e.x + px, e.y + py, ez + 10, 46, 46, this.time * (idx % 2 === 0 ? 18 : -18), 0, bank, 0.5, 0.95, 1.0, 0.78, 0, true);
        });
        [[-46, 18], [-22, -12], [22, -12], [46, 18]].forEach(([tx, ty]) => {
          r.drawSprite3D(turretSprite, e.x + tx, e.y + ty, ez + 14, 28, 28, e.turretAngle || 0, 0, 0, 1, 1, 1, 0.96, flash, false);
        });

        if (e.phase >= 2) {
          for (let s = 0; s < 4; s++) {
            const a = e.spokeAngle + (s / 4) * Math.PI * 2;
            r.drawLine3D(e.x, e.y, ez, e.x + Math.cos(a) * 360, e.y + Math.sin(a) * 360, 55, e.accent[0], e.accent[1], e.accent[2], 0.65, 3.0);
          }
        }
      } else if (e.tier === 2) {
        const segSpr = this.atlas.getSprite('boss_seraphim_seg');
        for (let s = e.segments.length - 1; s >= 1; s--) {
          const seg = e.segments[s];
          const sz = seg.radius * 2.55;
          const szZ = (seg.z || ez) + Math.sin(this.time * 4 + s * 0.6) * 8;
          r.drawSprite3D(segSpr, seg.x, seg.y, szZ, sz, sz, seg.angle, 0, 0, 1, 1, 1, 0.98, flash, false, 0.65);
          if (s % 2 === 1) {
            r.drawSprite3D(turretSprite, seg.x, seg.y, szZ + 10, 20, 20, e.turretAngle || 0, 0, 0, 1, 1, 1, 0.95, flash, false);
          }
        }
        const head = e.segments[0];
        const hbX = head.x - Math.cos(head.angle) * 44;
        const hbY = head.y - Math.sin(head.angle) * 44;
        r.drawSprite3D(abSprite, hbX, hbY, ez, 24, 46, head.angle, 0, 0, 1, 1, 1, 0.95, 0, true);
        r.drawSprite3D(this.atlas.getSprite('boss_seraphim'), head.x, head.y, ez, 130, 130, head.angle, 0, 0, 1, 1, 1, 1, flash, false, 0.8);
      } else {
        r.addSingularityUniform(e.x, e.y, ez, e.radius * 1.4, 1.35);
        const omegaSpr = this.atlas.getSprite('boss_omega');
        const yaw = Math.PI * 0.5;
        const bank = Math.sin(this.time * 0.7) * 0.16;
        [-42, -20, 20, 42].forEach(nx => {
          r.drawSprite3D(abSprite, e.x + nx, e.y - 80, ez, 24, 48, yaw, 0, bank, 1, 1, 1, 0.95, 0, true);
        });
        r.drawSprite3D(omegaSpr, e.x, e.y, ez, 222, 222, yaw, 0, bank, 1, 1, 1, 1, flash, false, 0.85);
        r.drawSprite3D(radomeSprite, e.x, e.y - 6, ez + 16, 48, 48, this.time * 3.5, 0, 0, 1, 1, 1, 0.95, 0, false);
        [[-52, 8], [52, 8]].forEach(([tx, ty]) => {
          r.drawSprite3D(turretSprite, e.x + tx, e.y + ty, ez + 18, 32, 32, e.turretAngle || 0, 0, 0, 1, 1, 1, 0.98, flash, false);
        });
        r.draw3DWireframe(
          MESH_RING_X.verts, MESH_RING_X.edges,
          e.x, e.y, e.radius * 0.95, e.rotX * 1.6, e.rotY, 0, e.accent[0], e.accent[1], e.accent[2], 0.55, 1.8, ez
        );
        r.draw3DWireframe(
          MESH_RING_Y.verts, MESH_RING_Y.edges,
          e.x, e.y, e.radius * 0.95, e.rotX, -e.rotY * 1.7, e.rotZ, 0.25, 0.95, 1.0, 0.55, 1.8, ez
        );
        r.draw3DWireframe(
          MESH_RING_Z.verts, MESH_RING_Z.edges,
          e.x, e.y, e.radius * 0.95, -e.rotX, e.rotY, e.rotZ * 1.8, 1.0, 0.82, 0.25, 0.55, 1.8, ez
        );
      }
      return;
    }

    const bank = e.bank || 0;
    const ca = Math.cos(e.angle), sa = Math.sin(e.angle);
    const sprKey = e.type === 'swarmer' ? 'enemy_swarmer'
      : e.type === 'lancer' ? 'enemy_lancer'
      : e.type === 'weaver' ? 'enemy_weaver'
      : e.type === 'aegis' ? 'enemy_aegis'
      : e.type === 'splitter' ? 'enemy_splitter'
      : e.type === 'gravity_mine' ? 'enemy_gravity_mine'
      : e.type === 'prism_sniper' ? 'enemy_prism_sniper'
      : 'enemy_carrier';
    const spr = this.atlas.getSprite(sprKey);
    const size = e.type === 'carrier' ? 80 : e.isMini ? 30 : e.radius * 2.6;

    if (e.type === 'swarmer' || e.type === 'lancer' || e.type === 'splitter' || e.type === 'prism_sniper') {
      const bx = e.x - ca * (size * 0.44);
      const by = e.y - sa * (size * 0.44);
      r.drawSprite3D(abSprite, bx, by, ez, size * 0.34, size * 0.5, e.angle, 0, bank, e.color[0], e.color[1], e.color[2], 0.88, 0, true);
    }

    r.drawSprite3D(spr, e.x, e.y, ez, size, size, e.angle, 0, bank, 1, 1, 1, 1, flash, false, 0.7);

    if (e.type === 'lancer') {
      if (e.state === 'telegraph') {
        r.drawLine3D(e.x, e.y, ez, e.x + ca * 440, e.y + sa * 440, ez, 1.0, 0.15, 0.25, 0.75, 1.8);
      } else if (e.state === 'charge') {
        r.drawSprite3D(this.atlas.getSprite('mach_cone'), e.x + ca * 6, e.y + sa * 6, ez, 58, 56, e.angle, 0, bank, 1.0, 0.72, 0.2, 0.9, 0, true);
      }
    } else if (e.type === 'aegis') {
      r.drawSprite3D(rotorSprite, e.x, e.y, ez + 10, size * 0.96, size * 0.96, this.time * 24, 0, 0, 0.25, 0.95, 1.0, 0.75, 0, true);
      r.drawArc(e.x, e.y, e.radius + 9, e.shieldAngle - 1.05, e.shieldAngle + 1.05, 0.4, 1.0, 1.0, 0.95, 12, 3.6, ez);
    } else if (e.type === 'weaver') {
      [-12, 12].forEach(wy => {
        const px = e.x + ca * 8 - sa * wy;
        const py = e.y + sa * 8 + ca * wy;
        r.drawSprite3D(rotorSprite, px, py, ez + 6, 18, 18, this.time * 26, 0, 0, 0.2, 1.0, 0.65, 0.75, 0, true);
      });
    } else if (e.type === 'gravity_mine') {
      [-17, 17].forEach(wy => {
        const px = e.x + ca * 4 - sa * wy;
        const py = e.y + sa * 4 + ca * wy;
        r.drawSprite3D(rotorSprite, px, py, ez + 8, 24, 24, this.time * 22, 0, 0, 0.9, 0.3, 1.0, 0.78, 0, true);
      });
      r.drawSprite3D(radomeSprite, e.x, e.y, ez + 10, 18, 18, this.time * 4.5, 0, 0, 1, 1, 1, 0.9, 0, false);
      r.drawCircle3D(e.x, e.y, ez, 44, e.color[0], e.color[1], e.color[2], 0.25, 20, 1.2);
    } else if (e.type === 'prism_sniper' && e.locking) {
      r.drawLine3D(
        e.x, e.y, ez,
        e.x + Math.cos(e.aimAngle) * 700, e.y + Math.sin(e.aimAngle) * 700, 55,
        1.0, 0.25, 0.65, 0.55, 1.4
      );
    } else if (e.type === 'carrier') {
      [-22, -13, 13, 22].forEach(wy => {
        const px = e.x + ca * 4 - sa * wy;
        const py = e.y + sa * 4 + ca * wy;
        r.drawSprite3D(rotorSprite, px, py, ez + 6, 18, 18, this.time * 20, 0, 0, 1.0, 0.75, 0.25, 0.78, 0, true);
      });
      const aimAng = this.player ? Math.atan2(this.player.y - e.y, this.player.x - e.x) : e.angle;
      r.drawSprite3D(turretSprite, e.x, e.y, ez + 12, 24, 24, aimAng, 0, 0, 1, 1, 1, 0.95, flash, false);
    }
  }

  _clearHUD() {
    const ctx = this.hudCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
  }

  _renderHUD(audioEnergy) {
    const ctx = this.hudCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const p = this.player;
    if (!p) return;

    // 1. Top-Left Tactical Telemetry (HP, Overdrive, Singularity, Score, Wave)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 26, 0.65)';
    ctx.strokeStyle = 'rgba(44, 245, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 14, 310, 108, 10);
    ctx.fill();
    ctx.stroke();

    // Hull HP bar
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8aa2c8';
    ctx.fillText(`HULL INTEGRITY  ${Math.ceil(p.hp)} / ${p.maxHp}`, 28, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(28, 40, 286, 9);
    const hpGrad = ctx.createLinearGradient(28, 0, 314, 0);
    hpGrad.addColorStop(0, hpPct > 0.35 ? '#2eff9f' : '#ff335f');
    hpGrad.addColorStop(1, '#2cf5ff');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(28, 40, 286 * hpPct, 9);

    // Overdrive Bar
    const odPct = Math.min(1, p.overdrive / 100);
    ctx.fillStyle = p.overdrive >= 100 ? '#ffb830' : '#8aa2c8';
    ctx.fillText(
      p.novabeamTimer > 0 ? 'NOVABEAM ACTIVE!' : p.overdrive >= 100 ? 'OVERDRIVE READY [E / F]' : `OVERDRIVE  ${Math.floor(p.overdrive)}%`,
      28, 66
    );
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(28, 72, 286, 7);
    ctx.fillStyle = p.overdrive >= 100 ? '#ffb830' : '#ff2ebd';
    ctx.fillRect(28, 72, 286 * odPct, 7);

    // Wave / Score / Combo / FPS
    ctx.fillStyle = '#eef8ff';
    ctx.font = '800 14px "Orbitron", system-ui, sans-serif';
    ctx.fillText(`WAVE ${this.wave}`, 28, 103);
    ctx.fillStyle = '#2cf5ff';
    ctx.fillText(Math.floor(this.score).toLocaleString(), 116, 103);
    if (this.combo > 1) {
      ctx.fillStyle = '#ffb830';
      ctx.fillText(`x${this.combo}`, 226, 103);
    }
    ctx.fillStyle = '#8aa2c8';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(`${this.fps} FPS`, 272, 103);
    ctx.restore();

    // 1b. Live Aircraft Flight Attitude & Throttle Indicator
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 26, 0.65)';
    ctx.strokeStyle = 'rgba(44, 245, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(334, 14, 118, 108, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8aa2c8';
    ctx.textAlign = 'center';
    ctx.fillText(p.ship.aircraftModel || p.ship.name, 393, 30);

    // Artificial Horizon / Banking Silhouette
    ctx.save();
    ctx.translate(393, 62);
    ctx.strokeStyle = 'rgba(44, 245, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(p.bank * 0.58);
    ctx.strokeStyle = p.wingSweep > 0.5 ? '#ffb830' : '#2cf5ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-19, 2);
    ctx.lineTo(-5, 2);
    ctx.lineTo(0, -4);
    ctx.lineTo(5, 2);
    ctx.lineTo(19, 2);
    ctx.stroke();
    ctx.restore();

    const bankDeg = Math.round(p.bank * 30);
    const machVal = (0.45 + p.throttle * 1.15 + (p.dashTimer > 0 ? 1.4 : 0)).toFixed(2);
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = p.wingSweep > 0.5 ? '#ffb830' : '#2eff9f';
    ctx.fillText(`M${machVal}  ${bankDeg >= 0 ? '+' : ''}${bankDeg}°`, 393, 98);
    ctx.fillStyle = '#8aa2c8';
    ctx.fillText(p.wingSweep > 0.5 ? 'WING: SWEPT' : 'WING: CRUISE', 393, 112);
    ctx.restore();

    // 2. Boss HP Bar (Top Center)
    const boss = this.enemies.find(e => e.isBoss);
    if (boss) {
      const bw = Math.min(480, this.width * 0.48);
      const bx = (this.width - bw) * 0.5;
      const by = 22;
      ctx.save();
      ctx.fillStyle = 'rgba(8, 12, 26, 0.78)';
      ctx.strokeStyle = 'rgba(255, 51, 95, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx - 12, by - 8, bw + 24, 48, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '800 13px "Orbitron", system-ui, sans-serif';
      ctx.fillStyle = '#ff7a99';
      ctx.textAlign = 'center';
      ctx.fillText(`${boss.name}  //  PHASE ${boss.phase}`, this.width * 0.5, by + 10);

      const bp = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(bx, by + 18, bw, 10);
      const bGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bGrad.addColorStop(0, '#ff335f');
      bGrad.addColorStop(0.5, '#ff2ebd');
      bGrad.addColorStop(1, '#ffb830');
      ctx.fillStyle = bGrad;
      ctx.fillRect(bx, by + 18, bw * bp, 10);
      ctx.restore();
    }

    // 3. Center Announcement Banner
    if (this.banner.timer > 0) {
      const fade = Math.min(1, this.banner.timer * 2.5, (this.banner.maxTimer - this.banner.timer + 0.15) * 4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.textAlign = 'center';
      ctx.font = '900 30px "Orbitron", system-ui, sans-serif';
      ctx.fillStyle = this.banner.color;
      ctx.shadowColor = this.banner.color;
      ctx.shadowBlur = 18;
      ctx.fillText(this.banner.text, this.width * 0.5, this.height * 0.24);
      if (this.banner.sub) {
        ctx.shadowBlur = 0;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#eef8ff';
        ctx.fillText(this.banner.sub, this.width * 0.5, this.height * 0.24 + 24);
      }
      ctx.restore();
    }

    // 4. 3D-Projected Floating Damage Numbers & Parry Callouts
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const sp = this.renderer.worldToScreen(ft.x, ft.y, ft.z ?? 58);
      if (!sp.visible) continue;
      const a = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `800 ${ft.size}px "JetBrains Mono", monospace`;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sp.x, sp.y);
    }
    ctx.restore();

    // 4b. 3D Augmented Reality (AR) Target Lock Bounding Boxes & Telemetry
    const lidarActive = this.arMap.scanBoostTimer > 0;
    ctx.save();
    ctx.font = '700 9px "JetBrains Mono", monospace';
    for (const e of this.enemies) {
      const showBox = lidarActive || e.isBoss || e.type === 'prism_sniper' || e.type === 'aegis' || e.type === 'carrier';
      if (!showBox) continue;
      const sp = this.renderer.worldToScreen(e.x, e.y, e.z || 55);
      if (!sp.visible || sp.x < 0 || sp.x > this.width || sp.y < 0 || sp.y > this.height) continue;
      const half = Math.max(16, Math.min(72, e.radius * sp.scale * 1.15));
      const c = e.isBoss ? '#ffb830' : lidarActive ? '#2eff9f' : '#2cf5ff';
      const brk = Math.max(6, half * 0.35);

      ctx.strokeStyle = c;
      ctx.lineWidth = e.isBoss ? 1.8 : 1.2;
      ctx.beginPath();
      // 4 AR corner brackets
      ctx.moveTo(sp.x - half, sp.y - half + brk); ctx.lineTo(sp.x - half, sp.y - half); ctx.lineTo(sp.x - half + brk, sp.y - half);
      ctx.moveTo(sp.x + half - brk, sp.y - half); ctx.lineTo(sp.x + half, sp.y - half); ctx.lineTo(sp.x + half, sp.y - half + brk);
      ctx.moveTo(sp.x + half, sp.y + half - brk); ctx.lineTo(sp.x + half, sp.y + half); ctx.lineTo(sp.x + half - brk, sp.y + half);
      ctx.moveTo(sp.x - half + brk, sp.y + half); ctx.lineTo(sp.x - half, sp.y + half); ctx.lineTo(sp.x - half, sp.y + half - brk);
      ctx.stroke();

      const dst = Math.round(Math.hypot(e.x - p.x, e.y - p.y));
      ctx.fillStyle = c;
      ctx.textAlign = 'left';
      ctx.fillText(`ALT:${Math.round(e.z || 55)}m DST:${dst}`, sp.x - half, sp.y - half - 5);
    }
    ctx.restore();

    // 5. Off-Screen Threat Arrows (3D-Projected)
    ctx.save();
    for (const e of this.enemies) {
      const sp = this.renderer.worldToScreen(e.x, e.y, e.z || 55);
      if (sp.visible && sp.x >= 0 && sp.x <= this.width && sp.y >= 0 && sp.y <= this.height) continue;
      const ang = Math.atan2((sp.visible ? sp.y : e.y) - this.height * 0.5, (sp.visible ? sp.x : e.x) - this.width * 0.5);
      const pad = 26;
      const ax = Math.max(pad, Math.min(this.width - pad, this.width * 0.5 + Math.cos(ang) * (this.width * 0.48)));
      const ay = Math.max(pad, Math.min(this.height - pad, this.height * 0.5 + Math.sin(ang) * (this.height * 0.46)));
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = e.isBoss ? '#ffb830' : '#ff335f';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, 5);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.fill();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    ctx.restore();

    // 5b. 3D POV Flight Vector, Gimbal Lead & Cockpit Fighter Avionics
    const hudCamMode = this.camModes[this.camModeIdx];
    const isPovHud = hudCamMode === 'chase_3d' || hudCamMode === 'cockpit_3d';
    if (isPovHud && p) {
      const hAng = p.heading ?? p.angle;
      const fv = this.renderer.worldToScreen(p.x + Math.cos(hAng) * 290, p.y + Math.sin(hAng) * 290, p.z);
      if (fv.visible) {
        ctx.save();
        // Forward velocity-vector aircraft symbol
        ctx.strokeStyle = 'rgba(46, 255, 159, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(fv.x, fv.y, 10, 0, Math.PI * 2);
        ctx.moveTo(fv.x - 20, fv.y); ctx.lineTo(fv.x - 10, fv.y);
        ctx.moveTo(fv.x + 10, fv.y); ctx.lineTo(fv.x + 20, fv.y);
        ctx.moveTo(fv.x, fv.y - 10); ctx.lineTo(fv.x, fv.y - 17);
        ctx.stroke();

        // Dashed weapon gimbal lead line to cursor reticle
        if (this.state === 'PLAYING') {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = 'rgba(44, 245, 255, 0.36)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(fv.x, fv.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // Arena perimeter proximity alert
      const wallDist = Math.min(p.x, this.width - p.x, p.y, this.height - p.y);
      if (wallDist < 115 && Math.floor(this.time * 8) % 2 === 0) {
        ctx.save();
        ctx.font = '700 11px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = wallDist < 60 ? '#ff335f' : '#ffb830';
        ctx.fillText('! PERIMETER FORCEFIELD !', this.width * 0.5, this.height * 0.22);
        ctx.restore();
      }
    }

    if (hudCamMode === 'cockpit_3d' && p) {
      const cx = this.width * 0.5;
      const cy = this.height * 0.5;
      const hAng = p.heading ?? p.angle;
      const deg = ((Math.round((hAng * 180) / Math.PI + 90) % 360) + 360) % 360;

      ctx.save();
      // Subtle translucent canopy arch & side structural struts
      ctx.strokeStyle = 'rgba(44, 245, 255, 0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, this.height * 0.92);
      ctx.lineTo(this.width * 0.14, this.height * 0.26);
      ctx.quadraticCurveTo(cx, this.height * 0.04, this.width * 0.86, this.height * 0.26);
      ctx.lineTo(this.width, this.height * 0.92);
      ctx.stroke();

      // Top Heading Tape (000..359 deg)
      const tapeY = 78;
      ctx.strokeStyle = 'rgba(46, 255, 159, 0.45)';
      ctx.fillStyle = 'rgba(46, 255, 159, 0.85)';
      ctx.font = '700 10px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 140, tapeY);
      ctx.lineTo(cx + 140, tapeY);
      ctx.stroke();
      for (let dOff = -45; dOff <= 45; dOff += 15) {
        const tickDeg = (deg + dOff + 360) % 360;
        const tx = cx + (dOff / 45) * 125;
        ctx.beginPath();
        ctx.moveTo(tx, tapeY);
        ctx.lineTo(tx, tapeY + 6);
        ctx.stroke();
        const label = tickDeg === 0 ? 'N' : tickDeg === 90 ? 'E' : tickDeg === 180 ? 'S' : tickDeg === 270 ? 'W' : String(tickDeg).padStart(3, '0');
        ctx.fillText(label, tx, tapeY - 5);
      }
      ctx.fillStyle = '#2eff9f';
      ctx.fillText(`[ ${String(deg).padStart(3, '0')}° ]`, cx, tapeY + 20);

      // Banked Artificial Horizon Pitch Ladder
      ctx.save();
      ctx.translate(cx, cy + (p.pitch || 0) * 90);
      ctx.rotate(-(p.bank || 0) * 0.18);
      ctx.strokeStyle = 'rgba(46, 255, 159, 0.36)';
      ctx.lineWidth = 1.3;
      [-70, -35, 35, 70].forEach(dy => {
        ctx.beginPath();
        ctx.moveTo(-110, dy); ctx.lineTo(-56, dy); ctx.lineTo(-56, dy + (dy > 0 ? -6 : 6));
        ctx.moveTo(110, dy); ctx.lineTo(56, dy); ctx.lineTo(56, dy + (dy > 0 ? -6 : 6));
        ctx.stroke();
      });
      ctx.restore();

      // Left Airspeed (KTS) & Right Altitude (ALT) Tapes
      const spdKts = Math.round(Math.hypot(p.vx, p.vy) * 1.45);
      const altFt = Math.round((p.z || 55) * 3.2);
      ctx.font = '700 11px Orbitron, monospace';
      ctx.fillStyle = 'rgba(44, 245, 255, 0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(`KTS ${String(spdKts).padStart(3, '0')}`, cx - 175, cy + 4);
      ctx.textAlign = 'left';
      ctx.fillText(`ALT ${String(altFt).padStart(3, '0')}`, cx + 175, cy + 4);
      ctx.restore();
    }

    // 5c. 3D Isometric AR Holo-Minimap (Bottom Right)
    this.arMap.renderMinimapHUD(ctx, this.width, this.height, p, this.enemies, this.singularities, this.time);

    // 6. Live 32-Band FFT Audio Spectrum Visualizer (Bottom Center)
    const spec = audioEnergy.spectrum;
    if (spec && spec.length > 0) {
      const bands = 32;
      const barW = 7;
      const gap = 3;
      const totalW = bands * (barW + gap);
      const sx = (this.width - totalW) * 0.5;
      const sy = this.height - 12;
      ctx.save();
      for (let i = 0; i < bands; i++) {
        const v = (spec[i] || 0) / 255;
        const h = 3 + v * 34;
        ctx.fillStyle = `hsla(${185 + i * 3.5}, 95%, 62%, ${0.28 + v * 0.6})`;
        ctx.fillRect(sx + i * (barW + gap), sy - h, barW, h);
      }
      ctx.restore();
    }

    // 7. Custom Reactive Crosshair Reticle
    if (this.state === 'PLAYING') {
      const mx = this.mouse.x;
      const my = this.mouse.y;
      ctx.save();
      ctx.translate(mx, my);

      // Dash cooldown ring
      const dashReady = p.dashCooldown <= 0;
      const dashRatio = dashReady ? 1 : 1 - p.dashCooldown / p.ship.dashCooldown;
      ctx.strokeStyle = dashReady ? 'rgba(44, 245, 255, 0.85)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 17, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * dashRatio);
      ctx.stroke();

      // Singularity readiness inner arc
      const bhReady = p.singularityCooldown <= 0 || this.selectedMode === 'zen_lab';
      const bhRatio = bhReady ? 1 : 1 - p.singularityCooldown / 6.5;
      ctx.strokeStyle = bhReady ? 'rgba(157, 92, 255, 0.9)' : 'rgba(157, 92, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 11, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * bhRatio);
      ctx.stroke();

      // Crosshair ticks
      ctx.strokeStyle = this.autoFire ? '#2eff9f' : '#eef8ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-23, 0); ctx.lineTo(-14, 0);
      ctx.moveTo(14, 0); ctx.lineTo(23, 0);
      ctx.moveTo(0, -23); ctx.lineTo(0, -14);
      ctx.moveTo(0, 14); ctx.lineTo(0, 23);
      ctx.stroke();
      ctx.restore();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__aetherbreaker = new AetherbreakerGame();
});
