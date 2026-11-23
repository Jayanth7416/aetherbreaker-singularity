// Full 3D Perspective WebGL2 HDR Post-Processing, Depth-Buffered Solid 3D Mesh Pass,
// 3D Oriented Aircraft Sprite Pass, and AR Compositor

const SOLID_VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNormal;
in vec4 aColor;
uniform mat4 uViewProj;
out vec3 vNormal;
out vec4 vColor;
out float vWorldZ;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldZ = aPos.z;
}
`;

const SOLID_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec4 vColor;
in float vWorldZ;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 sunDir = normalize(vec3(0.45, -0.55, 0.72));
  float diff = max(0.0, dot(n, sunDir));
  float roofBoost = smoothstep(0.5, 1.0, n.z) * 0.28;
  float altGrad = clamp(vWorldZ / 180.0, 0.0, 1.0);
  float floorBand = step(0.84, fract(vWorldZ / 26.0)) * (1.0 - abs(n.z)) * 0.25;
  vec3 lit = vColor.rgb * (0.34 + diff * 0.62 + roofBoost + altGrad * 0.22) + vColor.rgb * floorBand;
  fragColor = vec4(lit, vColor.a);
}
`;

const LINE_VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aOther;
in float aSide;
in vec4 aColor;
in vec2 aUv;
uniform mat4 uViewProj;
uniform vec2 uResolution;
out vec4 vColor;
out vec2 vUv;
void main() {
  vec4 clip0 = uViewProj * vec4(aPos, 1.0);
  vec4 clip1 = uViewProj * vec4(aOther, 1.0);
  if (clip0.w < 1.0 && clip1.w < 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    vUv = aUv;
    return;
  }
  float w0 = max(1.0, clip0.w);
  float w1 = max(1.0, clip1.w);
  vec2 ndc0 = clip0.xy / w0;
  vec2 ndc1 = clip1.xy / w1;
  vec2 delta = (ndc1 - ndc0) * uResolution;
  float len = length(delta);
  vec2 dir = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 offsetNdc = (perp * aSide) / uResolution * 2.0;

  gl_Position = vec4(clip0.xy + offsetNdc * w0, clip0.z, w0);
  vColor = aColor;
  vUv = aUv;
}
`;

const LINE_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float d = abs(vUv.y);
  float core = exp(-d * d * 5.2);
  float halo = smoothstep(1.0, 0.05, d) * 0.42;
  float intensity = core + halo;
  vec3 hot = mix(vColor.rgb, vec3(1.0), core * 0.38 * vColor.a);
  fragColor = vec4(hot, vColor.a * intensity);
}
`;

const SPRITE_VS = `#version 300 es
precision highp float;
in vec2 aQuad;          // -0.5 .. +0.5
in vec4 iPosYaw;        // x, y, z, yaw
in vec4 iSizePitchBank; // w, h, pitch, bank
in vec4 iUvRect;        // u0, v0, u1, v1
in vec4 iColor;         // r, g, b, a
in vec4 iMeta;          // hitFlash, emissiveBoost, billboardFlag, unused
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vUv;
out vec4 vColor;
out float vHitFlash;
out float vEmissive;
void main() {
  vec3 worldPos;
  if (iMeta.z > 0.5) {
    worldPos = iPosYaw.xyz
      + uCamRight * (aQuad.x * iSizePitchBank.x)
      - uCamUp * (aQuad.y * iSizePitchBank.y);
  } else {
    float yaw = iPosYaw.w;
    float pitch = iSizePitchBank.z;
    float roll = iSizePitchBank.w * 0.58;
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    vec3 fwd = vec3(cy * cp, sy * cp, sp);
    vec3 flatRight = vec3(-sy, cy, 0.0);
    vec3 upVec = normalize(cross(fwd, flatRight));
    vec3 wing = flatRight * cos(roll) - upVec * sin(roll);
    worldPos = iPosYaw.xyz
      + wing * (aQuad.x * iSizePitchBank.x)
      - fwd * (aQuad.y * iSizePitchBank.y);
  }

  gl_Position = uViewProj * vec4(worldPos, 1.0);
  vec2 t = aQuad + 0.5;
  vUv = mix(iUvRect.xy, iUvRect.zw, t);
  vColor = iColor;
  vHitFlash = iMeta.x;
  vEmissive = iMeta.y;
}
`;

const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
in float vHitFlash;
in float vEmissive;
uniform sampler2D uAtlas;
out vec4 fragColor;
void main() {
  vec4 tex = texture(uAtlas, vUv);
  if (tex.a < 0.01) discard;
  vec3 col = tex.rgb * vColor.rgb;
  float peak = max(tex.r, max(tex.g, tex.b));
  col *= 1.0 + vEmissive * smoothstep(0.62, 1.0, peak);
  col = mix(col, vec3(1.0), vHitFlash * 0.85);
  fragColor = vec4(col, tex.a * vColor.a);
}
`;

const PARTICLE_VS = `#version 300 es
precision highp float;
in vec2 aQuad;
in vec4 iPosSize;   // x, y, z, size
in vec4 iVelStretch; // vx, vy, vz, stretch
in vec4 iColor;
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vQuad;
out vec4 vColor;
void main() {
  float size = iPosSize.w;
  vec3 vel = iVelStretch.xyz;
  float spd = length(vel);
  vec3 worldPos;
  if (spd > 5.0 && iVelStretch.w > 0.001) {
    vec3 vDir = vel / spd;
    vec3 cCross = cross(vDir, cross(uCamRight, uCamUp));
    vec3 perp = length(cCross) > 0.001 ? normalize(cCross) : uCamRight;
    float stretch = 1.0 + min(spd * iVelStretch.w, 6.0);
    worldPos = iPosSize.xyz + vDir * (aQuad.x * size * stretch) + perp * (aQuad.y * size);
  } else {
    worldPos = iPosSize.xyz + (uCamRight * aQuad.x + uCamUp * aQuad.y) * size;
  }
  gl_Position = uViewProj * vec4(worldPos, 1.0);
  vQuad = aQuad;
  vColor = iColor;
}
`;

const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vQuad;
in vec4 vColor;
out vec4 fragColor;
void main() {
  float r2 = dot(vQuad, vQuad);
  if (r2 > 1.0) discard;
  float falloff = exp(-r2 * 4.2) * (1.0 - r2);
  float core = exp(-r2 * 14.0) * 0.55;
  vec3 rgb = mix(vColor.rgb, vec3(1.0), core * vColor.a);
  fragColor = vec4(rgb, vColor.a * (falloff + core * 0.4));
}
`;

const FULLSCREEN_VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const BLOOM_EXTRACT_BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform float uExtract;
uniform float uThreshold;
out vec4 fragColor;

vec3 sampleBright(vec2 uv) {
  vec3 c = texture(uTex, clamp(uv, 0.001, 0.999)).rgb;
  if (uExtract > 0.5) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float soft = max(0.0, lum - uThreshold) / max(0.0001, lum + 0.05);
    return c * soft * 1.45;
  }
  return c;
}

void main() {
  vec2 stepUv = uTexelSize * uDirection;
  vec3 sum = sampleBright(vUv) * 0.227027;
  sum += sampleBright(vUv + stepUv * 1.384615) * 0.316216;
  sum += sampleBright(vUv - stepUv * 1.384615) * 0.316216;
  sum += sampleBright(vUv + stepUv * 3.230769) * 0.070270;
  sum += sampleBright(vUv - stepUv * 3.230769) * 0.070270;
  fragColor = vec4(sum, 1.0);
}
`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSceneTex;
uniform sampler2D uBloomTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloomIntensity;
uniform float uAberration;
uniform float uLensingStrength;
uniform float uChronoShift;
uniform float uArTransparent;
uniform vec2 uShakeOffset;
uniform vec4 uSingularities[8];
uniform int uNumSingularities;
uniform vec4 uShockwaves[8];
uniform int uNumShockwaves;
out vec4 fragColor;

void main() {
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 uv = vUv + uShakeOffset;
  float horizonDark = 1.0;
  vec3 lensingGlow = vec3(0.0);

  for (int i = 0; i < 8; i++) {
    if (i >= uNumSingularities) break;
    vec4 s = uSingularities[i];
    vec2 diff = uv - s.xy;
    diff.x *= aspect;
    float dist = length(diff);
    float rad = max(s.z, 0.001);
    float horizon = rad * 0.28;

    if (dist < rad * 4.5) {
      vec2 dir = dist > 0.0001 ? diff / dist : vec2(0.0);
      float lens = (s.w * uLensingStrength * rad * rad) / (dist * dist + rad * rad * 0.14);
      float envelope = smoothstep(rad * 4.5, horizon * 0.7, dist);
      uv -= vec2(dir.x / aspect, dir.y) * lens * 0.24 * envelope;

      horizonDark *= smoothstep(horizon * 0.85, horizon * 1.15, dist);

      float ringD = abs(dist - horizon * 1.18);
      float ring = exp(-ringD * ringD / max(0.00001, rad * rad * 0.008));
      float outerHalo = exp(-abs(dist - rad * 0.7) / max(0.001, rad * 0.35)) * 0.25;
      float ang = dist > 0.0001 ? atan(diff.y, diff.x) : 0.0;
      float pulse = 0.85 + 0.15 * sin(uTime * 8.0 + ang * 4.0);
      lensingGlow += (vec3(0.45, 0.85, 1.0) * ring * 1.4 + vec3(0.65, 0.2, 1.0) * outerHalo) * pulse * s.w;
    }
  }

  vec3 shockGlow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uNumShockwaves) break;
    vec4 sw = uShockwaves[i];
    vec2 diff = uv - sw.xy;
    diff.x *= aspect;
    float dist = length(diff);
    float ringD = dist - sw.z;
    float band = exp(-(ringD * ringD) / max(0.00002, sw.w * sw.w));
    if (band > 0.01 && dist > 0.0001) {
      vec2 dir = diff / dist;
      uv -= vec2(dir.x / aspect, dir.y) * band * 0.022;
      shockGlow += vec3(0.3, 0.9, 1.0) * band * 0.32;
    }
  }

  vec2 fromCenter = uv - 0.5;
  float edgeDist = length(fromCenter);
  float caAmt = (0.0012 + edgeDist * 0.0032) * uAberration;
  vec2 caOffset = fromCenter * caAmt;

  vec2 uvR = clamp(uv + caOffset, 0.001, 0.999);
  vec2 uvG = clamp(uv, 0.001, 0.999);
  vec2 uvB = clamp(uv - caOffset, 0.001, 0.999);

  vec4 texG = texture(uSceneTex, uvG);
  vec3 sceneCol = vec3(
    texture(uSceneTex, uvR).r,
    texG.g,
    texture(uSceneTex, uvB).b
  );

  vec3 bloomCol = vec3(
    texture(uBloomTex, uvR).r,
    texture(uBloomTex, uvG).g,
    texture(uBloomTex, uvB).b
  );

  vec3 color = sceneCol + bloomCol * uBloomIntensity + shockGlow;
  color = color * horizonDark + lensingGlow;

  if (uChronoShift > 0.01) {
    float chronoMask = smoothstep(0.18, 0.85, edgeDist) * uChronoShift;
    color = mix(color, color * vec3(0.75, 0.92, 1.35) + vec3(0.03, 0.06, 0.16), chronoMask * 0.65);
  }

  float scan = 0.965 + 0.035 * sin(uv.y * uResolution.y * 1.4);
  float vig = smoothstep(1.05, 0.35, edgeDist);
  color *= scan * (0.72 + 0.28 * vig);
  color = color / (1.0 + color * 0.12);

  if (uArTransparent > 0.5) {
    float lum = max(color.r, max(color.g, color.b));
    float blackCore = (1.0 - horizonDark) * 0.92;
    float alpha = clamp(max(texG.a, lum * 1.65) + blackCore, 0.0, 1.0);
    fragColor = vec4(color, alpha);
  } else {
    fragColor = vec4(color, 1.0);
  }
}
`;

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export class WebGLPostRenderer {
  constructor(glCanvas) {
    this.canvas = glCanvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.fallback2D = false;
    this.ctx2d = null;
    this.gl = null;
    this.atlasCanvas = null;
    this.atlasTex = null;

    // 3D Camera State (Chase POV default for stable 3D flight!)
    this.cam = {
      mode: 'chase_3d',
      eye: [this.width * 0.5, this.height * 0.5 + 240, 180],
      target: [this.width * 0.5, this.height * 0.5 - 260, 40],
      right: [1, 0, 0],
      camUp: [0, 0, 1],
      forward: [0, -1, 0],
      fovY: (54 * Math.PI) / 180,
      f: 1 / Math.tan((27 * Math.PI) / 180),
      aspect: this.width / Math.max(1, this.height),
      near: 6,
      far: 6500,
      viewProj: new Float32Array(16)
    };
    this.defaultZ = 55;

    // 3D Solid Shaded Mesh Buffer: x,y,z, nx,ny,nz, r,g,b,a (10 floats/vert)
    this.maxSolidVerts = 36000;
    this.solidFloatsPerVert = 10;
    this.solidData = new Float32Array(this.maxSolidVerts * this.solidFloatsPerVert);
    this.solidVertCount = 0;

    // 3D Line Quad Buffer: x0,y0,z0, x1,y1,z1, side, r,g,b,a, u,v (13 floats/vert)
    this.maxLineVerts = 190000;
    this.lineFloatsPerVert = 13;
    this.lineData = new Float32Array(this.maxLineVerts * this.lineFloatsPerVert);
    this.lineVertCount = 0;

    // 3D Instanced Sprite Buffer: 20 floats/instance
    this.maxSprites = 4096;
    this.spriteFloats = 20;
    this.alphaSpriteData = new Float32Array(this.maxSprites * this.spriteFloats);
    this.alphaSpriteCount = 0;
    this.addSpriteData = new Float32Array(this.maxSprites * this.spriteFloats);
    this.addSpriteCount = 0;

    // 3D Instanced Particle Buffer: 12 floats/instance
    this.maxParticles = 16384;
    this.particleFloats = 12;
    this.particleData = new Float32Array(this.maxParticles * this.particleFloats);
    this.particleCount = 0;

    this.singularities = [];
    this.shockwaves = [];
    this.drawCalls = 0;

    this._initContext();
    this.resize(this.width, this.height);
    this.updateCamera('tactical_3d', null, this.width, this.height, 1);
  }

  _initContext() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    if (!gl) {
      this._enableFallback();
      return;
    }

    this.gl = gl;

    try {
      this.solidProg = this._createProgram(SOLID_VS, SOLID_FS);
      this.lineProg = this._createProgram(LINE_VS, LINE_FS);
      this.spriteProg = this._createProgram(SPRITE_VS, SPRITE_FS);
      this.particleProg = this._createProgram(PARTICLE_VS, PARTICLE_FS);
      this.bloomProg = this._createProgram(FULLSCREEN_VS, BLOOM_EXTRACT_BLUR_FS, { aPos: 0 });
      this.compositeProg = this._createProgram(FULLSCREEN_VS, COMPOSITE_FS, { aPos: 0 });

      this._setupGeometry();
      this._setupFramebuffers();
    } catch (err) {
      console.warn('WebGL2 3D shader setup failed, switching to 2D fallback:', err);
      this._enableFallback();
    }
  }

  _enableFallback() {
    this.fallback2D = true;
    this.gl = null;
    this.ctx2d = this.canvas.getContext('2d');
  }

  _compileShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  _createProgram(vsSrc, fsSrc, attribBindings = null) {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    if (attribBindings) {
      for (const [name, loc] of Object.entries(attribBindings)) {
        gl.bindAttribLocation(prog, loc, name);
      }
    }
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  _setupGeometry() {
    const gl = this.gl;

    // 0. 3D Solid Mesh VAO
    this.solidVao = gl.createVertexArray();
    this.solidVbo = gl.createBuffer();
    gl.bindVertexArray(this.solidVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.solidData.byteLength, gl.DYNAMIC_DRAW);

    const sMeshStride = this.solidFloatsPerVert * 4;
    const locSPos = gl.getAttribLocation(this.solidProg, 'aPos');
    const locSNorm = gl.getAttribLocation(this.solidProg, 'aNormal');
    const locSColor = gl.getAttribLocation(this.solidProg, 'aColor');
    gl.enableVertexAttribArray(locSPos);
    gl.vertexAttribPointer(locSPos, 3, gl.FLOAT, false, sMeshStride, 0);
    gl.enableVertexAttribArray(locSNorm);
    gl.vertexAttribPointer(locSNorm, 3, gl.FLOAT, false, sMeshStride, 12);
    gl.enableVertexAttribArray(locSColor);
    gl.vertexAttribPointer(locSColor, 4, gl.FLOAT, false, sMeshStride, 24);

    // 1. 3D Line Quad VAO
    this.lineVao = gl.createVertexArray();
    this.lineVbo = gl.createBuffer();
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);

    const stride = this.lineFloatsPerVert * 4;
    const locPos = gl.getAttribLocation(this.lineProg, 'aPos');
    const locOther = gl.getAttribLocation(this.lineProg, 'aOther');
    const locSide = gl.getAttribLocation(this.lineProg, 'aSide');
    const locCol = gl.getAttribLocation(this.lineProg, 'aColor');
    const locUv = gl.getAttribLocation(this.lineProg, 'aUv');

    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(locOther);
    gl.vertexAttribPointer(locOther, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(locSide);
    gl.vertexAttribPointer(locSide, 1, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(locCol);
    gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, stride, 28);
    gl.enableVertexAttribArray(locUv);
    gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, stride, 44);

    // 2. 3D Instanced Sprite VAO
    this.spriteVao = gl.createVertexArray();
    gl.bindVertexArray(this.spriteVao);

    const spriteQuad = new Float32Array([
      -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5
    ]);
    this.spriteQuadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, spriteQuad, gl.STATIC_DRAW);
    const locSQuad = gl.getAttribLocation(this.spriteProg, 'aQuad');
    gl.enableVertexAttribArray(locSQuad);
    gl.vertexAttribPointer(locSQuad, 2, gl.FLOAT, false, 0, 0);

    this.spriteInstVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.alphaSpriteData.byteLength, gl.DYNAMIC_DRAW);
    const sStride = this.spriteFloats * 4;

    const locPosYaw = gl.getAttribLocation(this.spriteProg, 'iPosYaw');
    const locSizePB = gl.getAttribLocation(this.spriteProg, 'iSizePitchBank');
    const locUvR = gl.getAttribLocation(this.spriteProg, 'iUvRect');
    const locSCol = gl.getAttribLocation(this.spriteProg, 'iColor');
    const locSMeta = gl.getAttribLocation(this.spriteProg, 'iMeta');

    [
      [locPosYaw, 0],
      [locSizePB, 16],
      [locUvR, 32],
      [locSCol, 48],
      [locSMeta, 64]
    ].forEach(([loc, offset]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, sStride, offset);
      gl.vertexAttribDivisor(loc, 1);
    });

    // 3. 3D Instanced Particle VAO
    this.particleVao = gl.createVertexArray();
    gl.bindVertexArray(this.particleVao);

    const quadVerts = new Float32Array([
      -1, -1, 1, -1, 1, 1,
      -1, -1, 1, 1, -1, 1
    ]);
    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    const locQuad = gl.getAttribLocation(this.particleProg, 'aQuad');
    gl.enableVertexAttribArray(locQuad);
    gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);

    this.particleVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData.byteLength, gl.DYNAMIC_DRAW);
    const pStride = this.particleFloats * 4;

    const locIPos = gl.getAttribLocation(this.particleProg, 'iPosSize');
    const locIVel = gl.getAttribLocation(this.particleProg, 'iVelStretch');
    const locICol = gl.getAttribLocation(this.particleProg, 'iColor');

    gl.enableVertexAttribArray(locIPos);
    gl.vertexAttribPointer(locIPos, 4, gl.FLOAT, false, pStride, 0);
    gl.vertexAttribDivisor(locIPos, 1);

    gl.enableVertexAttribArray(locIVel);
    gl.vertexAttribPointer(locIVel, 4, gl.FLOAT, false, pStride, 16);
    gl.vertexAttribDivisor(locIVel, 1);

    gl.enableVertexAttribArray(locICol);
    gl.vertexAttribPointer(locICol, 4, gl.FLOAT, false, pStride, 32);
    gl.vertexAttribDivisor(locICol, 1);

    // 4. Fullscreen Quad VAO
    this.fsVao = gl.createVertexArray();
    this.fsVbo = gl.createBuffer();
    gl.bindVertexArray(this.fsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const locFsPos = gl.getAttribLocation(this.compositeProg, 'aPos');
    gl.enableVertexAttribArray(locFsPos);
    gl.vertexAttribPointer(locFsPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  updateCamera(mode, player, width, height, dt = 0.016) {
    this.cam.mode = mode;
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const aspect = w / h;
    this.cam.aspect = aspect;

    const halfH = h * 0.5;
    const baseDist = halfH / Math.tan(this.cam.fovY * 0.5);

    let desiredEye;
    let desiredTarget;
    let upHint;
    let rollAngle = 0;

    const px = player ? player.x : w * 0.5;
    const py = player ? player.y : h * 0.55;
    const pz = player ? (player.z || 55) : 55;
    // IMPORTANT: Camera follows stable flight heading (not mouse-aim gimbal) so zero spin feedback loop!
    const hAng = player ? (player.heading ?? player.angle ?? -Math.PI * 0.5) : -Math.PI * 0.5;

    if (mode === 'chase_3d' && player) {
      const ch = Math.cos(hAng);
      const sh = Math.sin(hAng);
      desiredEye = [px - ch * 225, py - sh * 225, pz + 96];
      desiredTarget = [px + ch * 320, py + sh * 320, pz * 0.45];
      upHint = [0, 0, 1];
      rollAngle = (player.bank || 0) * 0.14;
    } else if (mode === 'cockpit_3d' && player) {
      const ch = Math.cos(hAng);
      const sh = Math.sin(hAng);
      desiredEye = [px + ch * 14, py + sh * 14, pz + 16];
      desiredTarget = [px + ch * 480, py + sh * 480, pz - 18];
      upHint = [0, 0, 1];
      rollAngle = (player.bank || 0) * 0.18;
    } else if (mode === 'topdown_25d') {
      desiredEye = [w * 0.5, h * 0.5 + 12, baseDist * 1.02];
      desiredTarget = [w * 0.5, h * 0.5, 18];
      upHint = [0, -1, 0];
    } else {
      // tactical_3d (Default on menu; angled 3D diorama)
      const followX = (px - w * 0.5) * 0.12;
      const followY = (py - h * 0.5) * 0.10;
      desiredEye = [w * 0.5 + followX, h * 0.5 + followY + baseDist * 0.46, baseDist * 0.88];
      desiredTarget = [w * 0.5 + followX * 0.65, h * 0.5 + followY * 0.65 - 24, 18];
      upHint = [0, -1, 0];
    }

    const lerpRate = Math.min(1, dt * (mode === 'cockpit_3d' ? 14.0 : 8.5));
    for (let i = 0; i < 3; i++) {
      this.cam.eye[i] += (desiredEye[i] - this.cam.eye[i]) * lerpRate;
      this.cam.target[i] += (desiredTarget[i] - this.cam.target[i]) * lerpRate;
    }

    const forward = norm3([
      this.cam.target[0] - this.cam.eye[0],
      this.cam.target[1] - this.cam.eye[1],
      this.cam.target[2] - this.cam.eye[2]
    ]);
    let right = cross3(upHint, forward);
    if (Math.hypot(right[0], right[1], right[2]) < 0.001) {
      right = [1, 0, 0];
    } else {
      right = norm3(right);
    }
    let camUp = norm3(cross3(forward, right));

    // Apply subtle horizon roll tilt in 3D POV modes
    if (Math.abs(rollAngle) > 0.001) {
      const cr = Math.cos(rollAngle), sr = Math.sin(rollAngle);
      const r2 = [
        right[0] * cr - camUp[0] * sr,
        right[1] * cr - camUp[1] * sr,
        right[2] * cr - camUp[2] * sr
      ];
      const u2 = [
        right[0] * sr + camUp[0] * cr,
        right[1] * sr + camUp[1] * cr,
        right[2] * sr + camUp[2] * cr
      ];
      right = norm3(r2);
      camUp = norm3(u2);
    }

    this.cam.forward = forward;
    this.cam.right = right;
    this.cam.camUp = camUp;

    const f = this.cam.f;
    const sx = f / aspect;
    const sy = f;
    const near = this.cam.near;
    const far = this.cam.far;
    const a = (far + near) / (far - near);
    const b = (-2 * far * near) / (far - near);

    const ex = dot3(this.cam.eye, right);
    const ey = dot3(this.cam.eye, camUp);
    const ez = dot3(this.cam.eye, forward);

    const m = this.cam.viewProj;
    m[0] = sx * right[0];   m[4] = sx * right[1];   m[8] = sx * right[2];    m[12] = -sx * ex;
    m[1] = sy * camUp[0];   m[5] = sy * camUp[1];   m[9] = sy * camUp[2];    m[13] = -sy * ey;
    m[2] = a * forward[0];  m[6] = a * forward[1];  m[10] = a * forward[2];  m[14] = -a * ez + b;
    m[3] = forward[0];      m[7] = forward[1];      m[11] = forward[2];      m[15] = -ez;
  }

  worldToScreen(wx, wy, wz = 0) {
    const { eye, right, camUp, forward, f, aspect } = this.cam;
    const dx = wx - eye[0];
    const dy = wy - eye[1];
    const dz = wz - eye[2];
    const cx = dx * right[0] + dy * right[1] + dz * right[2];
    const cy = dx * camUp[0] + dy * camUp[1] + dz * camUp[2];
    const cz = dx * forward[0] + dy * forward[1] + dz * forward[2];
    if (cz <= 4) {
      return { visible: false, x: -999, y: -999, scale: 0, cz };
    }
    const ndcX = (cx / cz) * (f / aspect);
    const ndcY = (cy / cz) * f;
    return {
      visible: true,
      x: (ndcX * 0.5 + 0.5) * this.width,
      y: (0.5 - ndcY * 0.5) * this.height,
      scale: (f * this.height * 0.5) / cz,
      cz
    };
  }

  screenToWorldPlane(screenX, screenY, planeZ = 55) {
    const { eye, right, camUp, forward, f, aspect } = this.cam;
    const ndcX = (screenX / Math.max(1, this.width)) * 2 - 1;
    const ndcY = 1 - (screenY / Math.max(1, this.height)) * 2;
    const rx = ndcX * (aspect / f);
    const ry = ndcY / f;
    const dir = norm3([
      forward[0] + right[0] * rx + camUp[0] * ry,
      forward[1] + right[1] * rx + camUp[1] * ry,
      forward[2] + right[2] * rx + camUp[2] * ry
    ]);

    if (dir[2] < -0.04) {
      const hitT = (planeZ - eye[2]) / dir[2];
      if (hitT > 20 && hitT < 1800) {
        return {
          x: eye[0] + dir[0] * hitT,
          y: eye[1] + dir[1] * hitT,
          z: planeZ
        };
      }
    }
    // Near/above horizon in 3D POV: project forward along ray onto flight plane
    const t = 650;
    return {
      x: eye[0] + dir[0] * t,
      y: eye[1] + dir[1] * t,
      z: planeZ
    };
  }

  setSpriteAtlas(canvasOrImage) {
    this.atlasCanvas = canvasOrImage;
    if (this.fallback2D || !this.gl) return;
    const gl = this.gl;
    if (!this.atlasTex) {
      this.atlasTex = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImage);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  _createFBO(w, h, withDepth = false) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let depthRb = null;
    if (withDepth) {
      depthRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, depthRb, w, h };
  }

  _setupFramebuffers() {
    const rw = Math.max(2, Math.floor(this.width * this.dpr));
    const rh = Math.max(2, Math.floor(this.height * this.dpr));
    const bw = Math.max(2, Math.floor(rw * 0.5));
    const bh = Math.max(2, Math.floor(rh * 0.5));

    this._destroyFramebuffers();
    this.sceneFBO = this._createFBO(rw, rh, true);
    this.bloomFBO1 = this._createFBO(bw, bh, false);
    this.bloomFBO2 = this._createFBO(bw, bh, false);
  }

  _destroyFramebuffers() {
    if (!this.gl) return;
    const gl = this.gl;
    [this.sceneFBO, this.bloomFBO1, this.bloomFBO2].forEach(obj => {
      if (obj) {
        gl.deleteFramebuffer(obj.fbo);
        gl.deleteTexture(obj.tex);
        if (obj.depthRb) gl.deleteRenderbuffer(obj.depthRb);
      }
    });
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    if (!this.fallback2D && this.gl) {
      this._setupFramebuffers();
    }
  }

  beginFrame(arMode = 'off') {
    this.solidVertCount = 0;
    this.lineVertCount = 0;
    this.alphaSpriteCount = 0;
    this.addSpriteCount = 0;
    this.particleCount = 0;
    this.singularities.length = 0;
    this.shockwaves.length = 0;
    this.drawCalls = 0;
    this.arMode = arMode;

    if (this.fallback2D && this.ctx2d) {
      const ctx = this.ctx2d;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      if (arMode === 'camera') {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = arMode === 'synthetic' ? '#04120c' : '#03040a';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.globalCompositeOperation = 'lighter';
      return;
    }

    if (this.gl && this.sceneFBO) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo);
      gl.viewport(0, 0, this.sceneFBO.w, this.sceneFBO.h);
      if (arMode === 'camera') {
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
      } else if (arMode === 'synthetic') {
        gl.clearColor(0.01, 0.045, 0.025, 1.0);
      } else {
        gl.clearColor(0.012, 0.016, 0.042, 1.0);
      }
      gl.clearDepth(1.0);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
    }
  }

  _pushSolidVertex(x, y, z, nx, ny, nz, r, g, b, a) {
    const idx = this.solidVertCount * this.solidFloatsPerVert;
    const d = this.solidData;
    d[idx] = x; d[idx + 1] = y; d[idx + 2] = z;
    d[idx + 3] = nx; d[idx + 4] = ny; d[idx + 5] = nz;
    d[idx + 6] = r; d[idx + 7] = g; d[idx + 8] = b; d[idx + 9] = a;
    this.solidVertCount++;
  }

  drawSolidQuad3D(p0, p1, p2, p3, nx, ny, nz, r, g, b, a = 0.94) {
    if (this.fallback2D) return;
    if (this.solidVertCount + 6 > this.maxSolidVerts) {
      this._flushSolids();
    }
    this._pushSolidVertex(p0[0], p0[1], p0[2], nx, ny, nz, r, g, b, a);
    this._pushSolidVertex(p1[0], p1[1], p1[2], nx, ny, nz, r, g, b, a);
    this._pushSolidVertex(p2[0], p2[1], p2[2], nx, ny, nz, r, g, b, a);
    this._pushSolidVertex(p0[0], p0[1], p0[2], nx, ny, nz, r, g, b, a);
    this._pushSolidVertex(p2[0], p2[1], p2[2], nx, ny, nz, r, g, b, a);
    this._pushSolidVertex(p3[0], p3[1], p3[2], nx, ny, nz, r, g, b, a);
  }

  drawSolidBox3D(cx, cy, baseZ, w, d, h, r, g, b, a = 0.92, wr = r, wg = g, wb = b, wa = 0.85) {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const topZ = baseZ + h;
    const x0 = cx - hw, x1 = cx + hw;
    const y0 = cy - hd, y1 = cy + hd;

    // 4 Side Walls + Roof Face
    this.drawSolidQuad3D([x0, y1, baseZ], [x1, y1, baseZ], [x1, y1, topZ], [x0, y1, topZ], 0, 1, 0, r, g, b, a);
    this.drawSolidQuad3D([x1, y0, baseZ], [x0, y0, baseZ], [x0, y0, topZ], [x1, y0, topZ], 0, -1, 0, r, g, b, a);
    this.drawSolidQuad3D([x1, y1, baseZ], [x1, y0, baseZ], [x1, y0, topZ], [x1, y1, topZ], 1, 0, 0, r, g, b, a);
    this.drawSolidQuad3D([x0, y0, baseZ], [x0, y1, baseZ], [x0, y1, topZ], [x0, y0, topZ], -1, 0, 0, r, g, b, a);
    this.drawSolidQuad3D([x0, y0, topZ], [x1, y0, topZ], [x1, y1, topZ], [x0, y1, topZ], 0, 0, 1, r * 1.25, g * 1.25, b * 1.25, a);

    // Bright LiDAR Neon Edge Outlines
    this.drawBox3D(cx, cy, baseZ, w, d, h, wr, wg, wb, wa, 2.0);
  }

  _pushLineVertex3D(x, y, z, ox, oy, oz, side, r, g, b, a, u, v) {
    const idx = this.lineVertCount * this.lineFloatsPerVert;
    const d = this.lineData;
    d[idx] = x; d[idx + 1] = y; d[idx + 2] = z;
    d[idx + 3] = ox; d[idx + 4] = oy; d[idx + 5] = oz;
    d[idx + 6] = side;
    d[idx + 7] = r; d[idx + 8] = g; d[idx + 9] = b; d[idx + 10] = a;
    d[idx + 11] = u; d[idx + 12] = v;
    this.lineVertCount++;
  }

  drawLine3D(x1, y1, z1, x2, y2, z2, r, g, b, a = 1, thickness = 2) {
    if (this.fallback2D && this.ctx2d) {
      const p1 = this.worldToScreen(x1, y1, z1);
      const p2 = this.worldToScreen(x2, y2, z2);
      if (!p1.visible || !p2.visible) return;
      const ctx = this.ctx2d;
      ctx.strokeStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      return;
    }

    if (this.lineVertCount + 6 > this.maxLineVerts) {
      this._flushLines();
    }

    const s = Math.max(0.8, thickness * 0.9);
    this._pushLineVertex3D(x1, y1, z1, x2, y2, z2, -s, r, g, b, a, 0, -1);
    this._pushLineVertex3D(x1, y1, z1, x2, y2, z2, s, r, g, b, a, 0, 1);
    this._pushLineVertex3D(x2, y2, z2, x1, y1, z1, -s, r, g, b, a, 1, 1);

    this._pushLineVertex3D(x1, y1, z1, x2, y2, z2, -s, r, g, b, a, 0, -1);
    this._pushLineVertex3D(x2, y2, z2, x1, y1, z1, -s, r, g, b, a, 1, 1);
    this._pushLineVertex3D(x2, y2, z2, x1, y1, z1, s, r, g, b, a, 1, -1);
  }

  drawLine(x1, y1, x2, y2, r, g, b, a = 1, thickness = 2, z1 = this.defaultZ, z2 = z1) {
    this.drawLine3D(x1, y1, z1, x2, y2, z2, r, g, b, a, thickness);
  }

  drawPoly(points, r, g, b, a = 1, closed = true, thickness = 2.2, defaultZ = this.defaultZ) {
    const n = points.length;
    if (n < 2) return;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      this.drawLine3D(
        p0.x, p0.y, p0.z ?? defaultZ,
        p1.x, p1.y, p1.z ?? defaultZ,
        r, g, b, a, thickness
      );
    }
    if (closed && n > 2) {
      const pLast = points[n - 1];
      const pFirst = points[0];
      this.drawLine3D(
        pLast.x, pLast.y, pLast.z ?? defaultZ,
        pFirst.x, pFirst.y, pFirst.z ?? defaultZ,
        r, g, b, a, thickness
      );
    }
  }

  drawCircle3D(x, y, z, radius, r, g, b, a = 1, segments = 24, thickness = 2) {
    const step = (Math.PI * 2) / segments;
    let px = x + radius;
    let py = y;
    for (let i = 1; i <= segments; i++) {
      const ang = i * step;
      const nx = x + Math.cos(ang) * radius;
      const ny = y + Math.sin(ang) * radius;
      this.drawLine3D(px, py, z, nx, ny, z, r, g, b, a, thickness);
      px = nx;
      py = ny;
    }
  }

  drawCircle(x, y, radius, r, g, b, a = 1, segments = 24, thickness = 2, z = this.defaultZ) {
    this.drawCircle3D(x, y, z, radius, r, g, b, a, segments, thickness);
  }

  drawArc(x, y, radius, startAng, endAng, r, g, b, a = 1, segments = 16, thickness = 2.5, z = this.defaultZ) {
    const span = endAng - startAng;
    let px = x + Math.cos(startAng) * radius;
    let py = y + Math.sin(startAng) * radius;
    for (let i = 1; i <= segments; i++) {
      const ang = startAng + (span * i) / segments;
      const nx = x + Math.cos(ang) * radius;
      const ny = y + Math.sin(ang) * radius;
      this.drawLine3D(px, py, z, nx, ny, z, r, g, b, a, thickness);
      px = nx;
      py = ny;
    }
  }

  drawBox3D(cx, cy, baseZ, w, d, h, r, g, b, a = 0.7, thickness = 1.5) {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const topZ = baseZ + h;
    const x0 = cx - hw, x1 = cx + hw;
    const y0 = cy - hd, y1 = cy + hd;

    this.drawLine3D(x0, y0, baseZ, x1, y0, baseZ, r, g, b, a * 0.55, thickness);
    this.drawLine3D(x1, y0, baseZ, x1, y1, baseZ, r, g, b, a * 0.55, thickness);
    this.drawLine3D(x1, y1, baseZ, x0, y1, baseZ, r, g, b, a * 0.55, thickness);
    this.drawLine3D(x0, y1, baseZ, x0, y0, baseZ, r, g, b, a * 0.55, thickness);

    this.drawLine3D(x0, y0, topZ, x1, y0, topZ, r, g, b, a, thickness * 1.25);
    this.drawLine3D(x1, y0, topZ, x1, y1, topZ, r, g, b, a, thickness * 1.25);
    this.drawLine3D(x1, y1, topZ, x0, y1, topZ, r, g, b, a, thickness * 1.25);
    this.drawLine3D(x0, y1, topZ, x0, y0, topZ, r, g, b, a, thickness * 1.25);

    this.drawLine3D(x0, y0, baseZ, x0, y0, topZ, r, g, b, a * 0.85, thickness);
    this.drawLine3D(x1, y0, baseZ, x1, y0, topZ, r, g, b, a * 0.85, thickness);
    this.drawLine3D(x1, y1, baseZ, x1, y1, topZ, r, g, b, a * 0.85, thickness);
    this.drawLine3D(x0, y1, baseZ, x0, y1, topZ, r, g, b, a * 0.85, thickness);
  }

  drawSprite3D(
    spriteDef,
    x, y, z,
    width, height,
    yaw = 0,
    pitch = 0,
    bank = 0,
    r = 1, g = 1, b = 1, a = 1,
    hitFlash = 0,
    additive = false,
    emissiveBoost = 0.65,
    billboard = false
  ) {
    if (!spriteDef) return;

    if (this.fallback2D && this.ctx2d && this.atlasCanvas) {
      const p = this.worldToScreen(x, y, z);
      if (!p.visible) return;
      const ctx = this.ctx2d;
      ctx.save();
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(yaw + Math.PI * 0.5);
      ctx.scale(p.scale * (1 - Math.abs(bank) * 0.16), p.scale);
      ctx.drawImage(
        this.atlasCanvas,
        spriteDef.px, spriteDef.py, spriteDef.pw, spriteDef.ph,
        -width * 0.5, -height * 0.5, width, height
      );
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      return;
    }

    if (additive) {
      if (this.addSpriteCount >= this.maxSprites) this._flushSprites(true);
      const idx = this.addSpriteCount * this.spriteFloats;
      const d = this.addSpriteData;
      d[idx] = x; d[idx + 1] = y; d[idx + 2] = z; d[idx + 3] = yaw;
      d[idx + 4] = width; d[idx + 5] = height; d[idx + 6] = pitch; d[idx + 7] = bank;
      d[idx + 8] = spriteDef.u0; d[idx + 9] = spriteDef.v0; d[idx + 10] = spriteDef.u1; d[idx + 11] = spriteDef.v1;
      d[idx + 12] = r; d[idx + 13] = g; d[idx + 14] = b; d[idx + 15] = a;
      d[idx + 16] = hitFlash; d[idx + 17] = emissiveBoost; d[idx + 18] = billboard ? 1.0 : 0.0; d[idx + 19] = 0;
      this.addSpriteCount++;
    } else {
      if (this.alphaSpriteCount >= this.maxSprites) this._flushSprites(false);
      const idx = this.alphaSpriteCount * this.spriteFloats;
      const d = this.alphaSpriteData;
      d[idx] = x; d[idx + 1] = y; d[idx + 2] = z; d[idx + 3] = yaw;
      d[idx + 4] = width; d[idx + 5] = height; d[idx + 6] = pitch; d[idx + 7] = bank;
      d[idx + 8] = spriteDef.u0; d[idx + 9] = spriteDef.v0; d[idx + 10] = spriteDef.u1; d[idx + 11] = spriteDef.v1;
      d[idx + 12] = r; d[idx + 13] = g; d[idx + 14] = b; d[idx + 15] = a;
      d[idx + 16] = hitFlash; d[idx + 17] = emissiveBoost; d[idx + 18] = billboard ? 1.0 : 0.0; d[idx + 19] = 0;
      this.alphaSpriteCount++;
    }
  }

  drawSprite(spriteDef, x, y, width, height, rotation = 0, r = 1, g = 1, b = 1, a = 1, hitFlash = 0, additive = false, bankTilt = 0, emissiveBoost = 0.55) {
    this.drawSprite3D(spriteDef, x, y, this.defaultZ, width, height, rotation - Math.PI * 0.5, 0, bankTilt, r, g, b, a, hitFlash, additive, emissiveBoost, false);
  }

  drawParticle3D(x, y, z, size, r, g, b, a = 1, vx = 0, vy = 0, vz = 0, stretch = 0.03) {
    if (this.fallback2D && this.ctx2d) {
      const p = this.worldToScreen(x, y, z);
      if (!p.visible) return;
      const ctx = this.ctx2d;
      ctx.fillStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, size * 0.5 * p.scale), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (this.particleCount >= this.maxParticles) {
      this._flushParticles();
    }

    const idx = this.particleCount * this.particleFloats;
    const d = this.particleData;
    d[idx] = x; d[idx + 1] = y; d[idx + 2] = z; d[idx + 3] = size;
    d[idx + 4] = vx; d[idx + 5] = vy; d[idx + 6] = vz; d[idx + 7] = stretch;
    d[idx + 8] = r; d[idx + 9] = g; d[idx + 10] = b; d[idx + 11] = a;
    this.particleCount++;
  }

  drawParticle(x, y, size, r, g, b, a = 1, vx = 0, vy = 0, stretch = 0.03, z = this.defaultZ) {
    this.drawParticle3D(x, y, z, size, r, g, b, a, vx, vy, 0, stretch);
  }

  draw3DWireframe(vertices3D, edges, x, y, scale, rotX, rotY, rotZ, r, g, b, a = 1, thickness = 2.2, z = this.defaultZ) {
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

    const pts = new Array(vertices3D.length);
    for (let i = 0; i < vertices3D.length; i++) {
      const v = vertices3D[i];
      const y1 = v[1] * cx - v[2] * sx;
      const z1 = v[1] * sx + v[2] * cx;
      const x2 = v[0] * cy + z1 * sy;
      const z2 = -v[0] * sy + z1 * cy;
      const x3 = x2 * cz - y1 * sz;
      const y3 = x2 * sz + y1 * cz;

      pts[i] = {
        x: x + x3 * scale,
        y: y + y3 * scale,
        z: z + z2 * scale
      };
    }

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const p1 = pts[e[0]];
      const p2 = pts[e[1]];
      this.drawLine3D(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, r, g, b, a, thickness);
    }
  }

  addSingularityUniform(wx, wy, wz, radiusWorld, strength) {
    if (this.singularities.length >= 8) return;
    const p = this.worldToScreen(wx, wy, wz);
    if (!p.visible) return;
    this.singularities.push({
      xUv: p.x / this.width,
      yUv: 1.0 - p.y / this.height,
      radUv: (radiusWorld * p.scale) / this.height,
      strength
    });
  }

  addShockwaveUniform(wx, wy, wz, radiusWorld, thicknessWorld) {
    if (this.shockwaves.length >= 8) return;
    const p = this.worldToScreen(wx, wy, wz);
    if (!p.visible) return;
    this.shockwaves.push({
      xUv: p.x / this.width,
      yUv: 1.0 - p.y / this.height,
      radUv: (radiusWorld * p.scale) / this.height,
      thickUv: (thicknessWorld * p.scale) / this.height
    });
  }

  flushLayer() {
    if (this.fallback2D || !this.gl) return;
    this._flushSolids();
    this._flushLines();
    this._flushSprites(false);
    this._flushSprites(true);
    this._flushParticles();
  }

  _flushSolids() {
    if (this.solidVertCount === 0 || !this.gl) return;
    const gl = this.gl;
    gl.depthMask(true);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 2.0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.solidProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.solidProg, 'uViewProj'), false, this.cam.viewProj);
    gl.bindVertexArray(this.solidVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.solidData.subarray(0, this.solidVertCount * this.solidFloatsPerVert));
    gl.drawArrays(gl.TRIANGLES, 0, this.solidVertCount);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.drawCalls++;
    this.solidVertCount = 0;
  }

  _flushLines() {
    if (this.lineVertCount === 0 || !this.gl) return;
    const gl = this.gl;
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.lineProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProg, 'uViewProj'), false, this.cam.viewProj);
    gl.uniform2f(gl.getUniformLocation(this.lineProg, 'uResolution'), this.width, this.height);
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData.subarray(0, this.lineVertCount * this.lineFloatsPerVert));
    gl.drawArrays(gl.TRIANGLES, 0, this.lineVertCount);
    this.drawCalls++;
    this.lineVertCount = 0;
  }

  _flushSprites(additive) {
    const count = additive ? this.addSpriteCount : this.alphaSpriteCount;
    if (count === 0 || !this.gl || !this.atlasTex) return;
    const gl = this.gl;
    const buf = additive ? this.addSpriteData : this.alphaSpriteData;

    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.spriteProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.spriteProg, 'uViewProj'), false, this.cam.viewProj);
    gl.uniform3fv(gl.getUniformLocation(this.spriteProg, 'uCamRight'), this.cam.right);
    gl.uniform3fv(gl.getUniformLocation(this.spriteProg, 'uCamUp'), this.cam.camUp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(gl.getUniformLocation(this.spriteProg, 'uAtlas'), 0);

    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, count * this.spriteFloats));
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    this.drawCalls++;

    if (additive) this.addSpriteCount = 0;
    else this.alphaSpriteCount = 0;
  }

  _flushParticles() {
    if (this.particleCount === 0 || !this.gl) return;
    const gl = this.gl;
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.particleProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.particleProg, 'uViewProj'), false, this.cam.viewProj);
    gl.uniform3fv(gl.getUniformLocation(this.particleProg, 'uCamRight'), this.cam.right);
    gl.uniform3fv(gl.getUniformLocation(this.particleProg, 'uCamUp'), this.cam.camUp);
    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particleData.subarray(0, this.particleCount * this.particleFloats));
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.particleCount);
    this.drawCalls++;
    this.particleCount = 0;
  }

  endFrame({
    time = 0,
    bloomIntensity = 1.25,
    aberration = 1.0,
    lensingStrength = 1.2,
    chronoShift = 0,
    shakeX = 0,
    shakeY = 0
  } = {}) {
    if (this.fallback2D || !this.gl) return;

    const gl = this.gl;
    this.flushLayer();
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.useProgram(this.bloomProg);
    gl.bindVertexArray(this.fsVao);
    const uTex = gl.getUniformLocation(this.bloomProg, 'uTex');
    const uTexel = gl.getUniformLocation(this.bloomProg, 'uTexelSize');
    const uDir = gl.getUniformLocation(this.bloomProg, 'uDirection');
    const uExt = gl.getUniformLocation(this.bloomProg, 'uExtract');
    const uThresh = gl.getUniformLocation(this.bloomProg, 'uThreshold');

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO1.fbo);
    gl.viewport(0, 0, this.bloomFBO1.w, this.bloomFBO1.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
    gl.uniform1i(uTex, 0);
    gl.uniform2f(uTexel, 1 / this.bloomFBO1.w, 1 / this.bloomFBO1.h);
    gl.uniform2f(uDir, 1.2, 0.0);
    gl.uniform1f(uExt, 1.0);
    gl.uniform1f(uThresh, 0.24);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO2.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO1.tex);
    gl.uniform2f(uDir, 0.0, 1.2);
    gl.uniform1f(uExt, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO1.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO2.tex);
    gl.uniform2f(uDir, 2.2, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO2.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO1.tex);
    gl.uniform2f(uDir, 0.0, 2.2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.useProgram(this.compositeProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
    gl.uniform1i(gl.getUniformLocation(this.compositeProg, 'uSceneTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO2.tex);
    gl.uniform1i(gl.getUniformLocation(this.compositeProg, 'uBloomTex'), 1);

    gl.uniform2f(gl.getUniformLocation(this.compositeProg, 'uResolution'), this.width, this.height);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uBloomIntensity'), bloomIntensity);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uAberration'), aberration);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uLensingStrength'), lensingStrength);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uChronoShift'), chronoShift);
    gl.uniform1f(gl.getUniformLocation(this.compositeProg, 'uArTransparent'), this.arMode === 'camera' ? 1.0 : 0.0);
    gl.uniform2f(
      gl.getUniformLocation(this.compositeProg, 'uShakeOffset'),
      shakeX / this.width,
      -shakeY / this.height
    );

    const sData = new Float32Array(32);
    for (let i = 0; i < this.singularities.length; i++) {
      const s = this.singularities[i];
      sData[i * 4] = s.xUv;
      sData[i * 4 + 1] = s.yUv;
      sData[i * 4 + 2] = s.radUv;
      sData[i * 4 + 3] = s.strength;
    }
    gl.uniform4fv(gl.getUniformLocation(this.compositeProg, 'uSingularities'), sData);
    gl.uniform1i(gl.getUniformLocation(this.compositeProg, 'uNumSingularities'), this.singularities.length);

    const wData = new Float32Array(32);
    for (let i = 0; i < this.shockwaves.length; i++) {
      const w = this.shockwaves[i];
      wData[i * 4] = w.xUv;
      wData[i * 4 + 1] = w.yUv;
      wData[i * 4 + 2] = w.radUv;
      wData[i * 4 + 3] = w.thickUv;
    }
    gl.uniform4fv(gl.getUniformLocation(this.compositeProg, 'uShockwaves'), wData);
    gl.uniform1i(gl.getUniformLocation(this.compositeProg, 'uNumShockwaves'), this.shockwaves.length);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    this.drawCalls += 5;
  }
}
