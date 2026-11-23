// Deformable Relativistic 3D Spring-Mass Spacetime Grid

export class SpacetimeGrid {
  constructor(width, height, cols = 58, rows = 34) {
    this.width = width;
    this.height = height;
    this.cols = cols;
    this.rows = rows;
    this.count = cols * rows;

    this.rx = new Float32Array(this.count);
    this.ry = new Float32Array(this.count);
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.z = new Float32Array(this.count);
    this.vx = new Float32Array(this.count);
    this.vy = new Float32Array(this.count);
    this.vz = new Float32Array(this.count);

    this.stiffness = 0.26;
    this.damping = 0.895;
    this.anchorStiffness = 0.028;

    this.resize(width, height, true);
  }

  resize(width, height, reset = false) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const padX = 44;
    const padY = 44;
    const spanX = this.width + padX * 2;
    const spanY = this.height + padY * 2;

    for (let r = 0; r < this.rows; r++) {
      const ty = r / (this.rows - 1);
      for (let c = 0; c < this.cols; c++) {
        const tx = c / (this.cols - 1);
        const i = r * this.cols + c;
        const nrx = -padX + tx * spanX;
        const nry = -padY + ty * spanY;
        this.rx[i] = nrx;
        this.ry[i] = nry;
        if (reset) {
          this.x[i] = nrx;
          this.y[i] = nry;
          this.z[i] = 0;
          this.vx[i] = 0;
          this.vy[i] = 0;
          this.vz[i] = 0;
        }
      }
    }
  }

  applyImpulse(wx, wy, radius, force) {
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = this.x[i] - wx;
      const dy = this.y[i] - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const falloff = 1 - d / radius;
        const str = force * falloff * falloff;
        this.vx[i] += (dx / d) * str;
        this.vy[i] += (dy / d) * str;
        // Ripple wave in Z
        this.vz[i] -= str * 1.85;
      }
    }
  }

  applyImplosion(wx, wy, radius, force) {
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = wx - this.x[i];
      const dy = wy - this.y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 4) {
        const d = Math.sqrt(d2);
        const falloff = 1 - d / radius;
        const str = force * falloff;
        const nx = dx / d;
        const ny = dy / d;
        // Pull inward + orbital swirl + deep relativistic gravity funnel (-Z down)
        this.vx[i] += (nx - ny * 0.42) * str;
        this.vy[i] += (ny + nx * 0.42) * str;
        this.vz[i] -= str * 2.6;
      }
    }
  }

  applyDirectedForce(wx, wy, fx, fy, radius) {
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = this.x[i] - wx;
      const dy = this.y[i] - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const falloff = 1 - Math.sqrt(d2) / radius;
        const w = falloff * falloff;
        this.vx[i] += fx * w;
        this.vy[i] += fy * w;
        this.vz[i] -= (Math.abs(fx) + Math.abs(fy)) * 0.45 * w;
      }
    }
  }

  update(dt, audioBassEnergy = 0, elasticity = 1.0) {
    const step = Math.min(dt * 60, 2.2);
    const k = this.stiffness * elasticity;
    const ak = this.anchorStiffness * Math.sqrt(elasticity);
    const damp = Math.pow(this.damping, step);
    const cols = this.cols;
    const rows = this.rows;

    if (audioBassEnergy > 0.35) {
      const pulse = (audioBassEnergy - 0.35) * 2.5 * step;
      for (let c = 0; c < cols; c++) {
        this.vz[c] += pulse;
        this.vz[(rows - 1) * cols + c] += pulse;
      }
      for (let r = 0; r < rows; r++) {
        this.vz[r * cols] += pulse;
        this.vz[r * cols + (cols - 1)] += pulse;
      }
    }

    for (let r = 0; r < rows; r++) {
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = rowOffset + c;
        let ax = (this.rx[i] - this.x[i]) * ak;
        let ay = (this.ry[i] - this.y[i]) * ak;
        let az = -this.z[i] * ak * 1.4;

        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          ax *= 4.0;
          ay *= 4.0;
        }

        if (c > 0) {
          const left = i - 1;
          const restDx = this.rx[i] - this.rx[left];
          ax += ((this.x[left] + restDx) - this.x[i]) * k;
          ay += (this.y[left] - this.y[i]) * k;
          az += (this.z[left] - this.z[i]) * k;
        }
        if (c < cols - 1) {
          const right = i + 1;
          const restDx = this.rx[right] - this.rx[i];
          ax += ((this.x[right] - restDx) - this.x[i]) * k;
          ay += (this.y[right] - this.y[i]) * k;
          az += (this.z[right] - this.z[i]) * k;
        }
        if (r > 0) {
          const up = i - cols;
          const restDy = this.ry[i] - this.ry[up];
          ax += (this.x[up] - this.x[i]) * k;
          ay += ((this.y[up] + restDy) - this.y[i]) * k;
          az += (this.z[up] - this.z[i]) * k;
        }
        if (r < rows - 1) {
          const down = i + cols;
          const restDy = this.ry[down] - this.ry[i];
          ax += (this.x[down] - this.x[i]) * k;
          ay += ((this.y[down] - restDy) - this.y[i]) * k;
          az += (this.z[down] - this.z[i]) * k;
        }

        this.vx[i] = (this.vx[i] + ax * step) * damp;
        this.vy[i] = (this.vy[i] + ay * step) * damp;
        this.vz[i] = (this.vz[i] + az * step) * damp;
      }
    }

    for (let i = 0; i < this.count; i++) {
      this.x[i] += this.vx[i] * step;
      this.y[i] += this.vy[i] * step;
      this.z[i] += this.vz[i] * step;

      const dx = this.x[i] - this.rx[i];
      const dy = this.y[i] - this.ry[i];
      if (dx > 130) this.x[i] = this.rx[i] + 130;
      else if (dx < -130) this.x[i] = this.rx[i] - 130;
      if (dy > 130) this.y[i] = this.ry[i] + 130;
      else if (dy < -130) this.y[i] = this.ry[i] - 130;
      if (this.z[i] > 180) this.z[i] = 180;
      else if (this.z[i] < -220) this.z[i] = -220;
    }
  }

  renderToBatch(renderer, palette, audioBass = 0) {
    const cols = this.cols;
    const rows = this.rows;
    const baseR = palette.gridBase[0];
    const baseG = palette.gridBase[1];
    const baseB = palette.gridBase[2];
    const hotR = palette.gridHot[0];
    const hotG = palette.gridHot[1];
    const hotB = palette.gridHot[2];
    const beatBoost = audioBass * 0.22;

    for (let r = 0; r < rows; r++) {
      const rowOff = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = rowOff + c;
        const x1 = this.x[i], y1 = this.y[i], z1 = this.z[i];

        const disp = Math.abs(x1 - this.rx[i]) + Math.abs(y1 - this.ry[i]) + Math.abs(z1) * 0.85;
        const speed = Math.abs(this.vx[i]) + Math.abs(this.vy[i]) + Math.abs(this.vz[i]);
        const energy = Math.min(1.0, disp * 0.013 + speed * 0.036 + beatBoost);

        const cr = baseR + (hotR - baseR) * energy;
        const cg = baseG + (hotG - baseG) * energy;
        const cb = baseB + (hotB - baseB) * energy;
        const alpha = 0.16 + energy * 0.68;
        const thick = 1.2 + energy * 2.0;

        if (c < cols - 1) {
          const j = i + 1;
          renderer.drawLine3D(x1, y1, z1, this.x[j], this.y[j], this.z[j], cr, cg, cb, alpha, thick);
        }

        if (r < rows - 1) {
          const k = i + cols;
          renderer.drawLine3D(x1, y1, z1, this.x[k], this.y[k], this.z[k], cr, cg, cb, alpha, thick);
        }

        if (energy > 0.34 && ((r + c) & 1) === 0) {
          renderer.drawParticle3D(x1, y1, z1, 4.0 + energy * 5.0, cr, cg, cb, energy * 0.75, 0, 0, 0, 0);
        }
      }
    }
  }
}
