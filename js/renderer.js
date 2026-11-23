// WebGL2 Multi-Pass HDR Post-Processing, Textured Aircraft Sprite Pass & Particle Batch Renderer
// Gracefully falls back to Canvas 2D rendering if WebGL2 is unavailable.

const LINE_VS = `#version 300 es
precision highp float;
in vec2 aPos;
in vec4 aColor;
in vec2 aUv;
uniform vec2 uResolution;
out vec4 vColor;
out vec2 vUv;
void main() {
  vec2 ndc = (aPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
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
in vec4 iPosRot;        // x, y, rotation, bankTilt
in vec4 iSizeFlash;     // w, h, hitFlash, emissiveBoost
in vec4 iUvRect;        // u0, v0, u1, v1
in vec4 iColor;         // r, g, b, a
uniform vec2 uResolution;
out vec2 vUv;
out vec4 vColor;
out float vHitFlash;
out float vEmissive;
void main() {
  vec2 local = aQuad * iSizeFlash.xy;
  local.x *= 1.0 - abs(iPosRot.w) * 0.14;
  float c = cos(iPosRot.z);
  float s = sin(iPosRot.z);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 world = iPosRot.xy + rotated;
  vec2 ndc = (world / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);

  vec2 t = aQuad + 0.5;
  vUv = mix(iUvRect.xy, iUvRect.zw, t);
  vColor = iColor;
  vHitFlash = iSizeFlash.z;
  vEmissive = iSizeFlash.w;
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
in vec4 iPosSize;   // x, y, size, stretch
in vec2 iVel;
in vec4 iColor;
uniform vec2 uResolution;
out vec2 vQuad;
out vec4 vColor;
void main() {
  float speed = length(iVel);
  vec2 dir = speed > 0.001 ? iVel / speed : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float size = iPosSize.z;
  float lenScale = 1.0 + min(speed * iPosSize.w, 6.5);
  vec2 offset = dir * (aQuad.x * size * lenScale) + perp * (aQuad.y * size);
  vec2 worldPos = iPosSize.xy + offset;
  vec2 ndc = (worldPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
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

  // Gravitational Lensing from active Singularities
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

  // Refractive Shockwaves
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

  // Radial Chromatic Aberration
  vec2 fromCenter = uv - 0.5;
  float edgeDist = length(fromCenter);
  float caAmt = (0.0012 + edgeDist * 0.0032) * uAberration;
  vec2 caOffset = fromCenter * caAmt;

  vec2 uvR = clamp(uv + caOffset, 0.001, 0.999);
  vec2 uvG = clamp(uv, 0.001, 0.999);
  vec2 uvB = clamp(uv - caOffset, 0.001, 0.999);

  float r = texture(uSceneTex, uvR).r;
  float g = texture(uSceneTex, uvG).g;
  float b = texture(uSceneTex, uvB).b;
  vec3 sceneCol = vec3(r, g, b);

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
  fragColor = vec4(color, 1.0);
}
`;

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

    // Geometry buffers
    this.maxLineVerts = 180000;
    this.lineFloatsPerVert = 8; // x, y, r, g, b, a, u, v
    this.lineData = new Float32Array(this.maxLineVerts * this.lineFloatsPerVert);
    this.lineVertCount = 0;

    this.maxSprites = 4096;
    this.spriteFloats = 16; // x,y,rot,bank | w,h,flash,emissive | u0,v0,u1,v1 | r,g,b,a
    this.alphaSpriteData = new Float32Array(this.maxSprites * this.spriteFloats);
    this.alphaSpriteCount = 0;
    this.addSpriteData = new Float32Array(this.maxSprites * this.spriteFloats);
    this.addSpriteCount = 0;

    this.maxParticles = 16384;
    this.particleFloats = 10; // x, y, size, stretch, vx, vy, r, g, b, a
    this.particleData = new Float32Array(this.maxParticles * this.particleFloats);
    this.particleCount = 0;

    this.singularities = [];
    this.shockwaves = [];
    this.drawCalls = 0;

    this._initContext();
    this.resize(this.width, this.height);
  }

  _initContext() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    if (!gl) {
      this._enableFallback();
      return;
    }

    this.gl = gl;

    try {
      this.lineProg = this._createProgram(LINE_VS, LINE_FS);
      this.spriteProg = this._createProgram(SPRITE_VS, SPRITE_FS);
      this.particleProg = this._createProgram(PARTICLE_VS, PARTICLE_FS);
      this.bloomProg = this._createProgram(FULLSCREEN_VS, BLOOM_EXTRACT_BLUR_FS, { aPos: 0 });
      this.compositeProg = this._createProgram(FULLSCREEN_VS, COMPOSITE_FS, { aPos: 0 });

      this._setupGeometry();
      this._setupFramebuffers();
    } catch (err) {
      console.warn('WebGL2 shader setup failed, switching to 2D fallback:', err);
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

    // 1. Dynamic Line/Quad VAO
    this.lineVao = gl.createVertexArray();
    this.lineVbo = gl.createBuffer();
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);

    const stride = this.lineFloatsPerVert * 4;
    const locPos = gl.getAttribLocation(this.lineProg, 'aPos');
    const locCol = gl.getAttribLocation(this.lineProg, 'aColor');
    const locUv = gl.getAttribLocation(this.lineProg, 'aUv');

    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(locCol);
    gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(locUv);
    gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, stride, 24);

    // 2. Instanced Aircraft Sprite VAO
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
    const locSPosRot = gl.getAttribLocation(this.spriteProg, 'iPosRot');
    const locSSizeFlash = gl.getAttribLocation(this.spriteProg, 'iSizeFlash');
    const locSUvRect = gl.getAttribLocation(this.spriteProg, 'iUvRect');
    const locSCol = gl.getAttribLocation(this.spriteProg, 'iColor');

    gl.enableVertexAttribArray(locSPosRot);
    gl.vertexAttribPointer(locSPosRot, 4, gl.FLOAT, false, sStride, 0);
    gl.vertexAttribDivisor(locSPosRot, 1);

    gl.enableVertexAttribArray(locSSizeFlash);
    gl.vertexAttribPointer(locSSizeFlash, 4, gl.FLOAT, false, sStride, 16);
    gl.vertexAttribDivisor(locSSizeFlash, 1);

    gl.enableVertexAttribArray(locSUvRect);
    gl.vertexAttribPointer(locSUvRect, 4, gl.FLOAT, false, sStride, 32);
    gl.vertexAttribDivisor(locSUvRect, 1);

    gl.enableVertexAttribArray(locSCol);
    gl.vertexAttribPointer(locSCol, 4, gl.FLOAT, false, sStride, 48);
    gl.vertexAttribDivisor(locSCol, 1);

    // 3. Instanced Particle VAO
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
    const locIVel = gl.getAttribLocation(this.particleProg, 'iVel');
    const locICol = gl.getAttribLocation(this.particleProg, 'iColor');

    gl.enableVertexAttribArray(locIPos);
    gl.vertexAttribPointer(locIPos, 4, gl.FLOAT, false, pStride, 0);
    gl.vertexAttribDivisor(locIPos, 1);

    gl.enableVertexAttribArray(locIVel);
    gl.vertexAttribPointer(locIVel, 2, gl.FLOAT, false, pStride, 16);
    gl.vertexAttribDivisor(locIVel, 1);

    gl.enableVertexAttribArray(locICol);
    gl.vertexAttribPointer(locICol, 4, gl.FLOAT, false, pStride, 24);
    gl.vertexAttribDivisor(locICol, 1);

    // 4. Fullscreen Triangle-Strip Quad VAO
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

  _createFBO(w, h) {
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, w, h };
  }

  _setupFramebuffers() {
    const rw = Math.max(2, Math.floor(this.width * this.dpr));
    const rh = Math.max(2, Math.floor(this.height * this.dpr));
    const bw = Math.max(2, Math.floor(rw * 0.5));
    const bh = Math.max(2, Math.floor(rh * 0.5));

    this._destroyFramebuffers();
    this.sceneFBO = this._createFBO(rw, rh);
    this.bloomFBO1 = this._createFBO(bw, bh);
    this.bloomFBO2 = this._createFBO(bw, bh);
  }

  _destroyFramebuffers() {
    if (!this.gl) return;
    const gl = this.gl;
    [this.sceneFBO, this.bloomFBO1, this.bloomFBO2].forEach(obj => {
      if (obj) {
        gl.deleteFramebuffer(obj.fbo);
        gl.deleteTexture(obj.tex);
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

  beginFrame() {
    this.lineVertCount = 0;
    this.alphaSpriteCount = 0;
    this.addSpriteCount = 0;
    this.particleCount = 0;
    this.singularities.length = 0;
    this.shockwaves.length = 0;
    this.drawCalls = 0;

    if (this.fallback2D && this.ctx2d) {
      const ctx = this.ctx2d;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'lighter';
      return;
    }

    if (this.gl && this.sceneFBO) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo);
      gl.viewport(0, 0, this.sceneFBO.w, this.sceneFBO.h);
      gl.clearColor(0.012, 0.016, 0.042, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
    }
  }

  _pushLineVertex(x, y, r, g, b, a, u, v) {
    const idx = this.lineVertCount * this.lineFloatsPerVert;
    const d = this.lineData;
    d[idx] = x;
    d[idx + 1] = y;
    d[idx + 2] = r;
    d[idx + 3] = g;
    d[idx + 4] = b;
    d[idx + 5] = a;
    d[idx + 6] = u;
    d[idx + 7] = v;
    this.lineVertCount++;
  }

  drawLine(x1, y1, x2, y2, r, g, b, a = 1, thickness = 2) {
    if (this.fallback2D && this.ctx2d) {
      const ctx = this.ctx2d;
      ctx.strokeStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return;
    }

    if (this.lineVertCount + 6 > this.maxLineVerts) {
      this._flushLines();
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;

    const half = Math.max(0.8, thickness * 0.9);
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;

    this._pushLineVertex(x1 - nx, y1 - ny, r, g, b, a, 0, -1);
    this._pushLineVertex(x1 + nx, y1 + ny, r, g, b, a, 0, 1);
    this._pushLineVertex(x2 + nx, y2 + ny, r, g, b, a, 1, 1);

    this._pushLineVertex(x1 - nx, y1 - ny, r, g, b, a, 0, -1);
    this._pushLineVertex(x2 + nx, y2 + ny, r, g, b, a, 1, 1);
    this._pushLineVertex(x2 - nx, y2 - ny, r, g, b, a, 1, -1);
  }

  drawPoly(points, r, g, b, a = 1, closed = true, thickness = 2.2) {
    const n = points.length;
    if (n < 2) return;
    for (let i = 0; i < n - 1; i++) {
      this.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, r, g, b, a, thickness);
    }
    if (closed && n > 2) {
      this.drawLine(points[n - 1].x, points[n - 1].y, points[0].x, points[0].y, r, g, b, a, thickness);
    }
  }

  drawCircle(x, y, radius, r, g, b, a = 1, segments = 24, thickness = 2) {
    const step = (Math.PI * 2) / segments;
    let px = x + radius;
    let py = y;
    for (let i = 1; i <= segments; i++) {
      const ang = i * step;
      const nx = x + Math.cos(ang) * radius;
      const ny = y + Math.sin(ang) * radius;
      this.drawLine(px, py, nx, ny, r, g, b, a, thickness);
      px = nx;
      py = ny;
    }
  }

  drawArc(x, y, radius, startAng, endAng, r, g, b, a = 1, segments = 16, thickness = 2.5) {
    const span = endAng - startAng;
    let px = x + Math.cos(startAng) * radius;
    let py = y + Math.sin(startAng) * radius;
    for (let i = 1; i <= segments; i++) {
      const ang = startAng + (span * i) / segments;
      const nx = x + Math.cos(ang) * radius;
      const ny = y + Math.sin(ang) * radius;
      this.drawLine(px, py, nx, ny, r, g, b, a, thickness);
      px = nx;
      py = ny;
    }
  }

  drawSprite(
    spriteDef,
    x,
    y,
    width,
    height,
    rotation = 0,
    r = 1,
    g = 1,
    b = 1,
    a = 1,
    hitFlash = 0,
    additive = false,
    bankTilt = 0,
    emissiveBoost = 0.55
  ) {
    if (!spriteDef) return;

    if (this.fallback2D && this.ctx2d && this.atlasCanvas) {
      const ctx = this.ctx2d;
      ctx.save();
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(1 - Math.abs(bankTilt) * 0.14, 1);
      ctx.drawImage(
        this.atlasCanvas,
        spriteDef.px,
        spriteDef.py,
        spriteDef.pw,
        spriteDef.ph,
        -width * 0.5,
        -height * 0.5,
        width,
        height
      );
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      return;
    }

    if (additive) {
      if (this.addSpriteCount >= this.maxSprites) this._flushSprites(true);
      const idx = this.addSpriteCount * this.spriteFloats;
      const d = this.addSpriteData;
      d[idx] = x; d[idx + 1] = y; d[idx + 2] = rotation; d[idx + 3] = bankTilt;
      d[idx + 4] = width; d[idx + 5] = height; d[idx + 6] = hitFlash; d[idx + 7] = emissiveBoost;
      d[idx + 8] = spriteDef.u0; d[idx + 9] = spriteDef.v0; d[idx + 10] = spriteDef.u1; d[idx + 11] = spriteDef.v1;
      d[idx + 12] = r; d[idx + 13] = g; d[idx + 14] = b; d[idx + 15] = a;
      this.addSpriteCount++;
    } else {
      if (this.alphaSpriteCount >= this.maxSprites) this._flushSprites(false);
      const idx = this.alphaSpriteCount * this.spriteFloats;
      const d = this.alphaSpriteData;
      d[idx] = x; d[idx + 1] = y; d[idx + 2] = rotation; d[idx + 3] = bankTilt;
      d[idx + 4] = width; d[idx + 5] = height; d[idx + 6] = hitFlash; d[idx + 7] = emissiveBoost;
      d[idx + 8] = spriteDef.u0; d[idx + 9] = spriteDef.v0; d[idx + 10] = spriteDef.u1; d[idx + 11] = spriteDef.v1;
      d[idx + 12] = r; d[idx + 13] = g; d[idx + 14] = b; d[idx + 15] = a;
      this.alphaSpriteCount++;
    }
  }

  drawParticle(x, y, size, r, g, b, a = 1, vx = 0, vy = 0, stretch = 0.03) {
    if (this.fallback2D && this.ctx2d) {
      const ctx = this.ctx2d;
      ctx.fillStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (this.particleCount >= this.maxParticles) {
      this._flushParticles();
    }

    const idx = this.particleCount * this.particleFloats;
    const d = this.particleData;
    d[idx] = x;
    d[idx + 1] = y;
    d[idx + 2] = size;
    d[idx + 3] = stretch;
    d[idx + 4] = vx;
    d[idx + 5] = vy;
    d[idx + 6] = r;
    d[idx + 7] = g;
    d[idx + 8] = b;
    d[idx + 9] = a;
    this.particleCount++;
  }

  draw3DWireframe(vertices3D, edges, x, y, scale, rotX, rotY, rotZ, r, g, b, a = 1, thickness = 2.2) {
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

    const projected = new Array(vertices3D.length);
    for (let i = 0; i < vertices3D.length; i++) {
      const v = vertices3D[i];
      const y1 = v[1] * cx - v[2] * sx;
      const z1 = v[1] * sx + v[2] * cx;
      const x2 = v[0] * cy + z1 * sy;
      const z2 = -v[0] * sy + z1 * cy;
      const x3 = x2 * cz - y1 * sz;
      const y3 = x2 * sz + y1 * cz;

      const perspective = 4.2 / (4.2 - z2 * 0.85);
      projected[i] = {
        x: x + x3 * scale * perspective,
        y: y + y3 * scale * perspective,
        z: z2
      };
    }

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const p1 = projected[e[0]];
      const p2 = projected[e[1]];
      const depthAlpha = Math.max(0.35, Math.min(1.0, 0.72 + (p1.z + p2.z) * 0.18));
      this.drawLine(p1.x, p1.y, p2.x, p2.y, r, g, b, a * depthAlpha, thickness);
    }
  }

  addSingularityUniform(x, y, radiusPx, strength) {
    if (this.singularities.length < 8) {
      this.singularities.push({
        xUv: x / this.width,
        yUv: 1.0 - y / this.height,
        radUv: radiusPx / this.height,
        strength
      });
    }
  }

  addShockwaveUniform(x, y, radiusPx, thicknessPx) {
    if (this.shockwaves.length < 8) {
      this.shockwaves.push({
        xUv: x / this.width,
        yUv: 1.0 - y / this.height,
        radUv: radiusPx / this.height,
        thickUv: thicknessPx / this.height
      });
    }
  }

  flushLayer() {
    if (this.fallback2D || !this.gl) return;
    this._flushLines();
    this._flushSprites(false);
    this._flushSprites(true);
    this._flushParticles();
  }

  _flushLines() {
    if (this.lineVertCount === 0 || !this.gl) return;
    const gl = this.gl;
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.lineProg);
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

    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.spriteProg);
    gl.uniform2f(gl.getUniformLocation(this.spriteProg, 'uResolution'), this.width, this.height);
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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.particleProg);
    gl.uniform2f(gl.getUniformLocation(this.particleProg, 'uResolution'), this.width, this.height);
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

    // 1. Flush any remaining scene geometry into sceneFBO
    this.flushLayer();
    gl.disable(gl.BLEND);

    // 2. Multi-pass HDR Bloom Extract & Separable Blur
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

    // 3. Final Composite Pass to Screen
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
