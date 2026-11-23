// 3D Augmented Reality (AR) Tactical Map System
// Provides solid shaded 3D buildings, 3D forcefield boundary walls, bullet cover & hull collision,
// 4 Geo-Sectors, LiDAR scan waves, deployable AR beacons, WebRTC AR passthrough & 3D Holo-Minimap.

export const AR_SECTORS = [
  {
    id: 'neo_tokyo',
    name: 'SECTOR 01 // NEO-TOKYO LIDAR GRID',
    shortName: 'NEO-TOKYO',
    primary: [0.15, 0.92, 1.0],
    secondary: [1.0, 0.22, 0.72],
    hullTint: [0.08, 0.14, 0.26]
  },
  {
    id: 'canyon_trench',
    name: 'SECTOR 02 // VALKYRIE CANYON TRENCH',
    shortName: 'CANYON TRENCH',
    primary: [1.0, 0.65, 0.18],
    secondary: [0.22, 1.0, 0.65],
    hullTint: [0.22, 0.13, 0.08]
  },
  {
    id: 'manhattan_nexus',
    name: 'SECTOR 03 // MANHATTAN SINGULARITY NEXUS',
    shortName: 'MANHATTAN',
    primary: [0.72, 0.35, 1.0],
    secondary: [0.2, 0.96, 1.0],
    hullTint: [0.14, 0.09, 0.24]
  },
  {
    id: 'orbital_citadel',
    name: 'SECTOR 04 // ORBITAL CITADEL',
    shortName: 'ORBITAL CITADEL',
    primary: [0.2, 1.0, 0.62],
    secondary: [1.0, 0.3, 0.5],
    hullTint: [0.07, 0.18, 0.15]
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

    let seed = (idx + 1) * 9137;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const spawnCorridorClear = (x, y) => {
      // Keep central spawn corridor clear so jets never spawn inside skyscrapers
      const dSpawn = Math.hypot(x - w * 0.5, y - h * 0.65);
      const dBoss = Math.hypot(x - w * 0.5, y - h * 0.25);
      return dSpawn > 135 && dBoss > 125;
    };

    if (sec.id === 'neo_tokyo') {
      const cols = 6;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = ((c + 0.5) / cols) * w;
          const cy = ((r + 0.5) / rows) * h;
          if (!spawnCorridorClear(cx, cy)) continue;
          const distCenter = Math.hypot((cx - w * 0.5) / w, (cy - h * 0.5) / h);
          const bw = 54 + rand() * 34;
          const bd = 54 + rand() * 34;
          const bh = (distCenter > 0.3 ? 110 : 72) + rand() * 115;
          this.buildings.push({
            x: cx + (rand() - 0.5) * 20,
            y: cy + (rand() - 0.5) * 18,
            w: bw,
            d: bd,
            h: bh,
            currentH: bh,
            baseZ: 0,
            type: bh > 155 ? 'spire' : 'tower',
            color: rand() > 0.35 ? sec.primary : sec.secondary,
            pulse: rand() * Math.PI * 2,
            highlight: 0
          });
        }
      }
    } else if (sec.id === 'canyon_trench') {
      for (let i = 0; i < 20; i++) {
        const isTop = i % 2 === 0;
        const cx = ((Math.floor(i / 2) + 0.5) / 10) * w;
        const cy = isTop ? h * (0.11 + rand() * 0.14) : h * (0.75 + rand() * 0.14);
        if (!spawnCorridorClear(cx, cy)) continue;
        const bw = 76 + rand() * 48;
        const bd = 60 + rand() * 44;
        const bh = 85 + rand() * 110;
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
      const gx = 6;
      const gy = 4;
      for (let r = 0; r < gy; r++) {
        for (let c = 0; c < gx; c++) {
          const cx = ((c + 0.5) / gx) * w;
          const cy = ((r + 0.5) / gy) * h;
          if (!spawnCorridorClear(cx, cy)) continue;
          const distCenter = Math.hypot(cx - w * 0.5, cy - h * 0.5);
          if (distCenter < 155) continue;
          const bw = 56 + rand() * 28;
          const bd = 56 + rand() * 28;
          const bh = 78 + rand() * 135;
          this.buildings.push({
            x: cx,
            y: cy,
            w: bw,
            d: bd,
            h: bh,
            currentH: bh,
            baseZ: 0,
            type: rand() > 0.6 ? 'spire' : 'tower',
            color: (c + r) % 2 === 0 ? sec.primary : sec.secondary,
            pulse: rand() * Math.PI * 2,
            highlight: 0
          });
        }
      }
    } else {
      const ringCount = 12;
      for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        const cx = w * 0.5 + Math.cos(a) * (w * 0.36);
        const cy = h * 0.5 + Math.sin(a) * (h * 0.34);
        if (!spawnCorridorClear(cx, cy)) continue;
        const bh = 88 + (i % 3) * 44;
        this.buildings.push({
          x: cx,
          y: cy,
          w: 62,
          d: 62,
          h: bh,
          currentH: bh,
          baseZ: 0,
          type: i % 3 === 0 ? 'spire' : 'tower',
          color: i % 2 === 0 ? sec.primary : sec.secondary,
          pulse: a,
          highlight: 0
        });
      }
    }
  }

  resolveEntityCollision(ent) {
    const ez = ent.z ?? 55;
    const rad = ent.radius || 16;
    let collided = false;
    for (const b of this.buildings) {
      if (ez > b.baseZ + b.currentH + 8) continue;
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      const closestX = Math.max(b.x - hw, Math.min(b.x + hw, ent.x));
      const closestY = Math.max(b.y - hd, Math.min(b.y + hd, ent.y));
      const dx = ent.x - closestX;
      const dy = ent.y - closestY;
      const d2 = dx * dx + dy * dy;
      if (d2 < rad * rad) {
        collided = true;
        b.highlight = Math.max(b.highlight, 0.75);
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          const overlap = rad - d;
          ent.x += (dx / d) * overlap;
          ent.y += (dy / d) * overlap;
        } else {
          // Inside box fallback: push out along shallowest axis
          const penX = hw + rad - Math.abs(ent.x - b.x);
          const penY = hd + rad - Math.abs(ent.y - b.y);
          if (penX < penY) {
            ent.x += ent.x >= b.x ? penX : -penX;
          } else {
            ent.y += ent.y >= b.y ? penY : -penY;
          }
        }
      }
    }
    return collided;
  }

  checkBulletHit(x, y, z = 55) {
    for (const b of this.buildings) {
      if (z > b.baseZ + b.currentH) continue;
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      if (x >= b.x - hw && x <= b.x + hw && y >= b.y - hd && y <= b.y + hd) {
        b.highlight = 1.0;
        return b;
      }
    }
    return null;
  }

  triggerLidarScan(x, y) {
    const maxR = Math.hypot(this.width, this.height) * 0.85;
    this.lidarWaves.push({
      x,
      y,
      radius: 10,
      maxRadius: maxR,
      speed: 820,
      life: 1.9,
      maxLife: 1.9
    });
    this.scanBoostTimer = 6.0;
  }

  deployArBeacon(x, y) {
    if (this.beacons.length >= 4) this.beacons.shift();
    this.beacons.push({
      x,
      y,
      z: 0,
      life: 14.0,
      maxLife: 14.0,
      fireTimer: 0.25,
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

    this.radarSweepTimer += dt;
    if (this.radarSweepTimer > 9.5) {
      this.radarSweepTimer = 0;
      this.lidarWaves.push({
        x: this.width * 0.5,
        y: this.height * 0.5,
        radius: 10,
        maxRadius: Math.hypot(this.width, this.height) * 0.75,
        speed: 580,
        life: 1.9,
        maxLife: 1.9
      });
    }

    for (let i = this.lidarWaves.length - 1; i >= 0; i--) {
      const w = this.lidarWaves[i];
      w.radius += w.speed * dt;
      w.life -= dt;
      for (const b of this.buildings) {
        const d = Math.hypot(b.x - w.x, b.y - w.y);
        if (Math.abs(d - w.radius) < 60) {
          b.highlight = 1.0;
        }
      }
      if (w.life <= 0 || w.radius > w.maxRadius) {
        this.lidarWaves.splice(i, 1);
      }
    }

    for (const b of this.buildings) {
      b.highlight = Math.max(0, b.highlight - dt * 1.4);
      let targetH = b.h;
      for (const s of singularities) {
        const d = Math.hypot(b.x - s.x, b.y - s.y);
        if (d < s.radius * 1.4) {
          targetH += (1 - d / (s.radius * 1.4)) * 45 * Math.sin(performance.now() * 0.012 + b.pulse);
          b.highlight = Math.max(b.highlight, 0.85);
        }
      }
      b.currentH += (targetH - b.currentH) * Math.min(1, dt * 8);
    }

    for (let i = this.beacons.length - 1; i >= 0; i--) {
      const bc = this.beacons[i];
      bc.life -= dt;
      bc.fireTimer -= dt;
      if (bc.life <= 0) {
        this.beacons.splice(i, 1);
        continue;
      }
      if (bc.fireTimer <= 0 && enemies.length > 0) {
        bc.fireTimer = 0.55;
        let nearest = null;
        let bestD = 340;
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
          damageEnemyFn(nearest, 26, false, bc.color);
        }
      }
    }
  }

  renderBoundary3D(renderer, player, time, sec) {
    const pad = 16;
    const x0 = pad, x1 = this.width - pad;
    const y0 = pad, y1 = this.height - pad;
    const wallH = 200;

    // Proximity-reactive color shift when jet nears perimeter walls
    const distWest = player ? player.x - x0 : 999;
    const distEast = player ? x1 - player.x : 999;
    const distNorth = player ? player.y - y0 : 999;
    const distSouth = player ? y1 - player.y : 999;

    const wallColor = dist => {
      if (dist < 140) {
        const t = 1 - dist / 140;
        const pulse = 0.7 + 0.3 * Math.sin(time * 14);
        return { c: [1.0, 0.25 + (1 - t) * 0.45, 0.3], a: (0.55 + t * 0.4) * pulse };
      }
      return { c: sec.primary, a: 0.42 };
    };

    const drawWall = (ax, ay, bx, by, wc) => {
      // Horizontal forcefield rails at 4 altitudes
      [8, 60, 120, wallH].forEach((z, idx) => {
        renderer.drawLine3D(ax, ay, z, bx, by, z, wc.c[0], wc.c[1], wc.c[2], wc.a * (idx === 1 ? 1.15 : 0.78), idx === 3 ? 2.4 : 1.7);
      });
      // Vertical energy ribs every ~160px
      const segs = Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / 160));
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        renderer.drawLine3D(px, py, 0, px, py, wallH, wc.c[0], wc.c[1], wc.c[2], wc.a * 0.65, 1.5);
      }
    };

    drawWall(x0, y0, x1, y0, wallColor(distNorth));
    drawWall(x1, y0, x1, y1, wallColor(distEast));
    drawWall(x1, y1, x0, y1, wallColor(distSouth));
    drawWall(x0, y1, x0, y0, wallColor(distWest));

    // 4 Corner Solid Boundary Anchor Pylons
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([cx, cy]) => {
      renderer.drawSolidBox3D(
        cx, cy, 0, 28, 28, wallH + 25,
        sec.hullTint[0], sec.hullTint[1], sec.hullTint[2], 0.94,
        sec.secondary[0], sec.secondary[1], sec.secondary[2], 0.95
      );
    });
  }

  render3D(renderer, time, audioEnergy, player = null) {
    const bassBoost = audioEnergy.bass * 0.35;
    const isSynth = this.arMode === 'synthetic';
    const isCam = this.arMode === 'camera';
    const sec = this.sector;

    // 1. 3D Holographic Boundary Forcefield Walls & Corner Pylons
    this.renderBoundary3D(renderer, player, time, sec);

    // 2. Solid Shaded 3D Buildings & Mesas with Glowing LiDAR Edges
    for (const b of this.buildings) {
      const edgeCol = isSynth ? [0.22, 1.0, 0.58] : b.color;
      const glow = 0.68 + b.highlight * 0.32 + bassBoost * 0.25;
      const h = b.currentH * (1 + bassBoost * 0.08);
      const hullAlpha = isCam ? 0.65 : 0.94;

      const hr = sec.hullTint[0] + b.highlight * edgeCol[0] * 0.24;
      const hg = sec.hullTint[1] + b.highlight * edgeCol[1] * 0.24;
      const hb = sec.hullTint[2] + b.highlight * edgeCol[2] * 0.24;

      renderer.drawSolidBox3D(
        b.x, b.y, b.baseZ, b.w, b.d, h,
        hr, hg, hb, hullAlpha,
        edgeCol[0], edgeCol[1], edgeCol[2], Math.min(1.0, glow)
      );

      if (b.type === 'spire') {
        const topZ = b.baseZ + h;
        renderer.drawLine3D(b.x, b.y, topZ, b.x, b.y, topZ + 48, edgeCol[0], edgeCol[1], edgeCol[2], 0.9, 2.2);
        const blink = 0.45 + 0.55 * Math.sin(time * 5 + b.pulse);
        renderer.drawParticle3D(b.x, b.y, topZ + 48, 10, sec.secondary[0], sec.secondary[1], sec.secondary[2], blink, 0, 0, 0, 0);
      }
    }

    // 3. Expanding 3D LiDAR Terrain Scan Waves
    for (const w of this.lidarWaves) {
      const a = Math.max(0, w.life / w.maxLife);
      const c = isSynth ? [0.2, 1.0, 0.55] : [0.2, 0.96, 1.0];
      renderer.drawCircle3D(w.x, w.y, 12, w.radius, c[0], c[1], c[2], a * 0.9, 44, 3.2);
      renderer.drawCircle3D(w.x, w.y, 70, w.radius * 0.94, sec.secondary[0], sec.secondary[1], sec.secondary[2], a * 0.45, 36, 1.8);
    }

    // 4. Deployable 3D AR Tactical Beacons
    for (const bc of this.beacons) {
      const a = Math.min(1, bc.life * 0.5);
      renderer.drawSolidBox3D(
        bc.x, bc.y, 0, 20, 20, 95,
        sec.hullTint[0], sec.hullTint[1], sec.hullTint[2], 0.9 * a,
        bc.color[0], bc.color[1], bc.color[2], 0.95 * a
      );
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
    ctx.fillStyle = this.arMode === 'synthetic' ? 'rgba(6, 28, 16, 0.76)' : 'rgba(6, 12, 26, 0.78)';
    ctx.strokeStyle = this.scanBoostTimer > 0 ? 'rgba(46, 255, 159, 0.8)' : 'rgba(44, 245, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x0, y0, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = this.scanBoostTimer > 0 ? '#2eff9f' : '#2cf5ff';
    ctx.fillText(`AR RADAR // ${this.sector.shortName}`, x0 + 10, y0 + 16);

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

    const p1 = iso(0, 0, 0), p2 = iso(this.width, 0, 0), p3 = iso(this.width, this.height, 0), p4 = iso(0, this.height, 0);
    ctx.strokeStyle = 'rgba(44, 245, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
    ctx.stroke();

    const sweepAng = time * 2.4;
    ctx.strokeStyle = 'rgba(46, 255, 159, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAng) * 58, cy + Math.sin(sweepAng) * 38);
    ctx.stroke();

    ctx.strokeStyle = this.arMode === 'synthetic' ? 'rgba(46, 255, 159, 0.55)' : 'rgba(44, 245, 255, 0.45)';
    for (const b of this.buildings) {
      const bot = iso(b.x, b.y, 0);
      const top = iso(b.x, b.y, b.currentH);
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }

    for (const s of singularities) {
      const sp = iso(s.x, s.y, 20);
      ctx.strokeStyle = '#b066ff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

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

    if (player) {
      const pp = iso(player.x, player.y, player.z || 55);
      const hAng = player.heading ?? player.angle;
      const pFwd = iso(player.x + Math.cos(hAng) * 45, player.y + Math.sin(hAng) * 45, player.z || 55);
      ctx.strokeStyle = '#2cf5ff';
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(pFwd.x, pFwd.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

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
