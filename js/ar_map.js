// 3D Augmented Reality (AR) Cityscape & Tactical Map System
// Multi-tier architectural skyscrapers with illuminated windows, 3D pine/canopy/sakura trees,
// green parks, water plazas, paved avenues with moving traffic, elevated monorails, rotating
// wind turbines, forcefield boundaries, LiDAR scans, AR beacons & 3D Holo-Minimap.

export const AR_SECTORS = [
  {
    id: 'neo_tokyo',
    name: 'SECTOR 01 // NEO-TOKYO METROPOLIS',
    shortName: 'NEO-TOKYO',
    primary: [0.15, 0.92, 1.0],
    secondary: [1.0, 0.22, 0.72],
    hullTint: [0.11, 0.17, 0.30],
    parkColor: [0.11, 0.34, 0.20],
    treeStyle: 'mixed'
  },
  {
    id: 'canyon_trench',
    name: 'SECTOR 02 // VALKYRIE CANYON OUTPOST',
    shortName: 'CANYON TRENCH',
    primary: [1.0, 0.65, 0.18],
    secondary: [0.22, 1.0, 0.65],
    hullTint: [0.26, 0.17, 0.12],
    parkColor: [0.16, 0.30, 0.15],
    treeStyle: 'pine'
  },
  {
    id: 'manhattan_nexus',
    name: 'SECTOR 03 // MANHATTAN CENTRAL NEXUS',
    shortName: 'MANHATTAN',
    primary: [0.72, 0.35, 1.0],
    secondary: [0.2, 0.96, 1.0],
    hullTint: [0.16, 0.14, 0.28],
    parkColor: [0.12, 0.38, 0.21],
    treeStyle: 'canopy'
  },
  {
    id: 'orbital_citadel',
    name: 'SECTOR 04 // EMERALD ECO-CITADEL',
    shortName: 'ECO-CITADEL',
    primary: [0.2, 1.0, 0.62],
    secondary: [1.0, 0.36, 0.56],
    hullTint: [0.10, 0.22, 0.22],
    parkColor: [0.12, 0.40, 0.25],
    treeStyle: 'sakura'
  }
];

const FACADE_PALETTES = {
  neo_tokyo: [
    [0.14, 0.20, 0.34],
    [0.18, 0.16, 0.30],
    [0.12, 0.24, 0.32],
    [0.20, 0.22, 0.28]
  ],
  canyon_trench: [
    [0.34, 0.22, 0.16],
    [0.28, 0.21, 0.18],
    [0.22, 0.25, 0.28],
    [0.38, 0.26, 0.17]
  ],
  manhattan_nexus: [
    [0.20, 0.22, 0.30],
    [0.25, 0.20, 0.26],
    [0.16, 0.22, 0.32],
    [0.22, 0.24, 0.26]
  ],
  orbital_citadel: [
    [0.14, 0.26, 0.28],
    [0.18, 0.24, 0.32],
    [0.12, 0.28, 0.24],
    [0.22, 0.20, 0.30]
  ]
};

export class ARMapSystem {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.sectorIdx = 0;
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.roads = [];
    this.streetlamps = [];
    this.traffic = [];
    this.monorails = [];
    this.turbines = [];
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
      b.x *= sx; b.y *= sy;
    }
    for (const pk of this.parks) {
      pk.x *= sx; pk.y *= sy;
      pk.w *= sx; pk.d *= sy;
    }
    for (const t of this.trees) {
      t.x *= sx; t.y *= sy;
    }
    for (const rd of this.roads) {
      rd.x1 *= sx; rd.y1 *= sy;
      rd.x2 *= sx; rd.y2 *= sy;
    }
    for (const sl of this.streetlamps) {
      sl.x *= sx; sl.y *= sy;
    }
    for (const car of this.traffic) {
      car.x *= sx; car.y *= sy;
      car.minPos *= car.axis === 'x' ? sx : sy;
      car.maxPos *= car.axis === 'x' ? sx : sy;
    }
    for (const mr of this.monorails) {
      mr.x1 *= sx; mr.y1 *= sy;
      mr.x2 *= sx; mr.y2 *= sy;
      for (const tr of mr.trains) tr.pos *= mr.axis === 'x' ? sx : sy;
    }
    for (const tb of this.turbines) {
      tb.x *= sx; tb.y *= sy;
    }
    for (const bc of this.beacons) {
      bc.x *= sx; bc.y *= sy;
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
    this.parks = [];
    this.trees = [];
    this.roads = [];
    this.streetlamps = [];
    this.traffic = [];
    this.monorails = [];
    this.turbines = [];

    const w = this.width;
    const h = this.height;
    const sec = this.sector;
    const facades = FACADE_PALETTES[sec.id] || FACADE_PALETTES.neo_tokyo;

    let seed = (idx + 1) * 9137;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const spawnCorridorClear = (x, y) => {
      const dSpawn = Math.hypot(x - w * 0.5, y - h * 0.65);
      const dBoss = Math.hypot(x - w * 0.5, y - h * 0.25);
      return dSpawn > 135 && dBoss > 125;
    };

    const nearRoad = (x, y, margin = 24) => {
      for (const rd of this.roads) {
        if (rd.axis === 'x' && Math.abs(y - rd.y1) < rd.width * 0.5 + margin) return true;
        if (rd.axis === 'y' && Math.abs(x - rd.x1) < rd.width * 0.5 + margin) return true;
      }
      return false;
    };

    const pickTreeKind = () => {
      const r = rand();
      if (sec.treeStyle === 'pine') return r < 0.78 ? 'pine' : 'canopy';
      if (sec.treeStyle === 'sakura') return r < 0.52 ? 'sakura' : (r < 0.8 ? 'canopy' : 'pine');
      if (sec.treeStyle === 'canopy') return r < 0.62 ? 'canopy' : (r < 0.85 ? 'pine' : 'sakura');
      return r < 0.40 ? 'pine' : (r < 0.72 ? 'canopy' : 'sakura');
    };

    const addTree = (x, y, scaleMult = 1.0) => {
      if (x < 40 || x > w - 40 || y < 40 || y > h - 40) return;
      this.trees.push({
        x,
        y,
        kind: pickTreeKind(),
        scale: (0.85 + rand() * 0.5) * scaleMult,
        phase: rand() * Math.PI * 2,
        sway: 0
      });
    };

    const populatePark = (px, py, pw, pd, hasPond = false) => {
      this.parks.push({ x: px, y: py, w: pw, d: pd, hasPond });
      const count = Math.max(4, Math.min(12, Math.floor((pw * pd) / 2800)));
      for (let t = 0; t < count; t++) {
        const tx = px + (rand() - 0.5) * (pw - 24);
        const ty = py + (rand() - 0.5) * (pd - 24);
        if (hasPond && Math.hypot(tx - px, ty - py) < Math.min(pw, pd) * 0.25) continue;
        addTree(tx, ty, 1.05);
      }
    };

    // 1. Road Network & Streetlamps
    const roadW = 32;
    const hYs = sec.id === 'canyon_trench'
      ? [h * 0.40, h * 0.62]
      : (sec.id === 'orbital_citadel'
        ? [h * 0.50]
        : [h * 0.23, h * 0.50, h * 0.77]);
    const vXs = sec.id === 'canyon_trench'
      ? [w * 0.24, w * 0.76]
      : (sec.id === 'orbital_citadel'
        ? [w * 0.50]
        : [w * 0.21, w * 0.41, w * 0.59, w * 0.79]);

    for (const ry of hYs) {
      this.roads.push({ axis: 'x', x1: 24, y1: ry, x2: w - 24, y2: ry, width: roadW });
      const lamps = Math.max(4, Math.floor((w - 80) / 145));
      for (let i = 0; i <= lamps; i++) {
        const lx = 55 + (i / lamps) * (w - 110);
        if (vXs.some(vx => Math.abs(lx - vx) < 30)) continue;
        this.streetlamps.push({ x: lx, y: ry - roadW * 0.5 - 3, h: 17 });
      }
    }
    for (const rx of vXs) {
      this.roads.push({ axis: 'y', x1: rx, y1: 24, x2: rx, y2: h - 24, width: roadW });
      const lamps = Math.max(3, Math.floor((h - 80) / 150));
      for (let i = 0; i <= lamps; i++) {
        const ly = 55 + (i / lamps) * (h - 110);
        if (hYs.some(hy => Math.abs(ly - hy) < 30)) continue;
        this.streetlamps.push({ x: rx + roadW * 0.5 + 3, y: ly, h: 17 });
      }
    }

    // Spawn 24 autonomous vehicles on right-hand lanes
    const carColors = [
      [0.85, 0.88, 0.94],
      [0.24, 0.65, 0.92],
      [0.92, 0.34, 0.42],
      [0.96, 0.76, 0.24],
      [0.34, 0.82, 0.68]
    ];
    for (let i = 0; i < 24; i++) {
      const rd = this.roads[i % this.roads.length];
      const dir = i % 2 === 0 ? 1 : -1;
      const laneOff = dir * 7.5;
      const spd = 42 + rand() * 34;
      const col = carColors[Math.floor(rand() * carColors.length)];
      if (rd.axis === 'x') {
        this.traffic.push({
          axis: 'x',
          x: 34 + rand() * (w - 68),
          y: rd.y1 + laneOff,
          dir,
          speed: spd,
          minPos: 26,
          maxPos: w - 26,
          color: col,
          isTruck: rand() < 0.25
        });
      } else {
        this.traffic.push({
          axis: 'y',
          x: rd.x1 - laneOff,
          y: 34 + rand() * (h - 68),
          dir,
          speed: spd,
          minPos: 26,
          maxPos: h - 26,
          color: col,
          isTruck: rand() < 0.25
        });
      }
    }

    // 2. Elevated 3D Monorail Viaduct
    const monoY = sec.id === 'canyon_trench' ? h * 0.51 : h * 0.365;
    this.monorails.push({
      axis: 'x',
      x1: 24,
      y1: monoY,
      x2: w - 24,
      y2: monoY,
      z: 34,
      trains: [
        { pos: w * 0.22, dir: 1, speed: 125, cars: 3 },
        { pos: w * 0.78, dir: -1, speed: 140, cars: 3 }
      ]
    });

    // 3. City Blocks, Architectural Skyscrapers & Botanical Parks
    const xBounds = [28, ...vXs.flatMap(vx => [vx - roadW * 0.5 - 4, vx + roadW * 0.5 + 4]), w - 28];
    const yBounds = [28, ...hYs.flatMap(hy => [hy - roadW * 0.5 - 4, hy + roadW * 0.5 + 4]), h - 28];

    const blocksX = [];
    for (let i = 0; i < xBounds.length; i += 2) {
      if (xBounds[i + 1] - xBounds[i] > 42) blocksX.push([xBounds[i], xBounds[i + 1]]);
    }
    const blocksY = [];
    for (let i = 0; i < yBounds.length; i += 2) {
      if (yBounds[i + 1] - yBounds[i] > 42) blocksY.push([yBounds[i], yBounds[i + 1]]);
    }

    const pushBuilding = (cx, cy, bw, bd, bh, arch, facetIdx = 0) => {
      const facade = facades[facetIdx % facades.length];
      this.buildings.push({
        x: cx,
        y: cy,
        w: bw,
        d: bd,
        h: bh,
        currentH: bh,
        baseZ: 0,
        arch,
        type: bh > 145 ? 'spire' : 'tower',
        facade,
        color: rand() > 0.35 ? sec.primary : sec.secondary,
        accent: sec.secondary,
        pulse: rand() * Math.PI * 2,
        highlight: 0
      });
    };

    if (sec.id === 'canyon_trench') {
      // Green canyon river valley park in the center + terraced mesas & pines along ridges
      populatePark(w * 0.22, h * 0.50, w * 0.16, h * 0.14, true);
      populatePark(w * 0.78, h * 0.50, w * 0.16, h * 0.14, true);

      for (let i = 0; i < 16; i++) {
        const isTop = i % 2 === 0;
        const cx = ((Math.floor(i / 2) + 0.5) / 8) * (w - 80) + 40;
        const cy = isTop ? h * (0.11 + rand() * 0.12) : h * (0.77 + rand() * 0.12);
        if (!spawnCorridorClear(cx, cy)) {
          addTree(cx + (rand() - 0.5) * 30, cy, 1.15);
          continue;
        }
        const bw = 72 + rand() * 42;
        const bd = 56 + rand() * 36;
        const bh = 88 + rand() * 110;
        const arch = i % 3 === 0 ? 'helipad' : 'mesa_outpost';
        pushBuilding(cx, cy, bw, bd, bh, arch, i);
        // Cluster pine trees around mesa foothills
        for (let k = 0; k < 3; k++) {
          const ang = rand() * Math.PI * 2;
          addTree(cx + Math.cos(ang) * (bw * 0.65 + 14), cy + Math.sin(ang) * (bd * 0.65 + 14), 1.1);
        }
      }
      // Canyon rim wind turbines
      [
        [w * 0.10, h * 0.29],
        [w * 0.90, h * 0.29],
        [w * 0.10, h * 0.71],
        [w * 0.90, h * 0.71]
      ].forEach(([tx, ty], i) => {
        this.turbines.push({ x: tx, y: ty, h: 78, phase: i * 1.3, speed: 2.2 + rand() * 0.6 });
      });
    } else if (sec.id === 'orbital_citadel') {
      // Botanical Eco-Gardens in all 4 Quadrants + Central Plaza + 12-Tower Citadel Ring
      populatePark(w * 0.50, h * 0.50, 130, 96, true);
      populatePark(w * 0.24, h * 0.26, 135, 95, true);
      populatePark(w * 0.76, h * 0.26, 135, 95, true);
      populatePark(w * 0.24, h * 0.74, 135, 95, false);
      populatePark(w * 0.76, h * 0.74, 135, 95, false);

      const arches = ['arcology', 'twin_bridge', 'helipad', 'pagoda', 'stepped'];
      const ringCount = 12;
      for (let i = 0; i < ringCount; i++) {
        const a = ((i + 0.5) / ringCount) * Math.PI * 2;
        const cx = w * 0.5 + Math.cos(a) * (w * 0.37);
        const cy = h * 0.5 + Math.sin(a) * (h * 0.36);
        if (!spawnCorridorClear(cx, cy) || nearRoad(cx, cy, 18)) {
          if (!nearRoad(cx, cy, 10)) addTree(cx, cy, 1.15);
          continue;
        }
        const bh = 105 + (i % 4) * 34;
        pushBuilding(cx, cy, 68, 62, bh, arches[i % arches.length], i);
        addTree(cx + Math.cos(a + 0.22) * 52, cy + Math.sin(a + 0.22) * 52, 1.0);
        addTree(cx - Math.cos(a + 0.22) * 50, cy - Math.sin(a + 0.22) * 50, 0.92);
      }
      // Mid-quadrant eco-arcologies flanking the park groves
      [
        [w * 0.34, h * 0.34, 'arcology'],
        [w * 0.66, h * 0.34, 'pagoda'],
        [w * 0.34, h * 0.66, 'twin_bridge'],
        [w * 0.66, h * 0.66, 'helipad']
      ].forEach(([qx, qy, qArch], i) => {
        if (spawnCorridorClear(qx, qy)) {
          pushBuilding(qx, qy, 58, 56, 118 + i * 16, qArch, i + 1);
          addTree(qx + 42, qy - 36, 0.95);
        }
      });
      [
        [w * 0.10, h * 0.88],
        [w * 0.90, h * 0.12],
        [w * 0.10, h * 0.12],
        [w * 0.90, h * 0.88]
      ].forEach(([tx, ty], i) => {
        this.turbines.push({ x: tx, y: ty, h: 86, phase: i * 1.1, speed: 2.4 });
      });
    } else {
      // Dense urban city blocks (Neo-Tokyo & Manhattan Nexus)
      const arches = sec.id === 'neo_tokyo'
        ? ['pagoda', 'arcology', 'twin_bridge', 'helipad', 'stepped']
        : ['stepped', 'twin_bridge', 'helipad', 'arcology', 'stepped'];

      for (let r = 0; r < blocksY.length; r++) {
        const [y0, y1] = blocksY[r];
        const bhMax = y1 - y0;
        const cy = (y0 + y1) * 0.5;
        for (let c = 0; c < blocksX.length; c++) {
          const [x0, x1] = blocksX[c];
          const bwMax = x1 - x0;
          const cx = (x0 + x1) * 0.5;

          const inCentralPark = Math.hypot((cx - w * 0.5) / w, (cy - h * 0.54) / h) < 0.22;
          const parkChance = (c + r) % 4 === 1;

          if (inCentralPark || !spawnCorridorClear(cx, cy)) {
            // Open green civic park in central flight corridor so spawn has lush scenery & zero obstruction
            populatePark(cx, cy, Math.min(bwMax - 8, 130), Math.min(bhMax - 8, 100), inCentralPark);
            continue;
          }

          if (parkChance && Math.abs(cx - w * 0.5) > 120) {
            populatePark(cx, cy, Math.min(bwMax - 8, 128), Math.min(bhMax - 8, 96), rand() < 0.6);
            continue;
          }

          const distCenter = Math.hypot((cx - w * 0.5) / w, (cy - h * 0.5) / h);
          const subCount = bwMax > 175 ? 2 : 1;
          for (let s = 0; s < subCount; s++) {
            const subX = subCount === 2
              ? cx + (s === 0 ? -bwMax * 0.23 : bwMax * 0.23)
              : cx + (rand() - 0.5) * 10;
            const subY = cy + (rand() - 0.5) * 8;
            if (!spawnCorridorClear(subX, subY)) continue;

            const maxSlotW = subCount === 2 ? bwMax * 0.40 : bwMax * 0.72;
            const bw = Math.max(46, Math.min(92, maxSlotW * (0.76 + rand() * 0.22)));
            const bd = Math.max(44, Math.min(86, bhMax * (0.64 + rand() * 0.24)));
            const bh = (distCenter > 0.26 ? 105 : 78) + rand() * 120;
            const arch = arches[(r * 3 + c + s) % arches.length];
            pushBuilding(subX, subY, bw, bd, bh, arch, r + c + s);

            // Sidewalk trees flanking skyscraper plazas
            addTree(subX - bw * 0.5 - 10, subY - bd * 0.42, 0.88);
            if (rand() > 0.35) addTree(subX + bw * 0.5 + 10, subY + bd * 0.42, 0.88);
          }
        }
      }

      // Corner eco wind turbines
      [
        [w * 0.08, h * 0.12],
        [w * 0.92, h * 0.12],
        [w * 0.08, h * 0.88],
        [w * 0.92, h * 0.88]
      ].forEach(([tx, ty], i) => {
        if (!nearRoad(tx, ty, 10)) {
          this.turbines.push({ x: tx, y: ty, h: 82, phase: i * 1.4, speed: 2.3 });
        }
      });
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

    // Advance road traffic vehicles cleanly along lanes
    for (const car of this.traffic) {
      if (car.axis === 'x') {
        car.x += car.dir * car.speed * dt;
        if (car.dir > 0 && car.x > car.maxPos) car.x = car.minPos;
        if (car.dir < 0 && car.x < car.minPos) car.x = car.maxPos;
      } else {
        car.y += car.dir * car.speed * dt;
        if (car.dir > 0 && car.y > car.maxPos) car.y = car.minPos;
        if (car.dir < 0 && car.y < car.minPos) car.y = car.maxPos;
      }
    }

    // Advance elevated monorail express trains
    for (const mr of this.monorails) {
      const minP = Math.min(mr.x1, mr.x2) + 40;
      const maxP = Math.max(mr.x1, mr.x2) - 40;
      for (const tr of mr.trains) {
        tr.pos += tr.dir * tr.speed * dt;
        if (tr.dir > 0 && tr.pos > maxP) tr.pos = minP;
        if (tr.dir < 0 && tr.pos < minP) tr.pos = maxP;
      }
    }

    // Rotate wind turbines & gently sway trees near black holes
    for (const tb of this.turbines) {
      tb.phase += tb.speed * dt;
    }
    for (const t of this.trees) {
      let targetSway = 0;
      for (const s of singularities) {
        const d = Math.hypot(t.x - s.x, t.y - s.y);
        if (d < s.radius * 1.3) targetSway += (1 - d / (s.radius * 1.3)) * 5.0;
      }
      t.sway += (targetSway - t.sway) * Math.min(1, dt * 6);
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
      [8, 60, 120, wallH].forEach((z, idx) => {
        renderer.drawLine3D(ax, ay, z, bx, by, z, wc.c[0], wc.c[1], wc.c[2], wc.a * (idx === 1 ? 1.15 : 0.78), idx === 3 ? 2.4 : 1.7);
      });
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

    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([cx, cy]) => {
      renderer.drawSolidBox3D(
        cx, cy, 0, 28, 28, wallH + 25,
        sec.hullTint[0], sec.hullTint[1], sec.hullTint[2], 0.94,
        sec.secondary[0], sec.secondary[1], sec.secondary[2], 0.95,
        2.0
      );
    });
  }

  _renderRoadsAndParks(renderer, time, sec, hullAlpha) {
    // 1. Paved City Avenues, Lane Dividers & Streetlamps
    for (const rd of this.roads) {
      const cx = (rd.x1 + rd.x2) * 0.5;
      const cy = (rd.y1 + rd.y2) * 0.5;
      const rw = rd.axis === 'x' ? Math.abs(rd.x2 - rd.x1) : rd.width;
      const rdepth = rd.axis === 'x' ? rd.width : Math.abs(rd.y2 - rd.y1);
      const roadH = rd.axis === 'x' ? 1.8 : 1.85;

      renderer.drawSolidBox3D(cx, cy, 0.5, rw, rdepth, roadH, 0.11, 0.13, 0.19, hullAlpha, 0, 0, 0, 0, 2.0);

      // Sidewalk curbs & dashed center lane markings
      if (rd.axis === 'x') {
        const hw = rd.width * 0.5;
        renderer.drawLine3D(rd.x1, rd.y1 - hw, 2.7, rd.x2, rd.y1 - hw, 2.7, sec.primary[0], sec.primary[1], sec.primary[2], 0.25, 1.2);
        renderer.drawLine3D(rd.x1, rd.y1 + hw, 2.7, rd.x2, rd.y1 + hw, 2.7, sec.primary[0], sec.primary[1], sec.primary[2], 0.25, 1.2);
        for (let x = rd.x1 + 14; x < rd.x2 - 22; x += 36) {
          renderer.drawLine3D(x, rd.y1, 2.8, x + 16, rd.y1, 2.8, 0.95, 0.82, 0.38, 0.5, 1.3);
        }
      } else {
        const hw = rd.width * 0.5;
        renderer.drawLine3D(rd.x1 - hw, rd.y1, 2.7, rd.x1 - hw, rd.y2, 2.7, sec.primary[0], sec.primary[1], sec.primary[2], 0.25, 1.2);
        renderer.drawLine3D(rd.x1 + hw, rd.y1, 2.7, rd.x1 + hw, rd.y2, 2.7, sec.primary[0], sec.primary[1], sec.primary[2], 0.25, 1.2);
        for (let y = rd.y1 + 14; y < rd.y2 - 22; y += 36) {
          renderer.drawLine3D(rd.x1, y, 2.8, rd.x1, y + 16, 2.8, 0.95, 0.82, 0.38, 0.5, 1.3);
        }
      }
    }

    // 2. Streetlamps along roads
    for (const sl of this.streetlamps) {
      renderer.drawLine3D(sl.x, sl.y, 2, sl.x, sl.y, sl.h, 0.45, 0.55, 0.70, 0.85, 1.4);
      renderer.drawParticle3D(sl.x, sl.y, sl.h + 1, 7, 1.0, 0.85, 0.48, 0.85, 0, 0, 0, 0);
    }

    // 3. Green Parks, Grass Lawns & Shimmering Water Plazas
    const pc = sec.parkColor;
    for (const pk of this.parks) {
      renderer.drawSolidBox3D(pk.x, pk.y, 0.8, pk.w, pk.d, 2.6, pc[0], pc[1], pc[2], hullAlpha, 0, 0, 0, 0, 3.0);
      renderer.drawBox3D(pk.x, pk.y, 0.8, pk.w, pk.d, 2.6, 0.25, 0.72, 0.38, 0.35, 1.1);
      if (pk.hasPond) {
        const pw = pk.w * 0.44;
        const pd = pk.d * 0.44;
        const wave = 0.04 * Math.sin(time * 2.5);
        renderer.drawSolidBox3D(pk.x, pk.y, 2.0, pw, pd, 1.8, 0.08, 0.36 + wave, 0.62 + wave, hullAlpha, 0.22, 0.86, 1.0, 0.45, 2.0);
      }
    }
  }

  _renderTrees3D(renderer, time, hullAlpha) {
    for (const t of this.trees) {
      const s = t.scale;
      const swayX = Math.sin(time * 1.9 + t.phase) * (1.1 + t.sway);
      const swayY = Math.cos(time * 1.5 + t.phase) * (0.7 + t.sway * 0.6);
      const trunkH = 12 * s;
      const tx = t.x + swayX * 0.25;
      const ty = t.y + swayY * 0.25;

      // 3D Tree Trunk (wood tone, matId = 2)
      const barkR = t.kind === 'sakura' ? 0.28 : 0.36;
      const barkG = t.kind === 'sakura' ? 0.16 : 0.23;
      const barkB = t.kind === 'sakura' ? 0.15 : 0.14;
      renderer.drawSolidBox3D(t.x, t.y, 2.5, 4.5 * s, 4.5 * s, trunkH, barkR, barkG, barkB, hullAlpha, 0, 0, 0, 0, 2.0);

      if (t.kind === 'pine') {
        // 3 Stacked Conifer Pyramid Tiers
        const baseW = 20 * s;
        renderer.drawSolidPyramid3D(tx, ty, 2.5 + trunkH * 0.65, baseW, baseW, 14 * s, 0.08, 0.36, 0.18, hullAlpha, 0, 0, 0, 0, 3.0);
        renderer.drawSolidPyramid3D(tx + swayX * 0.4, ty + swayY * 0.4, 2.5 + trunkH * 1.25, baseW * 0.78, baseW * 0.78, 13 * s, 0.11, 0.48, 0.23, hullAlpha, 0, 0, 0, 0, 3.0);
        renderer.drawSolidPyramid3D(tx + swayX * 0.7, ty + swayY * 0.7, 2.5 + trunkH * 1.85, baseW * 0.54, baseW * 0.54, 12 * s, 0.16, 0.58, 0.27, hullAlpha, 0, 0, 0, 0, 3.0);
      } else if (t.kind === 'sakura') {
        // Vibrant Cherry-Blossom Canopy Clusters
        const cr = 18 * s;
        const cz = 2.5 + trunkH * 0.85;
        renderer.drawSolidFrustum3D(tx, ty, cz, cr * 0.55, cr * 0.55, cr * 1.15, cr * 1.15, 9 * s, 0.88, 0.42, 0.68, hullAlpha, 0, 0, 0, 0, 3.0);
        renderer.drawSolidFrustum3D(tx + swayX * 0.5, ty + swayY * 0.5, cz + 8 * s, cr * 1.15, cr * 1.15, cr * 0.55, cr * 0.55, 8 * s, 0.98, 0.62, 0.80, hullAlpha, 0, 0, 0, 0, 3.0);
      } else {
        // Broad-Canopy Deciduous Tree (layered verdant green crown)
        const cr = 19 * s;
        const cz = 2.5 + trunkH * 0.82;
        renderer.drawSolidFrustum3D(tx, ty, cz, cr * 0.52, cr * 0.52, cr * 1.15, cr * 1.15, 9.5 * s, 0.12, 0.46, 0.21, hullAlpha, 0, 0, 0, 0, 3.0);
        renderer.drawSolidFrustum3D(tx + swayX * 0.5, ty + swayY * 0.5, cz + 9 * s, cr * 1.15, cr * 1.15, cr * 0.52, cr * 0.52, 8.5 * s, 0.20, 0.62, 0.27, hullAlpha, 0, 0, 0, 0, 3.0);
      }
    }
  }

  _renderTrafficAndMonorails(renderer, sec, hullAlpha) {
    // Ground Street Vehicles
    for (const car of this.traffic) {
      const len = car.isTruck ? 15 : 10.5;
      const wid = car.isTruck ? 6.5 : 5.5;
      const cw = car.axis === 'x' ? len : wid;
      const cd = car.axis === 'x' ? wid : len;
      const c = car.color;

      // Chassis & Roof Cabin
      renderer.drawSolidBox3D(car.x, car.y, 2.5, cw, cd, 3.4, c[0], c[1], c[2], hullAlpha, 0, 0, 0, 0, 2.0);
      renderer.drawSolidBox3D(car.x, car.y, 5.8, cw * 0.62, cd * 0.72, 2.2, 0.72, 0.82, 0.92, hullAlpha, 0, 0, 0, 0, 2.0);

      // Headlights & Taillights
      const hx = car.axis === 'x' ? car.dir * len * 0.52 : 0;
      const hy = car.axis === 'y' ? car.dir * len * 0.52 : 0;
      renderer.drawParticle3D(car.x + hx, car.y + hy, 4.4, 5.5, 0.85, 0.96, 1.0, 0.9, 0, 0, 0, 0);
      renderer.drawParticle3D(car.x - hx, car.y - hy, 4.4, 4.5, 1.0, 0.2, 0.25, 0.85, 0, 0, 0, 0);
    }

    // Elevated Monorail Viaduct & Bullet Trains
    for (const mr of this.monorails) {
      const midX = (mr.x1 + mr.x2) * 0.5;
      const spanW = Math.abs(mr.x2 - mr.x1);
      // Support piers every 155px
      const piers = Math.max(4, Math.round(spanW / 155));
      for (let i = 0; i <= piers; i++) {
        const px = mr.x1 + (i / piers) * spanW;
        renderer.drawSolidBox3D(px, mr.y1, 1.5, 8, 8, mr.z - 1.5, 0.22, 0.26, 0.34, hullAlpha, 0, 0, 0, 0, 2.0);
      }
      // Elevated Viaduct Deck & Glowing Rail Lines
      renderer.drawSolidBox3D(midX, mr.y1, mr.z, spanW, 12, 3.5, 0.20, 0.24, 0.32, hullAlpha, sec.primary[0], sec.primary[1], sec.primary[2], 0.35, 2.0);
      renderer.drawLine3D(mr.x1, mr.y1 - 4, mr.z + 3.8, mr.x2, mr.y1 - 4, mr.z + 3.8, sec.primary[0], sec.primary[1], sec.primary[2], 0.65, 1.4);
      renderer.drawLine3D(mr.x1, mr.y1 + 4, mr.z + 3.8, mr.x2, mr.y1 + 4, mr.z + 3.8, sec.primary[0], sec.primary[1], sec.primary[2], 0.65, 1.4);

      // Moving Multi-Car Express Trains
      for (const tr of mr.trains) {
        for (let c = 0; c < tr.cars; c++) {
          const cx = tr.pos - tr.dir * c * 26;
          if (cx < mr.x1 + 14 || cx > mr.x2 - 14) continue;
          renderer.drawSolidBox3D(cx, mr.y1, mr.z + 3.6, 22, 8.5, 7.2, 0.85, 0.90, 0.96, hullAlpha, sec.primary[0], sec.primary[1], sec.primary[2], 0.55, 2.0);
          // Illuminated Train Windows Band
          renderer.drawSolidBox3D(cx, mr.y1, mr.z + 6.4, 18, 9.0, 2.6, sec.primary[0], sec.primary[1], sec.primary[2], 0.95, 0, 0, 0, 0, 4.0);
          if (c === 0) {
            renderer.drawParticle3D(cx + tr.dir * 12, mr.y1, mr.z + 6.5, 9, 1.0, 0.95, 0.8, 0.95, 0, 0, 0, 0);
          }
        }
      }
    }
  }

  _renderBuildingArchitecture(renderer, b, h, edgeCol, glow, hullAlpha, time, sec) {
    const base = b.facade || sec.hullTint;
    const hr = base[0] + b.highlight * edgeCol[0] * 0.25;
    const hg = base[1] + b.highlight * edgeCol[1] * 0.25;
    const hb = base[2] + b.highlight * edgeCol[2] * 0.25;
    const rimA = Math.min(1.0, glow * 0.72);
    const bz = b.baseZ;

    if (b.arch === 'arcology') {
      const podH = h * 0.12;
      const midH = h * 0.66;
      const topH = h * 0.22;
      // Wide Concrete Podium
      renderer.drawSolidBox3D(b.x, b.y, bz, b.w * 1.06, b.d * 1.06, podH, hr * 0.82, hg * 0.82, hb * 0.82, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.55, 2.0);
      // Tapered Glass Arcology Shaft (windowed matId=1)
      renderer.drawSolidFrustum3D(b.x, b.y, bz + podH, b.w * 0.96, b.d * 0.96, b.w * 0.64, b.d * 0.64, midH, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.75, 1.0);
      // Sky-Ring Observation Belt
      renderer.drawSolidBox3D(b.x, b.y, bz + podH + midH - 3, b.w * 0.72, b.d * 0.72, 5, edgeCol[0], edgeCol[1], edgeCol[2], hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA, 4.0);
      // Glass Pyramid Crown & Spire
      renderer.drawSolidPyramid3D(b.x, b.y, bz + podH + midH + 2, b.w * 0.62, b.d * 0.62, topH, hr * 1.25, hg * 1.25, hb * 1.25, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA, 1.0);
    } else if (b.arch === 'helipad') {
      const podH = h * 0.15;
      const towerH = h * 0.82;
      const roofZ = bz + podH + towerH;
      renderer.drawSolidBox3D(b.x, b.y, bz, b.w * 1.05, b.d * 1.05, podH, hr * 0.85, hg * 0.85, hb * 0.85, hullAlpha, 0, 0, 0, 0, 2.0);
      renderer.drawSolidBox3D(b.x, b.y, bz + podH, b.w * 0.88, b.d * 0.88, towerH, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.65, 1.0);
      // Cantilevered Concrete Helipad Deck
      renderer.drawSolidBox3D(b.x, b.y, roofZ, b.w * 0.98, b.d * 0.98, 5, 0.22, 0.25, 0.30, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.85, 2.0);
      // Helipad Circle & 'H' Marking
      const padZ = roofZ + 6.2;
      const hrRad = Math.min(b.w, b.d) * 0.28;
      renderer.drawCircle3D(b.x, b.y, padZ, hrRad, 1.0, 0.78, 0.22, 0.92, 16, 1.8);
      const hs = hrRad * 0.55;
      renderer.drawLine3D(b.x - hs, b.y - hs, padZ, b.x - hs, b.y + hs, padZ, 1.0, 0.86, 0.32, 0.95, 2.0);
      renderer.drawLine3D(b.x + hs, b.y - hs, padZ, b.x + hs, b.y + hs, padZ, 1.0, 0.86, 0.32, 0.95, 2.0);
      renderer.drawLine3D(b.x - hs, b.y, padZ, b.x + hs, b.y, padZ, 1.0, 0.86, 0.32, 0.95, 2.0);
    } else if (b.arch === 'twin_bridge') {
      const podH = h * 0.16;
      const towerH = h * 0.84;
      const tw = b.w * 0.38;
      const td = b.d * 0.78;
      const offX = b.w * 0.27;
      // Shared Podium
      renderer.drawSolidBox3D(b.x, b.y, bz, b.w * 1.06, b.d * 0.94, podH, hr * 0.82, hg * 0.82, hb * 0.82, hullAlpha, 0, 0, 0, 0, 2.0);
      // Left & Right Twin Skyscrapers
      renderer.drawSolidBox3D(b.x - offX, b.y, bz + podH, tw, td, towerH, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.65, 1.0);
      renderer.drawSolidBox3D(b.x + offX, b.y, bz + podH, tw, td, towerH, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.65, 1.0);
      // Suspended Mid-Air Skybridge + Neon Billboard
      const brZ = bz + h * 0.62;
      renderer.drawSolidBox3D(b.x, b.y, brZ, b.w * 0.56, b.d * 0.32, 11, hr * 1.15, hg * 1.15, hb * 1.15, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA, 1.0);
      renderer.drawSolidBox3D(b.x, b.y + b.d * 0.17, brZ + 2, b.w * 0.36, 3, 6.5, sec.secondary[0], sec.secondary[1], sec.secondary[2], hullAlpha, 0, 0, 0, 0, 4.0);
      // Dual Rooftop Spires
      const topZ = bz + h;
      renderer.drawLine3D(b.x - offX, b.y, topZ, b.x - offX, b.y, topZ + 32, edgeCol[0], edgeCol[1], edgeCol[2], 0.85, 1.8);
      renderer.drawLine3D(b.x + offX, b.y, topZ, b.x + offX, b.y, topZ + 32, edgeCol[0], edgeCol[1], edgeCol[2], 0.85, 1.8);
      return;
    } else if (b.arch === 'pagoda') {
      // Multi-Story Neo-Tokyo Tower with Overhanging Roof Eaves & Neon Strip
      const podH = h * 0.14;
      renderer.drawSolidBox3D(b.x, b.y, bz, b.w * 1.04, b.d * 1.04, podH, hr * 0.82, hg * 0.82, hb * 0.82, hullAlpha, 0, 0, 0, 0, 2.0);
      let curZ = bz + podH;
      const tiers = 3;
      const tierH = (h * 0.74) / tiers;
      for (let t = 0; t < tiers; t++) {
        const shrink = 1 - t * 0.17;
        const tw = b.w * 0.82 * shrink;
        const td = b.d * 0.82 * shrink;
        renderer.drawSolidBox3D(b.x, b.y, curZ, tw, td, tierH - 4, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.45, 1.0);
        // Flared Overhanging Pagoda Roof Eave
        renderer.drawSolidFrustum3D(b.x, b.y, curZ + tierH - 4, tw * 1.24, td * 1.24, tw * 0.94, td * 0.94, 5.5, 0.18, 0.21, 0.28, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.85, 2.0);
        curZ += tierH + 1.5;
      }
      // Crown Pyramid & Glowing Vertical Neon Signboard
      renderer.drawSolidPyramid3D(b.x, b.y, curZ, b.w * 0.46, b.d * 0.46, h * 0.14, 0.18, 0.22, 0.30, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA, 2.0);
      renderer.drawSolidBox3D(b.x + b.w * 0.43, b.y, bz + podH + 8, 3.5, 8, h * 0.45, sec.secondary[0], sec.secondary[1], sec.secondary[2], hullAlpha, 0, 0, 0, 0, 4.0);
    } else if (b.arch === 'mesa_outpost') {
      // Terraced Geological Mesa + Armored Research Bunker
      const m1 = h * 0.38;
      const m2 = h * 0.36;
      const bunkerH = h * 0.26;
      renderer.drawSolidFrustum3D(b.x, b.y, bz, b.w * 1.08, b.d * 1.08, b.w * 0.84, b.d * 0.84, m1, hr, hg, hb, hullAlpha, 0, 0, 0, 0, 2.0);
      renderer.drawSolidFrustum3D(b.x, b.y, bz + m1, b.w * 0.84, b.d * 0.84, b.w * 0.62, b.d * 0.62, m2, hr * 1.12, hg * 1.12, hb * 1.12, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.45, 2.0);
      renderer.drawSolidBox3D(b.x, b.y, bz + m1 + m2, b.w * 0.48, b.d * 0.46, bunkerH, 0.18, 0.23, 0.30, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.8, 1.0);
      // Solar Wing Panel on Bunker Roof
      renderer.drawSolidBox3D(b.x + b.w * 0.18, b.y, bz + h + 2, b.w * 0.32, b.d * 0.56, 2.2, 0.10, 0.26, 0.52, hullAlpha, 0.25, 0.88, 1.0, 0.75, 2.0);
    } else {
      // 'stepped' — Classic Multi-Setback Skyscraper with Rooftop HVAC Penthouse & Billboard
      const podH = h * 0.15;
      const midH = h * 0.55;
      const topH = h * 0.30;
      renderer.drawSolidBox3D(b.x, b.y, bz, b.w * 1.05, b.d * 1.05, podH, hr * 0.84, hg * 0.84, hb * 0.84, hullAlpha, 0, 0, 0, 0, 2.0);
      renderer.drawSolidBox3D(b.x, b.y, bz + podH, b.w * 0.88, b.d * 0.88, midH, hr, hg, hb, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.6, 1.0);
      renderer.drawSolidBox3D(b.x, b.y, bz + podH + midH, b.w * 0.60, b.d * 0.60, topH, hr * 1.1, hg * 1.1, hb * 1.1, hullAlpha, edgeCol[0], edgeCol[1], edgeCol[2], rimA * 0.75, 1.0);
      // Rooftop HVAC Units & Neon Billboard Sign
      renderer.drawSolidBox3D(b.x - b.w * 0.12, b.y, bz + h, b.w * 0.24, b.d * 0.22, 8, 0.24, 0.28, 0.34, hullAlpha, 0, 0, 0, 0, 2.0);
      renderer.drawSolidBox3D(b.x, b.y + b.d * 0.45, bz + podH + midH * 0.72, b.w * 0.44, 3, 7, sec.secondary[0], sec.secondary[1], sec.secondary[2], hullAlpha, 0, 0, 0, 0, 4.0);
    }

    if (b.type === 'spire') {
      const topZ = bz + h;
      renderer.drawLine3D(b.x, b.y, topZ, b.x, b.y, topZ + 42, edgeCol[0], edgeCol[1], edgeCol[2], 0.88, 2.0);
      const blink = 0.45 + 0.55 * Math.sin(time * 5 + b.pulse);
      renderer.drawParticle3D(b.x, b.y, topZ + 42, 9, sec.secondary[0], sec.secondary[1], sec.secondary[2], blink, 0, 0, 0, 0);
    }
  }

  _renderTurbines3D(renderer, hullAlpha) {
    for (const tb of this.turbines) {
      renderer.drawSolidFrustum3D(tb.x, tb.y, 0, 7, 7, 3.8, 3.8, tb.h, 0.76, 0.82, 0.90, hullAlpha, 0, 0, 0, 0, 2.0);
      const hubZ = tb.h + 2;
      renderer.drawSolidBox3D(tb.x, tb.y, hubZ - 3, 6, 11, 6, 0.84, 0.88, 0.94, hullAlpha, 0, 0, 0, 0, 2.0);
      const bladeLen = 28;
      for (let b = 0; b < 3; b++) {
        const ang = tb.phase + (b * Math.PI * 2) / 3;
        const bx = tb.x + Math.cos(ang) * bladeLen;
        const bz = hubZ + Math.sin(ang) * bladeLen;
        renderer.drawLine3D(tb.x, tb.y + 5.5, hubZ, bx, tb.y + 5.5, bz, 0.92, 0.97, 1.0, 0.92, 2.6);
      }
    }
  }

  render3D(renderer, time, audioEnergy, player = null) {
    const bassBoost = audioEnergy.bass * 0.22;
    const isSynth = this.arMode === 'synthetic';
    const isCam = this.arMode === 'camera';
    const sec = this.sector;
    const hullAlpha = isCam ? 0.68 : 0.96;

    // 1. 3D Perimeter Forcefield Walls & Corner Pylons
    this.renderBoundary3D(renderer, player, time, sec);

    // 2. Paved City Roads, Streetlamps, Green Parks & Water Features
    this._renderRoadsAndParks(renderer, time, sec, hullAlpha);

    // 3. 3D Pine, Deciduous Canopy & Sakura Trees
    this._renderTrees3D(renderer, time, hullAlpha);

    // 4. Moving Ground Traffic & Elevated Monorail Sky-Viaduct
    this._renderTrafficAndMonorails(renderer, sec, hullAlpha);

    // 5. Real Multi-Tiered 3D Architectural Skyscrapers, Helipads & Outposts
    for (const b of this.buildings) {
      const edgeCol = isSynth ? [0.22, 1.0, 0.58] : b.color;
      const glow = 0.66 + b.highlight * 0.34 + bassBoost * 0.2;
      const h = b.currentH * (1 + bassBoost * 0.05);
      this._renderBuildingArchitecture(renderer, b, h, edgeCol, glow, hullAlpha, time, sec);
    }

    // 6. Rotating Eco Wind Turbines
    this._renderTurbines3D(renderer, hullAlpha);

    // 7. Expanding 3D LiDAR Terrain Scan Waves
    for (const w of this.lidarWaves) {
      const a = Math.max(0, w.life / w.maxLife);
      const c = isSynth ? [0.2, 1.0, 0.55] : [0.2, 0.96, 1.0];
      renderer.drawCircle3D(w.x, w.y, 12, w.radius, c[0], c[1], c[2], a * 0.9, 44, 3.2);
      renderer.drawCircle3D(w.x, w.y, 70, w.radius * 0.94, sec.secondary[0], sec.secondary[1], sec.secondary[2], a * 0.45, 36, 1.8);
    }

    // 8. Deployable 3D AR Tactical Beacons
    for (const bc of this.beacons) {
      const a = Math.min(1, bc.life * 0.5);
      renderer.drawSolidBox3D(
        bc.x, bc.y, 0, 20, 20, 95,
        sec.hullTint[0], sec.hullTint[1], sec.hullTint[2], 0.9 * a,
        bc.color[0], bc.color[1], bc.color[2], 0.95 * a,
        2.0
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

    // Parks on minimap
    ctx.fillStyle = 'rgba(46, 255, 130, 0.42)';
    for (const pk of this.parks) {
      const pp = iso(pk.x, pk.y, 0);
      ctx.fillRect(pp.x - 3, pp.y - 2, 6, 4);
    }

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
