// 3D Augmented Reality (AR) Tactical Map System
// Provides 4 3D extruded Geo-Sectors, LiDAR terrain scan waves, deployable AR defense beacons,
// WebRTC Camera AR passthrough (+ synthetic night-vision LiDAR fallback), and 3D Holo-Minimap.

export const AR_SECTORS = [
  {
    id: 'neo_tokyo',
    name: 'SECTOR 01 // NEO-TOKYO LIDAR GRID',
    shortName: 'NEO-TOKYO',
    primary: [0.15, 0.92, 1.0],
    secondary: [1.0, 0.22, 0.72],
    terrainColor: [0.1, 0.45, 0.78]
  },
  {
    id: 'canyon_trench',
    name: 'SECTOR 02 // VALKYRIE CANYON TRENCH',
    shortName: 'CANYON TRENCH',
    primary: [1.0, 0.65, 0.18],
    secondary: [0.22, 1.0, 0.65],
    terrainColor: [0.68, 0.34, 0.14]
  },
  {
    id: 'manhattan_nexus',
    name: 'SECTOR 03 // MANHATTAN SINGULARITY NEXUS',
    shortName: 'MANHATTAN',
    primary: [0.72, 0.35, 1.0],
    secondary: [0.2, 0.96, 1.0],
    terrainColor: [0.35, 0.2, 0.65]
  },
  {
    id: 'orbital_citadel',
    name: 'SECTOR 04 // ORBITAL CITADEL',
    shortName: 'ORBITAL CITADEL',
    primary: [0.2, 1.0, 0.62],
    secondary: [1.0, 0.3, 0.5],
    terrainColor: [0.12, 0.55, 0.42]
  }
];

export class ARMapSystem {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.sectorIdx = 0;
    this.buildings = [];
    this.beacons = [];
    this.lidarWaves = [];
    this.radarSweepTimer = 0;
    this.scanBoostTimer = 0;

    // Camera AR Passthrough State
    this.arMode = 'off'; // 'off' | 'camera' | 'synthetic'
    this.stream = null;
    this.videoEl = null;

    this.generateSector(0);
  }

  get sector() {
    return AR_SECTORS[this.sectorIdx % AR_SECTORS.length];
  }

  resize(width, height) {
    const oldW = Math.max(1, this.width);
    const oldH = Math.max(1, this.height);
    this.width = width;
    this.height = height;
    const sx = width / oldW;
    const sy = height / oldH;
    for (const b of this.buildings) {
      b.x *= sx;
      b.y *= sy;
    }
    for (const bc of this.beacons) {
      bc.x *= sx;
      bc.y *= sy;
    }
  }

  cycleSector() {
    this.sectorIdx = (this.sectorIdx + 1) % AR_SECTORS.length;
    this.generateSector(this.sectorIdx);
    this.triggerLidarScan(this.width * 0.5, this.height * 0.5);
    return this.sector;
  }

  generateSector(idx) {
    this.sectorIdx = idx % AR_SECTORS.length;
    this.buildings = [];
    const w = this.width;
    const h = this.height;
    const sec = this.sector;

    // Deterministic seeded PRNG per sector so layouts look intentional
    let seed = (idx + 1) * 9137;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    if (sec.id === 'neo_tokyo') {
      // Perimeter & avenue holographic skyscrapers + twin comms spires
      const cols = 7;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = ((c + 0.5) / cols) * w;
          const cy = ((r + 0.5) / rows) * h;
          const distCenter = Math.hypot((cx - w * 0.5) / w, (cy - h * 0.5) / h);
          if (distCenter < 0.16) continue; // Open central dogfight arena
          const bw = 38 + rand() * 34;
          const bd = 38 + rand() * 34;
          const bh = (distCenter > 0.34 ? 95 : 42) + rand() * 115;
          this.buildings.push({
            x: cx + (rand() - 0.5) * 28,
            y: cy + (rand() - 0.5) * 24,
            w: bw,
            d: bd,
            h: bh,
            currentH: bh,
            baseZ: 0,
            type: bh > 145 ? 'spire' : 'tower',
            color: rand() > 0.3 ? sec.primary : sec.secondary,
            pulse: rand() * Math.PI * 2,
            highlight: 0
          });
        }
      }
    } else if (sec.id === 'canyon_trench') {
      // Top & bottom stepped canyon ridges flanking a central flight trench
      for (let i = 0; i < 22; i++) {
        const isTop = i % 2 === 0;
        const cx = ((Math.floor(i / 2) + 0.5) / 11) * w;
        const cy = isTop ? h * (0.08 + rand() * 0.16) : h * (0.76 + rand() * 0.16);
        const bw = 70 + rand() * 65;
        const bd = 55 + rand() * 55;
        const bh = 65 + rand() * 110;
        this.buildings.push({
          x: cx,
          y: cy,
          w: bw,
          d: bd,
          h: bh,
          currentH: bh,
          baseZ: 0,
          type: 'mesa',
          color: rand() > 0.35 ? sec.primary : sec.secondary,
          pulse: rand() * Math.PI * 2,
          highlight: 0
        });
      }
    } else if (sec.id === 'manhattan_nexus') {
      // Orthogonal city blocks around central Singularity Plaza
      const gx = 6;
      const gy = 4;
      for (let r = 0; r < gy; r++) {
        for (let c = 0; c < gx; c++) {
          const cx = ((c + 0.5) / gx) * w;
          const cy = ((r + 0.5) / gy) * h;
          const distCenter = Math.hypot(cx - w * 0.5, cy - h * 0.5);
          if (distCenter < 170) continue;
          const bw = 46 + rand() * 28;
          const bd = 46 + rand() * 28;
          const bh = 55 + rand() * 135;
          this.buildings.push({
            x: cx,
            y: cy,
            w: bw,
            d: bd,
            h: bh,
            currentH: bh,
            baseZ: 0,
            type: rand() > 0.65 ? 'spire' : 'tower',
            color: (c + r) % 2 === 0 ? sec.primary : sec.secondary,
            pulse: rand() * Math.PI * 2,
            highlight: 0
          });
        }
      }
    } else {
      // Orbital Citadel: octagonal/box floating defense pylons & reactor cores
      const ringCount = 12;
      for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        const radX = w * 0.37;
        const radY = h * 0.35;
        const bh = 70 + (i % 3) * 45;
        this.buildings.push({
          x: w * 0.5 + Math.cos(a) * radX,
          y: h * 0.5 + Math.sin(a) * radY,
          w: 52,
          d: 52,
          h: bh,
          currentH: bh,
          baseZ: 12,
          type: i % 3 === 0 ? 'spire' : 'tower',
          color: i % 2 === 0 ? sec.primary : sec.secondary,
          pulse: a,
          highlight: 0
        });
      }
    }
  }

  triggerLidarScan(x, y) {
    const maxR = Math.hypot(this.width, this.height) * 0.85;
    this.lidarWaves.push({
      x,
      y,
      radius: 10,
      maxRadius: maxR,
      speed: 980,
      life: 1.6,
      maxLife: 1.6
    });
    this.scanBoostTimer = 6.0;
  }

  deployArBeacon(x, y) {
    if (this.beacons.length >= 4) this.beacons.shift();
    this.beacons.push({
      x,
      y,
      z: 0,
      life: 12.0,
      maxLife: 12.0,
      fireTimer: 0.2,
      color: this.sector.primary
    });
  }

  async toggleCameraAR(videoEl) {
    this.videoEl = videoEl;

    if (this.arMode !== 'off') {
      this._stopStream();
      this.arMode = 'off';
      if (videoEl) videoEl.classList.add('hidden');
      return { mode: 'off', message: 'AR PASSTHROUGH DISENGAGED' };
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        this.stream = stream;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.classList.remove('hidden');
          await videoEl.play().catch(() => {});
        }
        this.arMode = 'camera';
        this.triggerLidarScan(this.width * 0.5, this.height * 0.5);
        return { mode: 'camera', message: 'WEBCAM AR PASSTHROUGH ACTIVE' };
      } catch {
        // Fallback smoothly to Synthetic Satellite / Night-Vision LiDAR AR Feed
      }
    }

    this.arMode = 'synthetic';
    this.triggerLidarScan(this.width * 0.5, this.height * 0.5);
    return { mode: 'synthetic', message: 'SYNTHETIC LIDAR AR FEED ACTIVE' };
  }

  _stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  update(dt, enemies, singularities, damageEnemyFn, lightningArcs) {
    this.scanBoostTimer = Math.max(0, this.scanBoostTimer - dt);

    // Periodic ambient radar sweep
    this.radarSweepTimer += dt;
    if (this.radarSweepTimer > 9.5) {
      this.radarSweepTimer = 0;
      this.lidarWaves.push({
        x: this.width * 0.5,
        y: this.height * 0.5,
        radius: 10,
        maxRadius: Math.hypot(this.width, this.height) * 0.75,
        speed: 650,
        life: 1.8,
        maxLife: 1.8
      });
    }

    // Update LiDAR waves & illuminate buildings on sweep
    for (let i = this.lidarWaves.length - 1; i >= 0; i--) {
      const w = this.lidarWaves[i];
      w.radius += w.speed * dt;
      w.life -= dt;
      for (const b of this.buildings) {
        const d = Math.hypot(b.x - w.x, b.y - w.y);
        if (Math.abs(d - w.radius) < 55) {
          b.highlight = 1.0;
        }
      }
      if (w.life <= 0 || w.radius > w.maxRadius) {
        this.lidarWaves.splice(i, 1);
      }
    }

    // Buildings react to singularities & highlights decay
    for (const b of this.buildings) {
      b.highlight = Math.max(0, b.highlight - dt * 1.4);
      let targetH = b.h;
      for (const s of singularities) {
        const d = Math.hypot(b.x - s.x, b.y - s.y);
        if (d < s.radius * 1.4) {
          targetH += (1 - d / (s.radius * 1.4)) * 65 * Math.sin(performance.now() * 0.015 + b.pulse);
          b.highlight = Math.max(b.highlight, 0.85);
        }
      }
      b.currentH += (targetH - b.currentH) * Math.min(1, dt * 9);
    }

    // Update AR Defense Beacons
    for (let i = this.beacons.length - 1; i >= 0; i--) {
      const bc = this.beacons[i];
      bc.life -= dt;
      bc.fireTimer -= dt;
      if (bc.life <= 0) {
        this.beacons.splice(i, 1);
        continue;
      }
      if (bc.fireTimer <= 0 && enemies.length > 0) {
        bc.fireTimer = 0.45;
        let nearest = null;
        let bestD = 320;
        for (const e of enemies) {
          const d = Math.hypot(e.x - bc.x, e.y - bc.y);
          if (d < bestD) { bestD = d; nearest = e; }
        }
        if (nearest) {
          lightningArcs.push({
            pts: [
              { x: bc.x, y: bc.y, z: 95 },
              { x: (bc.x + nearest.x) * 0.5, y: (bc.y + nearest.y) * 0.5, z: (95 + (nearest.z || 55)) * 0.5 + 18 },
              { x: nearest.x, y: nearest.y, z: nearest.z || 55 }
            ],
            color: bc.color,
            life: 0.14,
            maxLife: 0.14
          });
          damageEnemyFn(nearest, 28, false, bc.color);
        }
      }
    }
  }

  render3D(renderer, time, audioEnergy) {
    const bassBoost = audioEnergy.bass * 0.35;
    const isSynth = this.arMode === 'synthetic';
    const isCam = this.arMode === 'camera';
    const sec = this.sector;

    // 1. 3D AR Tactical Geo-Coordinates & Sector Perimeter Rails
    const pad = 24;
    const perimC = isSynth ? [0.2, 1.0, 0.55] : sec.primary;
    renderer.drawLine3D(pad, pad, 4, this.width - pad, pad, 4, perimC[0], perimC[1], perimC[2], 0.45, 2.0);
    renderer.drawLine3D(this.width - pad, pad, 4, this.width - pad, this.height - pad, 4, perimC[0], perimC[1], perimC[2], 0.45, 2.0);
    renderer.drawLine3D(this.width - pad, this.height - pad, 4, pad, this.height - pad, 4, perimC[0], perimC[1], perimC[2], 0.45, 2.0);
    renderer.drawLine3D(pad, this.height - pad, 4, pad, pad, 4, perimC[0], perimC[1], perimC[2], 0.45, 2.0);

    // 2. 3D Extruded Holographic Buildings / Terrain Mesas
    for (const b of this.buildings) {
      const col = isSynth ? [0.18, 1.0, 0.55] : b.color;
      const glow = 0.22 + b.highlight * 0.65 + bassBoost * 0.35 + (isCam ? 0.2 : 0);
      const h = b.currentH * (1 + bassBoost * 0.12);

      renderer.drawBox3D(b.x, b.y, b.baseZ, b.w, b.d, h, col[0], col[1], col[2], Math.min(0.95, glow), 1.5);

      // Spire antenna & rooftop beacon light
      if (b.type === 'spire') {
        const topZ = b.baseZ + h;
        renderer.drawLine3D(b.x, b.y, topZ, b.x, b.y, topZ + 48, col[0], col[1], col[2], 0.75, 1.8);
        const blink = 0.45 + 0.55 * Math.sin(time * 5 + b.pulse);
        renderer.drawParticle3D(b.x, b.y, topZ + 48, 8, sec.secondary[0], sec.secondary[1], sec.secondary[2], blink, 0, 0, 0, 0);
      }

      // Mid-elevation AR contour slice on tall towers
      if (h > 85) {
        const midZ = b.baseZ + h * 0.55;
        const hw = b.w * 0.52;
        const hd = b.d * 0.52;
        renderer.drawLine3D(b.x - hw, b.y - hd, midZ, b.x + hw, b.y - hd, midZ, col[0], col[1], col[2], glow * 0.6, 1.1);
        renderer.drawLine3D(b.x + hw, b.y - hd, midZ, b.x + hw, b.y + hd, midZ, col[0], col[1], col[2], glow * 0.6, 1.1);
        renderer.drawLine3D(b.x + hw, b.y + hd, midZ, b.x - hw, b.y + hd, midZ, col[0], col[1], col[2], glow * 0.6, 1.1);
        renderer.drawLine3D(b.x - hw, b.y + hd, midZ, b.x - hw, b.y - hd, midZ, col[0], col[1], col[2], glow * 0.6, 1.1);
      }
    }

    // 3. Expanding 3D LiDAR Terrain Scan Waves
    for (const w of this.lidarWaves) {
      const a = Math.max(0, w.life / w.maxLife);
      const c = isSynth ? [0.2, 1.0, 0.55] : [0.2, 0.96, 1.0];
      renderer.drawCircle3D(w.x, w.y, 10, w.radius, c[0], c[1], c[2], a * 0.9, 44, 3.2);
      renderer.drawCircle3D(w.x, w.y, 65, w.radius * 0.94, sec.secondary[0], sec.secondary[1], sec.secondary[2], a * 0.45, 36, 1.8);
    }

    // 4. Deployable 3D AR Tactical Beacons
    for (const bc of this.beacons) {
      const a = Math.min(1, bc.life * 0.5);
      renderer.drawBox3D(bc.x, bc.y, 0, 18, 18, 95, bc.color[0], bc.color[1], bc.color[2], 0.85 * a, 1.8);
      renderer.drawCircle3D(bc.x, bc.y, 8, 95, bc.color[0], bc.color[1], bc.color[2], 0.35 * a, 24, 1.5);
      renderer.drawParticle3D(bc.x, bc.y, 102, 16, bc.color[0], bc.color[1], bc.color[2], 0.95 * a, 0, 0, 0, 0);
    }
  }

  renderMinimapHUD(ctx, width, height, player, enemies, singularities, time) {
    const boxW = 166;
    const boxH = 136;
    const x0 = width - boxW - 18;
    const y0 = height - boxH - 18;

    ctx.save();
    ctx.fillStyle = this.arMode === 'synthetic' ? 'rgba(6, 28, 16, 0.72)' : 'rgba(6, 12, 26, 0.74)';
    ctx.strokeStyle = this.scanBoostTimer > 0 ? 'rgba(46, 255, 159, 0.8)' : 'rgba(44, 245, 255, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x0, y0, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = this.scanBoostTimer > 0 ? '#2eff9f' : '#2cf5ff';
    ctx.fillText(`AR RADAR // ${this.sector.shortName}`, x0 + 10, y0 + 16);

    // Isometric 3D Map Projection inside minimap
    const cx = x0 + boxW * 0.5;
    const cy = y0 + boxH * 0.58;
    const scaleX = (boxW - 36) / Math.max(1, this.width);
    const scaleY = (boxH - 48) / Math.max(1, this.height);
    const rot = Math.sin(time * 0.35) * 0.14;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);

    const iso = (wx, wy, wz = 0) => {
      const nx = (wx - this.width * 0.5) * scaleX;
      const ny = (wy - this.height * 0.5) * scaleY;
      const rx = nx * cosR - ny * sinR;
      const ry = (nx * sinR + ny * cosR) * 0.72 - wz * 0.11;
      return { x: cx + rx, y: cy + ry };
    };

    // Map boundary diamond
    const p1 = iso(0, 0, 0), p2 = iso(this.width, 0, 0), p3 = iso(this.width, this.height, 0), p4 = iso(0, this.height, 0);
    ctx.strokeStyle = 'rgba(44, 245, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
    ctx.stroke();

    // Rotating Radar Sweep Line
    const sweepAng = time * 2.4;
    ctx.strokeStyle = 'rgba(46, 255, 159, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAng) * 58, cy + Math.sin(sweepAng) * 38);
    ctx.stroke();

    // 3D Building Mini-Columns
    ctx.strokeStyle = this.arMode === 'synthetic' ? 'rgba(46, 255, 159, 0.45)' : 'rgba(44, 245, 255, 0.35)';
    for (const b of this.buildings) {
      const bot = iso(b.x, b.y, 0);
      const top = iso(b.x, b.y, b.currentH);
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }

    // Singularities
    for (const s of singularities) {
      const sp = iso(s.x, s.y, 20);
      ctx.strokeStyle = '#b066ff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies with altitude pins
    for (const e of enemies) {
      const base = iso(e.x, e.y, 0);
      const top = iso(e.x, e.y, e.z || 55);
      ctx.strokeStyle = e.isBoss ? 'rgba(255, 184, 48, 0.7)' : 'rgba(255, 51, 95, 0.55)';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = e.isBoss ? '#ffb830' : '#ff335f';
      ctx.beginPath();
      ctx.arc(top.x, top.y, e.isBoss ? 3.8 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Marker
    if (player) {
      const pp = iso(player.x, player.y, player.z || 55);
      ctx.fillStyle = '#2cf5ff';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Footer status
    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8aa2c8';
    const arTag = this.arMode === 'camera' ? 'AR CAM: LIVE' : this.arMode === 'synthetic' ? 'AR CAM: LIDAR' : 'AR HUD: HOLO';
    ctx.fillText(arTag, x0 + 10, y0 + boxH - 8);
    if (this.scanBoostTimer > 0) {
      ctx.fillStyle = '#2eff9f';
      ctx.fillText(`LOCK ${this.scanBoostTimer.toFixed(1)}s`, x0 + boxW - 58, y0 + boxH - 8);
    }

    ctx.restore();
  }
}
