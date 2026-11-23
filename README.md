# AETHERBREAKER // SINGULARITY

![AETHERBREAKER // SINGULARITY](assets/hero_banner.png)

A zero-dependency **WebGL2 HDR Cyber-Cosmic Aerial Roguelite & Spacetime Physics Arena** featuring multi-pass post-processing shaders, real multi-frame animated fighter aircraft, a spring-mass deformable spacetime grid, 16,000+ instanced GPU particles, and a live procedural Web Audio API synthwave soundtrack with FFT spectrum visualizer.

---

## Key Features

### 1. Real Aircraft Animations & High-Res Sprite Pipeline (`js/sprites.js`, `assets/planes/`)
- **4 Playable Supersonic Jets** with **5-angle 3D Roll Banking (`-30°` to `+30°`)** and **Variable-Geometry Wing Sweep**:
  - **VANGUARD-X (`F-99 Valkyrie`)** — Forward-swept interceptor with twin pulse blasters & rapid Phase Dash.
  - **TESLA-9 (`EA-77 Tempest`)** — Twin-boom electronic strike jet chaining fractal arc lightning + Orbital Drone.
  - **CHRONOS-0 (`SR-00 Eclipse`)** — Hypersonic stealth railgun jet with enlarged Singularity Wells.
  - **SOLARIS-V (`B-42 Valkyrie`)** — Quad-nozzle heavy missile gunship triggering Solar Novas on dash.
- **Dynamic Flight Effects**:
  - **Shock-Diamond Afterburners** (4-frame animated plasma plumes scaling with thrust & Phase Dash).
  - **Wingtip Contrail Vortex Ribbons** continuously shed from dynamic swept/banked wingtips.
  - **Supersonic Prandtl-Glauert Mach Cones** during Phase Dashes and Lancer supersonic charges.
  - **Spinning Rotor & Propeller Discs**, **Rotating AWACS Radomes**, **Swiveling Boss Dorsal Turrets**, **Wing Muzzle Flashes**, and **Battle-Damage Smoke & Sparks** below 55% hull.
- **8 Enemy Aircraft Classes & 3 Aerial Boss Dreadnoughts**:
  - `MiG-X Interceptor` (`Swarmer`), `Su-57 Viper` (`Lancer`), `RQ-9 Laser Relay` (`Weaver`), `AH-88 Gunship` (`Aegis`), `XB-70 Carrier Wing` (`Splitter`), `V-22 Singularity Tilt-Rotor` (`Gravity Mine`), `F-117 Rail-Jet` (`Prism Sniper`), and `C-5 Airborne Carrier` (`Carrier`).
  - Bosses: **Archon Sky-Fortress** (Wave 5), **Seraphim Sky-Leviathan 12-Ship Convoy** (Wave 10), and **Omega Valkyrie Orbital Mothership** (Wave 15+).

### 2. Full 3D Perspective WebGL2 HDR Engine & 4 Camera Modes (`js/renderer.js`)
- **True 3D Perspective Projection**: 3D oriented fighter jets (yaw, pitch, and 3D roll-banking), volumetric altitude shadows/tethers, 3D raycast cursor aiming, and 4 switchable 3D camera angles (`3D TACTICAL`, `3D CHASE`, `3D COCKPIT`, `2.5D OVERHEAD` via `V`).
- **4-Pass Separable HDR Bloom & Gravitational Lensing**: Soft-knee bright extraction, ping-pong Gaussian blur, real-time Schwarzschild gravitational lensing around active Black Hole Singularities, refractive shockwave rings, and Bullet-Time indigo edge grading.

### 3. 3D Augmented Reality (AR) Tactical Map (`js/ar_map.js`)
- **4 3D Extruded AR Geo-Sectors (`N`)**: *Neo-Tokyo LiDAR Grid*, *Valkyrie Canyon Trench*, *Manhattan Singularity Nexus*, and *Orbital Citadel* — complete with physics-reactive 3D holographic skyscrapers, rooftop beacons, and canyon mesas.
- **3D LiDAR Terrain Scan (`L`) & Deployable AR Defense Pylons (`B`)**: Sweeps a 3D cylindrical LiDAR ring across the map, illuminates buildings, tags hostiles with 3D AR bounding-box telemetry (`ALT / DST`), and deploys autonomous AR arc-defense pylons.
- **Live Camera / Synthetic LiDAR AR Passthrough (`R`) + 3D Holo-Minimap**: Stream live webcam passthrough behind the transparent WebGL2 canvas (`getUserMedia`) or toggle the synthetic night-vision LiDAR AR feed alongside a rotating 3D isometric radar minimap.

### 3. Deformable Relativistic Spacetime Grid (`js/grid.js`)
- 64×38 Hooke's Law 3D spring-mass mesh that ripples from explosions, warps into black holes, wakes behind supersonic jets, and pulses to live bass energy.

### 4. Procedural 132 BPM Web Audio Synthwave Engine (`js/audio.js`)
- Zero audio files — pure Web Audio API synthesis with punchy kicks, breakbeat snares/hats, dual-sawtooth Reese basslines, stereo-delayed Phrygian arpeggiator, Bullet-Time low-pass muffling, and a live 32-band FFT spectrum visualizer.

---

## Controls

| Input | Action |
| :--- | :--- |
| `W A S D` / `Arrow Keys` | 360° Flight Thrusters |
| `Left Click` / `C` | Primary Weapon / Toggle Auto-Fire |
| `Space` / `Shift` | **Phase Dash & Chrono-Parry** (dash near enemy bullets to trigger Bullet-Time & shockwave) |
| `Right Click` / `Q` | **Singularity Well** (spawns a gravitational lensing Black Hole) |
| `E` / `F` | **Overdrive: Aether Novabeam** (at 100% Overdrive) |
| `V` | Cycle **3D Camera Angle** (`3D TACTICAL`, `3D CHASE`, `3D COCKPIT`, `2.5D OVERHEAD`) |
| `N` | Switch **3D AR Sector Map** (*Neo-Tokyo*, *Canyon*, *Manhattan*, *Orbital Citadel*) |
| `L` | Trigger **3D LiDAR Terrain & Target Scan** |
| `B` | Deploy **3D AR Defense Beacon** at crosshair |
| `R` | Toggle **Live Camera / Synthetic LiDAR AR Passthrough** |
| `TAB` | Toggle live **FX & Physics Lab** shader/sandbox drawer |
| `1` / `2` / `3` | Draft Roguelite Augmentation Cores |
| `M` / `ESC` | Mute Audio / Pause |

---

## Running Locally

```bash
python3 -m http.server 8420
# Open http://localhost:8420 in any modern WebGL2 browser
```

To regenerate the SVG and PNG aircraft assets in `assets/planes/`:

```bash
python3 scripts/generate_plane_assets.py
```
