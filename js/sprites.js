// High-DPI 2048x2048 Multi-Frame Aircraft Texture Atlas & Animation Sprite Registry
// Generates crisp metallic multi-bank (-30..+30 deg) & wing-sweep frames synchronously,
// then upgrades neutral/base layers from external assets/planes/*.png images on load.

const BANK_ANGLES = [-0.52, -0.26, 0.0, 0.26, 0.52];

const PLAYER_PALETTES = {
  vanguard: {
    hull: '#84accf', dark: '#2a4163', accent: '#2cf5ff', glow: '#ff2ebd', canopy: '#b0fbff',
    style: 'forward_swept'
  },
  tesla: {
    hull: '#7b9cd9', dark: '#1e3159', accent: '#4ca6ff', glow: '#ffd02e', canopy: '#ffe885',
    style: 'twin_boom'
  },
  chronos: {
    hull: '#6c5da3', dark: '#1c1636', accent: '#b066ff', glow: '#2eff9f', canopy: '#a8ffdf',
    style: 'blackbird'
  },
  solaris: {
    hull: '#b86371', dark: '#471a28', accent: '#ff4866', glow: '#ffb830', canopy: '#ffda88',
    style: 'heavy_bomber'
  }
};

const ENEMY_KEYS = [
  'enemy_swarmer',
  'enemy_lancer',
  'enemy_weaver',
  'enemy_aegis',
  'enemy_splitter',
  'enemy_gravity_mine',
  'enemy_prism_sniper',
  'enemy_carrier'
];

const BOSS_KEYS = ['boss_archon', 'boss_seraphim', 'boss_omega'];

export class SpriteAtlasManager {
  constructor(onAtlasReady = null) {
    this.size = 2048;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.sprites = {};
    this.images = {};
    this.onAtlasReady = onAtlasReady;

    this._buildProceduralAtlas();
    this._loadExternalImages();
  }

  _reg(key, px, py, pw, ph) {
    this.sprites[key] = {
      key,
      px,
      py,
      pw,
      ph,
      u0: px / this.size,
      v0: py / this.size,
      u1: (px + pw) / this.size,
      v1: (py + ph) / this.size
    };
  }

  getSprite(key) {
    return this.sprites[key] || null;
  }

  getPlayerSprite(shipId, bankNorm = 0, swept = false) {
    const clamped = Math.max(-1, Math.min(1, bankNorm));
    const bankIdx = Math.max(0, Math.min(4, Math.round((clamped + 1) * 2)));
    const sweepIdx = swept ? 1 : 0;
    return this.sprites[`player_${shipId}_b${bankIdx}_s${sweepIdx}`] || this.sprites[`player_${shipId}_b2_s0`];
  }

  _buildProceduralAtlas() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    // Rows 0..3: 4 Player Fighters x 5 Bank Angles x 2 Wing-Sweep States (128x128 each)
    const shipIds = Object.keys(PLAYER_PALETTES);
    shipIds.forEach((id, rowIdx) => {
      const y = rowIdx * 128;
      for (let sweep = 0; sweep < 2; sweep++) {
        for (let b = 0; b < 5; b++) {
          const x = (sweep * 5 + b) * 128;
          this._drawFighterCell(ctx, x, y, 128, PLAYER_PALETTES[id], BANK_ANGLES[b], sweep === 1);
          this._reg(`player_${id}_b${b}_s${sweep}`, x, y, 128, 128);
        }
      }
    });

    // Row 4 (y = 512): 8 Enemy Aircraft (128x128)
    ENEMY_KEYS.forEach((key, idx) => {
      const x = idx * 128;
      const y = 512;
      this._drawFallbackEnemyCell(ctx, x, y, 128, key);
      this._reg(key, x, y, 128, 128);
    });

    // Row 5 (y = 640): Animated Sub-Sprites (128x128)
    this._drawSubSprites(ctx, 640);

    // Row 6 (y = 768): Articulated Boss Seg & Boss Aircraft (256x256)
    this._drawBossSeraphimSegment(ctx, 0, 768, 128);
    this._reg('boss_seraphim_seg', 0, 768, 128, 128);

    // Rows 8..9 (y = 1024): 3 Boss Dreadnoughts (256x256 each)
    BOSS_KEYS.forEach((key, idx) => {
      const x = idx * 256;
      const y = 1024;
      this._drawFallbackBossCell(ctx, x, y, 256, key);
      this._reg(key, x, y, 256, 256);
    });
  }

  _drawFighterCell(ctx, ox, oy, cellSize, pal, bankRad, swept) {
    ctx.save();
    ctx.translate(ox + cellSize * 0.5, oy + cellSize * 0.5);
    const scaleX = Math.cos(bankRad * 0.85);
    const bankShift = Math.sin(bankRad) * 9;
    const half = cellSize * 0.44;
    const sweepDelta = swept ? 12 : 0;

    // Subtle shaded wing gradient reacting to roll lighting
    const grad = ctx.createLinearGradient(-half, 0, half, 0);
    grad.addColorStop(0, bankRad < 0 ? pal.hull : pal.dark);
    grad.addColorStop(0.5, pal.hull);
    grad.addColorStop(1, bankRad > 0 ? pal.hull : pal.dark);

    ctx.save();
    ctx.scale(scaleX, 1);

    // Main swept wings
    ctx.fillStyle = grad;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (pal.style === 'forward_swept') {
      ctx.moveTo(0, -half * 0.25);
      ctx.lineTo(half * 0.35, -half * 0.06 + sweepDelta * 0.3);
      ctx.lineTo(half * (swept ? 0.72 : 0.92), -half * 0.30 + sweepDelta * 1.4);
      ctx.lineTo(half * (swept ? 0.76 : 0.95), -half * 0.02 + sweepDelta * 1.4);
      ctx.lineTo(half * 0.38, half * 0.36);
      ctx.lineTo(-half * 0.38, half * 0.36);
      ctx.lineTo(-half * (swept ? 0.76 : 0.95), -half * 0.02 + sweepDelta * 1.4);
      ctx.lineTo(-half * (swept ? 0.72 : 0.92), -half * 0.30 + sweepDelta * 1.4);
      ctx.lineTo(-half * 0.35, -half * 0.06 + sweepDelta * 0.3);
    } else if (pal.style === 'twin_boom') {
      ctx.moveTo(0, -half * 0.26);
      ctx.lineTo(half * (swept ? 0.72 : 0.92), half * 0.1 + sweepDelta);
      ctx.lineTo(half * (swept ? 0.72 : 0.92), half * 0.30 + sweepDelta);
      ctx.lineTo(half * 0.36, half * 0.26);
      ctx.lineTo(half * 0.38, half * 0.72);
      ctx.lineTo(half * 0.22, half * 0.72);
      ctx.lineTo(half * 0.20, half * 0.30);
      ctx.lineTo(-half * 0.20, half * 0.30);
      ctx.lineTo(-half * 0.22, half * 0.72);
      ctx.lineTo(-half * 0.38, half * 0.72);
      ctx.lineTo(-half * 0.36, half * 0.26);
      ctx.lineTo(-half * (swept ? 0.72 : 0.92), half * 0.30 + sweepDelta);
      ctx.lineTo(-half * (swept ? 0.72 : 0.92), half * 0.1 + sweepDelta);
    } else {
      ctx.moveTo(0, -half * 0.32);
      ctx.lineTo(half * (swept ? 0.68 : 0.90), half * 0.36 + sweepDelta * 0.8);
      ctx.lineTo(half * (swept ? 0.62 : 0.84), half * 0.54 + sweepDelta * 0.8);
      ctx.lineTo(half * 0.20, half * 0.48);
      ctx.lineTo(-half * 0.20, half * 0.48);
      ctx.lineTo(-half * (swept ? 0.62 : 0.84), half * 0.54 + sweepDelta * 0.8);
      ctx.lineTo(-half * (swept ? 0.68 : 0.90), half * 0.36 + sweepDelta * 0.8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forward canards
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.64);
    ctx.lineTo(half * 0.30, -half * 0.42 + sweepDelta * 0.4);
    ctx.lineTo(half * 0.25, -half * 0.30 + sweepDelta * 0.4);
    ctx.lineTo(-half * 0.25, -half * 0.30 + sweepDelta * 0.4);
    ctx.lineTo(-half * 0.30, -half * 0.42 + sweepDelta * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wingtip neon navigation lights & intake trim
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(half * 0.24, 0);
    ctx.lineTo(half * (swept ? 0.64 : 0.84), half * 0.20 + sweepDelta);
    ctx.moveTo(-half * 0.24, 0);
    ctx.lineTo(-half * (swept ? 0.64 : 0.84), half * 0.20 + sweepDelta);
    ctx.stroke();

    // Fuselage Spine
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.96);
    ctx.lineTo(half * 0.13, -half * 0.56);
    ctx.lineTo(half * 0.21, half * 0.42);
    ctx.lineTo(half * 0.12, half * 0.74);
    ctx.lineTo(0, half * 0.66);
    ctx.lineTo(-half * 0.12, half * 0.74);
    ctx.lineTo(-half * 0.21, half * 0.42);
    ctx.lineTo(-half * 0.13, -half * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Tail Stabilizers (shifted horizontally by bank angle for true 3D parallax!)
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.moveTo(half * 0.12 + bankShift * 0.5, half * 0.36);
    ctx.lineTo(half * 0.42 + bankShift, half * 0.72);
    ctx.lineTo(half * 0.34 + bankShift, half * 0.80);
    ctx.lineTo(half * 0.12 + bankShift * 0.5, half * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-half * 0.12 + bankShift * 0.5, half * 0.36);
    ctx.lineTo(-half * 0.42 + bankShift, half * 0.72);
    ctx.lineTo(-half * 0.34 + bankShift, half * 0.80);
    ctx.lineTo(-half * 0.12 + bankShift * 0.5, half * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine Exhaust Nozzles
    const nozY = half * 0.74;
    [-half * 0.1, half * 0.1].forEach(nx => {
      ctx.fillStyle = '#151924';
      ctx.beginPath();
      ctx.ellipse(nx, nozY, 4.2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.glow;
      ctx.beginPath();
      ctx.ellipse(nx, nozY + 0.5, 2.8, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Raised 3D Specular Cockpit Canopy (shifts laterally with roll bank)
    const cGrad = ctx.createRadialGradient(
      bankShift * 0.45 - 1.5, -half * 0.48, 1,
      bankShift * 0.45, -half * 0.44, 12
    );
    cGrad.addColorStop(0, '#ffffff');
    cGrad.addColorStop(0.45, pal.canopy);
    cGrad.addColorStop(1, pal.accent);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.ellipse(bankShift * 0.45, -half * 0.44, half * 0.085, half * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  _drawFallbackEnemyCell(ctx, ox, oy, cellSize, key) {
    const colorMap = {
      enemy_swarmer: { hull: '#a84c5c', dark: '#3d1522', accent: '#ff335f', glow: '#ff85a1' },
      enemy_lancer: { hull: '#c98b44', dark: '#4d2f10', accent: '#ffb830', glow: '#ff335f' },
      enemy_weaver: { hull: '#49a87c', dark: '#153d2e', accent: '#2eff9f', glow: '#2cf5ff' },
      enemy_aegis: { hull: '#4f9cb8', dark: '#1b3f54', accent: '#2cf5ff', glow: '#99ffff' },
      enemy_splitter: { hull: '#8d5ec2', dark: '#2d1a4d', accent: '#b066ff', glow: '#ff2ebd' },
      enemy_gravity_mine: { hull: '#9b4ca8', dark: '#361642', accent: '#e03eff', glow: '#2cf5ff' },
      enemy_prism_sniper: { hull: '#b85c8c', dark: '#3b172e', accent: '#ff4da6', glow: '#2cf5ff' },
      enemy_carrier: { hull: '#c4844b', dark: '#4a2c14', accent: '#ff952e', glow: '#ffe066' }
    };
    const p = colorMap[key];
    this._drawFighterCell(ctx, ox, oy, cellSize, { ...p, canopy: '#ffffff', style: 'delta' }, 0, false);
  }

  _drawFallbackBossCell(ctx, ox, oy, cellSize, key) {
    const map = {
      boss_archon: { hull: '#528eb3', dark: '#18304a', accent: '#2cf5ff', glow: '#ff2ebd', canopy: '#b3fcff', style: 'forward_swept' },
      boss_seraphim: { hull: '#43a67b', dark: '#133a2c', accent: '#2eff9f', glow: '#ffb830', canopy: '#b5ffe1', style: 'delta' },
      boss_omega: { hull: '#8255b8', dark: '#261442', accent: '#c06eff', glow: '#ff2ebd', canopy: '#e6ccff', style: 'heavy_bomber' }
    };
    this._drawFighterCell(ctx, ox, oy, cellSize, map[key], 0, false);
  }

  _drawBossSeraphimSegment(ctx, ox, oy, cellSize) {
    ctx.save();
    ctx.translate(ox + cellSize * 0.5, oy + cellSize * 0.5);
    const h = cellSize * 0.42;
    const grad = ctx.createLinearGradient(-h, 0, h, 0);
    grad.addColorStop(0, '#133a2c');
    grad.addColorStop(0.5, '#43a67b');
    grad.addColorStop(1, '#133a2c');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#2eff9f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.72);
    ctx.lineTo(h * 0.24, -h * 0.25);
    ctx.lineTo(h * 0.92, h * 0.22);
    ctx.lineTo(h * 0.80, h * 0.42);
    ctx.lineTo(h * 0.22, h * 0.30);
    ctx.lineTo(h * 0.14, h * 0.74);
    ctx.lineTo(-h * 0.14, h * 0.74);
    ctx.lineTo(-h * 0.22, h * 0.30);
    ctx.lineTo(-h * 0.80, h * 0.42);
    ctx.lineTo(-h * 0.92, h * 0.22);
    ctx.lineTo(-h * 0.24, -h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffb830';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawSubSprites(ctx, y) {
    // 0: rotor_blur
    let x = 0;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    const rg = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
    rg.addColorStop(0, 'rgba(200, 250, 255, 0.9)');
    rg.addColorStop(0.2, 'rgba(44, 245, 255, 0.28)');
    rg.addColorStop(0.85, 'rgba(44, 245, 255, 0.14)');
    rg.addColorStop(1, 'rgba(44, 245, 255, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI * 0.5);
      ctx.fillStyle = 'rgba(215, 252, 255, 0.58)';
      ctx.fillRect(-3.5, -54, 7, 50);
    }
    ctx.restore();
    this._reg('rotor_blur', x, y, 128, 128);

    // 1: radome_dish
    x = 128;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    ctx.strokeStyle = '#2cf5ff';
    ctx.fillStyle = '#1e2c4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd02e';
    ctx.fillRect(-36, -5, 72, 10);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    this._reg('radome_dish', x, y, 128, 128);

    // 2: turret_gun (dual barrel dorsal cannon)
    x = 256;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    ctx.fillStyle = '#253859';
    ctx.strokeStyle = '#ff7a99';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 8, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dceaff';
    ctx.fillRect(-10, -48, 6, 46);
    ctx.fillRect(4, -48, 6, 46);
    ctx.fillStyle = '#ff335f';
    ctx.fillRect(-10, -48, 6, 10);
    ctx.fillRect(4, -48, 6, 10);
    ctx.restore();
    this._reg('turret_gun', x, y, 128, 128);

    // 3..6: afterburner_0 .. afterburner_3 (shock-diamond jet exhaust)
    for (let f = 0; f < 4; f++) {
      const ax = (3 + f) * 128;
      ctx.save();
      ctx.translate(ax + 64, y + 16);
      const len = 78 + (f % 2 === 0 ? 18 : -6) + f * 4;
      const wid = 16 + (f === 1 || f === 3 ? 4 : 0);
      const fg = ctx.createLinearGradient(0, 0, 0, len);
      fg.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      fg.addColorStop(0.25, 'rgba(65, 242, 255, 0.92)');
      fg.addColorStop(0.65, 'rgba(180, 65, 255, 0.55)');
      fg.addColorStop(1, 'rgba(255, 46, 189, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-wid, 0);
      ctx.quadraticCurveTo(0, len * 1.15, 0, len);
      ctx.quadraticCurveTo(0, len * 1.15, wid, 0);
      ctx.closePath();
      ctx.fill();

      // Shock diamonds
      for (let d = 0; d < 3; d++) {
        const dy = 14 + d * 22 + (f * 3) % 8;
        const ds = (3 - d) * 3.8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.moveTo(0, dy - ds);
        ctx.lineTo(ds * 0.65, dy);
        ctx.lineTo(0, dy + ds);
        ctx.lineTo(-ds * 0.65, dy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      this._reg(`afterburner_${f}`, ax, y, 128, 128);
    }

    // 7: mach_cone (supersonic Prandtl-Glauert vapor cone)
    x = 7 * 128;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    const mg = ctx.createLinearGradient(0, -45, 0, 48);
    mg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    mg.addColorStop(0.35, 'rgba(130, 245, 255, 0.45)');
    mg.addColorStop(1, 'rgba(44, 245, 255, 0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(54, 42);
    ctx.quadraticCurveTo(0, 18, -54, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-54, 42);
    ctx.lineTo(0, -42);
    ctx.lineTo(54, 42);
    ctx.stroke();
    ctx.restore();
    this._reg('mach_cone', x, y, 128, 128);

    // 8: muzzle_flash
    x = 8 * 128;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    const mf = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
    mf.addColorStop(0, 'rgba(255, 255, 255, 1)');
    mf.addColorStop(0.3, 'rgba(255, 220, 120, 0.85)');
    mf.addColorStop(1, 'rgba(255, 80, 180, 0)');
    ctx.fillStyle = mf;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 46, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, 46, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this._reg('muzzle_flash', x, y, 128, 128);
  }

  _loadExternalImages() {
    const loadOne = (key, url, onLoaded) => {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        onLoaded(img);
        if (this.onAtlasReady) this.onAtlasReady(this.canvas);
      };
      img.src = url;
    };

    // Upgrade neutral player sprites & banked layers with external PNG textures
    Object.keys(PLAYER_PALETTES).forEach((id, rowIdx) => {
      loadOne(id, `assets/planes/${id}.png`, img => {
        const y = rowIdx * 128;
        const ctx = this.ctx;
        for (let sweep = 0; sweep < 2; sweep++) {
          for (let b = 0; b < 5; b++) {
            const x = (sweep * 5 + b) * 128;
            const bankRad = BANK_ANGLES[b];
            const scaleX = Math.cos(bankRad * 0.82) * (sweep ? 0.86 : 1.0);
            const scaleY = sweep ? 1.06 : 1.0;
            ctx.save();
            ctx.clearRect(x, y, 128, 128);
            ctx.translate(x + 64, y + 64);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(img, -56, -56, 112, 112);
            ctx.restore();
          }
        }
      });
    });

    // Upgrade all 8 enemy aircraft from external PNGs
    ENEMY_KEYS.forEach((key, idx) => {
      loadOne(key, `assets/planes/${key}.png`, img => {
        const x = idx * 128;
        const y = 512;
        this.ctx.clearRect(x, y, 128, 128);
        this.ctx.drawImage(img, x + 8, y + 8, 112, 112);
      });
    });

    // Upgrade all 3 Boss Dreadnoughts from external 512x512 PNGs
    BOSS_KEYS.forEach((key, idx) => {
      loadOne(key, `assets/planes/${key}.png`, img => {
        const x = idx * 256;
        const y = 1024;
        this.ctx.clearRect(x, y, 256, 256);
        this.ctx.drawImage(img, x + 8, y + 8, 240, 240);
      });
    });
  }
}
