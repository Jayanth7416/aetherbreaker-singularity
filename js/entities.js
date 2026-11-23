// Ships, 18 Stackable Roguelite Upgrades, 8 Enemy Archetypes, 3 Procedural 3D Wireframe Bosses,
// Fractal Lightning, Singularities, and GPU Particle Helpers

export const SHIP_CLASSES = [
  {
    id: 'vanguard',
    name: 'VANGUARD-X',
    aircraftModel: 'F-99 VALKYRIE',
    role: 'INTERCEPTOR',
    weaponName: 'Twin Pulse Blasters',
    desc: 'Forward-swept stealth jet with twin plasma cannons & rapid Phase Dash.',
    hex: '#2cf5ff',
    color: [0.17, 0.96, 1.0],
    accent: [1.0, 0.18, 0.74],
    speed: 375,
    maxHp: 100,
    dashCooldown: 1.05,
    fireRate: 0.125,
    weaponType: 'pulse',
    wingspan: 22,
    nozzles: [-5, 5]
  },
  {
    id: 'tesla',
    name: 'TESLA-9',
    aircraftModel: 'EA-77 TEMPEST',
    role: 'ARC CASTER',
    weaponName: 'Fractal Arc Lightning',
    desc: 'Twin-boom strike aircraft chaining arc bolts across 5 targets + Orbital Drone.',
    hex: '#4ca6ff',
    color: [0.3, 0.65, 1.0],
    accent: [1.0, 0.82, 0.18],
    speed: 345,
    maxHp: 95,
    dashCooldown: 1.25,
    fireRate: 0.21,
    weaponType: 'tesla',
    wingspan: 23,
    nozzles: [-10, 10]
  },
  {
    id: 'chronos',
    name: 'CHRONOS-0',
    aircraftModel: 'SR-00 ECLIPSE',
    role: 'SINGULARITY MAGE',
    weaponName: 'Relativistic Railgun',
    desc: 'Hypersonic stealth reconnaissance jet. +45% Singularity Well radius & duration.',
    hex: '#b066ff',
    color: [0.7, 0.4, 1.0],
    accent: [0.18, 1.0, 0.65],
    speed: 335,
    maxHp: 90,
    dashCooldown: 1.25,
    fireRate: 0.34,
    weaponType: 'rail',
    wingspan: 21,
    nozzles: [-6, 6]
  },
  {
    id: 'solaris',
    name: 'SOLARIS-V',
    aircraftModel: 'B-42 VALKYRIE',
    role: 'SWARM ARTILLERY',
    weaponName: 'Homing Micro-Missiles',
    desc: 'Heavy quad-nozzle missile gunship. Phase Dash ignites a Solar Nova blast.',
    hex: '#ff4866',
    color: [1.0, 0.28, 0.4],
    accent: [1.0, 0.72, 0.15],
    speed: 355,
    maxHp: 110,
    dashCooldown: 1.2,
    fireRate: 0.24,
    weaponType: 'missile',
    wingspan: 24,
    nozzles: [-8, -3, 3, 8]
  }
];

export const UPGRADES = [
  {
    id: 'split_shot',
    name: 'Quantum Split-Shot',
    rarity: 'RARE',
    color: '#2cf5ff',
    maxStacks: 4,
    desc: '+2 extra projectiles, arcs, or missiles per volley.'
  },
  {
    id: 'chain_lightning',
    name: 'Fractal Chain Lightning',
    rarity: 'EPIC',
    color: '#9d5cff',
    maxStacks: 4,
    desc: 'Hits arc high-voltage lightning bolts to nearby targets.'
  },
  {
    id: 'ricochet',
    name: 'Ricochet Photons',
    rarity: 'COMMON',
    color: '#2eff9f',
    maxStacks: 4,
    desc: 'Projectiles ricochet off arena boundaries (+2 bounces) and bend toward foes.'
  },
  {
    id: 'orbital_aegis',
    name: 'Orbital Aegis Satellites',
    rarity: 'RARE',
    color: '#2cf5ff',
    maxStacks: 4,
    desc: 'Deploys +2 orbiting plasma blades that shred enemies and block bullets.'
  },
  {
    id: 'hawking_nova',
    name: 'Hawking Supernova',
    rarity: 'EPIC',
    color: '#ff2ebd',
    maxStacks: 3,
    desc: 'Destroyed enemies detonate in a shockwave that damages neighbors & warps spacetime.'
  },
  {
    id: 'event_horizon',
    name: 'Event Horizon Mastery',
    rarity: 'RARE',
    color: '#9d5cff',
    maxStacks: 3,
    desc: '+45% Singularity Well radius, pull strength, and damage over time.'
  },
  {
    id: 'vampiric_nanites',
    name: 'Vampiric Nanites',
    rarity: 'COMMON',
    color: '#ff335f',
    maxStacks: 4,
    desc: 'Restore +3 HP on Bullet Parry and gain nanite life-steal on kills.'
  },
  {
    id: 'overclock',
    name: 'Relativistic Overclock',
    rarity: 'COMMON',
    color: '#ffb830',
    maxStacks: 5,
    desc: '+18% fire rate and +10% thruster speed.'
  },
  {
    id: 'prismatic_pierce',
    name: 'Prismatic Rail Piercing',
    rarity: 'RARE',
    color: '#2cf5ff',
    maxStacks: 4,
    desc: 'Projectiles pierce +2 targets; Railgun beams widen and deal +30% damage.'
  },
  {
    id: 'chrono_reflex',
    name: 'Chrono-Reflex',
    rarity: 'MYTHIC',
    color: '#ffb830',
    maxStacks: 2,
    desc: 'Chrono Parries trigger 2.2s of Bullet-Time dilation & double weapon fire rate.'
  },
  {
    id: 'binary_star',
    name: 'Binary Star',
    rarity: 'MYTHIC',
    color: '#ff2ebd',
    maxStacks: 2,
    desc: 'Singularity Well spawns twin orbiting black holes that amplify gravitational lensing.'
  },
  {
    id: 'tesla_overcharge',
    name: 'Tesla Overcharge',
    rarity: 'EPIC',
    color: '#4ca6ff',
    maxStacks: 3,
    desc: 'Periodically blasts nearby foes with static shocks and grants +15% Crit chance.'
  },
  {
    id: 'hyper_capacitor',
    name: 'Hyper-Capacitor',
    rarity: 'COMMON',
    color: '#2eff9f',
    maxStacks: 5,
    desc: '+25 Max Hull HP, instant repair, and +25% faster Overdrive charge.'
  },
  {
    id: 'phase_echo',
    name: 'Phase Echo',
    rarity: 'RARE',
    color: '#2cf5ff',
    maxStacks: 3,
    desc: 'Phase Dash leaves an explosive photonic decoy and cuts dash cooldown by 18%.'
  },
  {
    id: 'gravity_lensing',
    name: 'Photon Lensing',
    rarity: 'EPIC',
    color: '#9d5cff',
    maxStacks: 3,
    desc: 'Friendly shots passing near a Singularity double in damage and duplicate.'
  },
  {
    id: 'aether_resonance',
    name: 'Aether Resonance',
    rarity: 'MYTHIC',
    color: '#ffb830',
    maxStacks: 2,
    desc: 'Overdrive Novabeam lasts +2s longer, grows 45% wider, and spawns mini-singularities.'
  },
  {
    id: 'crimson_siphon',
    name: 'Crimson Siphon',
    rarity: 'RARE',
    color: '#ff335f',
    maxStacks: 3,
    desc: 'High combo streaks amplify critical hit multiplier and projectile velocity.'
  },
  {
    id: 'entropy_shield',
    name: 'Entropy Aegis',
    rarity: 'COMMON',
    color: '#2cf5ff',
    maxStacks: 3,
    desc: 'Auto-regenerating energy barrier absorbs 1 hit every 11s with a shockwave.'
  }
];

// 3D Geometry Builders for Procedural Wireframe Bosses
export function createOctahedron() {
  return {
    verts: [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ],
    edges: [
      [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 2], [1, 3], [1, 4], [1, 5],
      [2, 4], [4, 3], [3, 5], [5, 2]
    ]
  };
}

export function createIcosahedron() {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ];
  const verts = raw.map(v => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  const edges = [
    [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
    [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
    [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
    [4, 9], [9, 8], [8, 6], [6, 2], [2, 4],
    [1, 9], [5, 4], [11, 2], [10, 6], [7, 8],
    [1, 8], [5, 9], [11, 4], [10, 2], [7, 6]
  ];
  return { verts, edges };
}

export function createDodecahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const inv = 1 / phi;
  const raw = [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    [0, inv, phi], [0, inv, -phi], [0, -inv, phi], [0, -inv, -phi],
    [inv, phi, 0], [inv, -phi, 0], [-inv, phi, 0], [-inv, -phi, 0],
    [phi, 0, inv], [phi, 0, -inv], [-phi, 0, inv], [-phi, 0, -inv]
  ];
  const verts = raw.map(v => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(
        verts[i][0] - verts[j][0],
        verts[i][1] - verts[j][1],
        verts[i][2] - verts[j][2]
      );
      if (d < 0.78) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

export function createRing3D(segments = 16, radius = 1.0, axis = 'z') {
  const verts = [];
  const edges = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    if (axis === 'z') verts.push([c, s, 0]);
    else if (axis === 'y') verts.push([c, 0, s]);
    else verts.push([0, c, s]);
    edges.push([i, (i + 1) % segments]);
  }
  return { verts, edges };
}

export const MESH_OCTAHEDRON = createOctahedron();
export const MESH_ICOSAHEDRON = createIcosahedron();
export const MESH_DODECAHEDRON = createDodecahedron();
export const MESH_RING_Z = createRing3D(20, 1.35, 'z');
export const MESH_RING_Y = createRing3D(20, 1.55, 'y');
export const MESH_RING_X = createRing3D(20, 1.75, 'x');

// Fractal midpoint displacement lightning generator
export function generateLightningPoints(x1, y1, x2, y2, displacement = 28, depth = 4) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  let disp = displacement;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (Math.random() - 0.5) * disp;
      next.push({ x: mx + nx * offset, y: my + ny * offset });
      next.push(b);
    }
    pts = next;
    disp *= 0.52;
  }
  return pts;
}

export function createEnemy(type, x, y, wave = 1) {
  const hpMult = 1 + (wave - 1) * 0.14;
  switch (type) {
    case 'swarmer':
      return {
        type, x, y, z: 46, bank: 0, pitch: 0, vx: 0, vy: 0, angle: Math.random() * Math.PI * 2,
        radius: 13, hp: 22 * hpMult, maxHp: 22 * hpMult, speed: 205 + wave * 3,
        color: [1.0, 0.2, 0.36], score: 60, contactDmg: 12,
        timer: Math.random() * 2, phase: 0
      };
    case 'lancer':
      return {
        type, x, y, z: 54, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 17, hp: 46 * hpMult, maxHp: 46 * hpMult, speed: 155,
        color: [1.0, 0.72, 0.14], score: 130, contactDmg: 18,
        timer: 1.0 + Math.random(), state: 'seek', chargeVx: 0, chargeVy: 0
      };
    case 'weaver':
      return {
        type, x, y, z: 56, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 15, hp: 58 * hpMult, maxHp: 58 * hpMult, speed: 120,
        color: [0.16, 1.0, 0.62], score: 150, contactDmg: 14,
        timer: Math.random() * 4, orbitAngle: Math.random() * Math.PI * 2
      };
    case 'aegis':
      return {
        type, x, y, z: 52, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0, shieldAngle: Math.random() * Math.PI * 2,
        radius: 22, hp: 95 * hpMult, maxHp: 95 * hpMult, speed: 95,
        color: [0.18, 0.94, 1.0], score: 200, contactDmg: 18,
        timer: 0
      };
    case 'splitter':
      return {
        type, x, y, z: 58, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 23, hp: 82 * hpMult, maxHp: 82 * hpMult, speed: 112,
        color: [0.72, 0.3, 1.0], score: 190, contactDmg: 16,
        timer: 0, isMini: false
      };
    case 'mini_splitter':
      return {
        type: 'splitter', x, y, z: 48, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 11, hp: 20 * hpMult, maxHp: 20 * hpMult, speed: 230,
        color: [0.85, 0.45, 1.0], score: 50, contactDmg: 10,
        timer: 0, isMini: true
      };
    case 'gravity_mine':
      return {
        type, x, y, z: 50, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 21, hp: 70 * hpMult, maxHp: 70 * hpMult, speed: 62,
        color: [0.88, 0.18, 1.0], score: 170, contactDmg: 22,
        timer: 0
      };
    case 'prism_sniper':
      return {
        type, x, y, z: 62, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 16, hp: 52 * hpMult, maxHp: 52 * hpMult, speed: 108,
        color: [1.0, 0.35, 0.68], score: 175, contactDmg: 12,
        timer: 1.6 + Math.random(), aimAngle: 0, locking: false
      };
    case 'carrier':
    default:
      return {
        type: 'carrier', x, y, z: 68, bank: 0, pitch: 0, vx: 0, vy: 0, angle: 0,
        radius: 30, hp: 195 * hpMult, maxHp: 195 * hpMult, speed: 68,
        color: [1.0, 0.56, 0.14], score: 340, contactDmg: 22,
        timer: 1.2
      };
  }
}

export function createBoss(bossTier, width, height, wave = 5) {
  const scaleHp = 1 + Math.max(0, wave - 5) * 0.15;
  const cx = width * 0.5;
  const cy = height * 0.24;

  if (bossTier === 1) {
    return {
      isBoss: true,
      tier: 1,
      name: 'ARCHON SKY-FORTRESS',
      subtitle: 'XB-999 ARSENAL FLYING WING',
      x: cx, y: cy, z: 78, vx: 0, vy: 0,
      radius: 74,
      hp: 2100 * scaleHp,
      maxHp: 2100 * scaleHp,
      color: [0.18, 0.96, 1.0],
      accent: [1.0, 0.22, 0.72],
      rotX: 0, rotY: 0, rotZ: 0,
      bank: 0, pitch: 0, angle: Math.PI * 0.5, turretAngle: Math.PI * 0.5,
      phase: 1,
      timer: 0,
      patternTimer: 0,
      spokeAngle: 0,
      score: 3500
    };
  }
  if (bossTier === 2) {
    const segments = [];
    for (let i = 0; i < 12; i++) {
      segments.push({ x: cx + i * 28, y: cy, z: 72, angle: 0, radius: i === 0 ? 44 : 28 - i * 0.9 });
    }
    return {
      isBoss: true,
      tier: 2,
      name: 'SERAPHIM SKY-LEVIATHAN',
      subtitle: 'ARTICULATED GUNSHIP CONVOY',
      x: cx, y: cy, z: 72, vx: 160, vy: 60,
      radius: 48,
      hp: 3400 * scaleHp,
      maxHp: 3400 * scaleHp,
      color: [0.2, 1.0, 0.65],
      accent: [1.0, 0.78, 0.18],
      rotX: 0, rotY: 0, rotZ: 0,
      bank: 0, pitch: 0, angle: 0, turretAngle: 0,
      phase: 1,
      timer: 0,
      patternTimer: 0,
      segments,
      heading: 0,
      score: 6000
    };
  }

  return {
    isBoss: true,
    tier: 3,
    name: 'OMEGA VALKYRIE MOTHERSHIP',
    subtitle: 'ORBITAL SINGULARITY CARRIER',
    x: cx, y: height * 0.36, z: 86, vx: 0, vy: 0,
    radius: 82,
    hp: 5200 * scaleHp,
    maxHp: 5200 * scaleHp,
    color: [0.76, 0.34, 1.0],
    accent: [1.0, 0.2, 0.5],
    rotX: 0, rotY: 0, rotZ: 0,
    bank: 0, pitch: 0, angle: Math.PI * 0.5, turretAngle: Math.PI * 0.5,
    phase: 1,
    timer: 0,
    patternTimer: 0,
    gravityFlip: 1,
    score: 12000
  };
}
