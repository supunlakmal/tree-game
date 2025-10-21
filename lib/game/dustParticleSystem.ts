import * as THREE from "three";

export class DustParticleSystem {
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly sizes: Float32Array;
  private readonly startSizes: Float32Array;
  private readonly endSizes: Float32Array;
  private readonly ages: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly startAlphas: Float32Array;
  private readonly alphas: Float32Array;

  private readonly scratchSide = new THREE.Vector3();
  private readonly scratchOffset = new THREE.Vector3();
  private readonly scratchUpDrift = new THREE.Vector3();

  private nextIndex = 0;
  private emitAccumulator = 0;

  constructor(private readonly maxParticles = 240) {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xe1e5f2) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.startSizes = new Float32Array(maxParticles);
    this.endSizes = new Float32Array(maxParticles);
    this.ages = new Float32Array(maxParticles);
    this.lifetimes = new Float32Array(maxParticles);
    this.startAlphas = new Float32Array(maxParticles);
    this.alphas = new Float32Array(maxParticles);

    const positionAttr = new THREE.BufferAttribute(this.positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    const sizeAttr = new THREE.BufferAttribute(this.sizes, 1);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    const alphaAttr = new THREE.BufferAttribute(this.alphas, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute("position", positionAttr);
    this.geometry.setAttribute("aSize", sizeAttr);
    this.geometry.setAttribute("aAlpha", alphaAttr);
    this.geometry.setDrawRange(0, maxParticles);

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;

    for (let i = 0; i < maxParticles; i++) {
      this.alphas[i] = 0;
      this.startAlphas[i] = 0;
      this.lifetimes[i] = 0;
    }
  }

  private activateParticle(emitterPosition: THREE.Vector3, backward: THREE.Vector3, up: THREE.Vector3, speed: number) {
    const index = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % this.maxParticles;

    const base = index * 3;
    const side = this.scratchSide.crossVectors(up, backward).normalize();

    this.scratchOffset.copy(emitterPosition);
    this.scratchOffset.addScaledVector(backward, THREE.MathUtils.randFloat(3, 8));
    if (side.lengthSq() > 0) {
      this.scratchOffset.addScaledVector(side, THREE.MathUtils.randFloatSpread(6));
    }
    this.scratchOffset.addScaledVector(up, THREE.MathUtils.randFloat(-2.8, 1.0));

    this.positions[base] = this.scratchOffset.x;
    this.positions[base + 1] = this.scratchOffset.y;
    this.positions[base + 2] = this.scratchOffset.z;

    const spawnSpeed = Math.max(8, speed * 55);
    const sidewaysInfluence = side.lengthSq() > 0 ? THREE.MathUtils.randFloatSpread(12) : 0;

    this.velocities[base] = backward.x * spawnSpeed + side.x * sidewaysInfluence + THREE.MathUtils.randFloatSpread(6);
    this.velocities[base + 1] = backward.y * spawnSpeed + side.y * sidewaysInfluence + THREE.MathUtils.randFloatSpread(6);
    this.velocities[base + 2] = backward.z * spawnSpeed + THREE.MathUtils.randFloat(10, 26);

    this.ages[index] = 0;
    this.lifetimes[index] = THREE.MathUtils.randFloat(0.7, 1.5);

    const startSize = THREE.MathUtils.randFloat(16, 32);
    const endSize = startSize * THREE.MathUtils.randFloat(0.35, 0.6);
    this.startSizes[index] = startSize;
    this.endSizes[index] = endSize;
    this.sizes[index] = startSize;

    const startAlpha = THREE.MathUtils.randFloat(0.55, 0.85);
    this.startAlphas[index] = startAlpha;
    this.alphas[index] = startAlpha;
  }

  update(delta: number, emitterPosition: THREE.Vector3, backward: THREE.Vector3, up: THREE.Vector3, speed: number) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }

    const speedMagnitude = Math.abs(speed);
    if (speedMagnitude > 0.2) {
      this.emitAccumulator += THREE.MathUtils.clamp(speedMagnitude * 40, 12, 70) * delta;
    } else {
      this.emitAccumulator *= 0.6;
    }

    const emitCount = Math.min(this.maxParticles, Math.floor(this.emitAccumulator));
    this.emitAccumulator -= emitCount;

    if (emitCount > 0) {
      for (let i = 0; i < emitCount; i++) {
        this.activateParticle(emitterPosition, backward, up, Math.max(speedMagnitude, 0.2));
      }
    }

    const upInfluence = this.scratchUpDrift.copy(up).multiplyScalar(14 * delta);

    for (let i = 0; i < this.maxParticles; i++) {
      if (this.lifetimes[i] <= 0) {
        continue;
      }

      this.ages[i] += delta;
      if (this.ages[i] >= this.lifetimes[i]) {
        this.lifetimes[i] = 0;
        this.alphas[i] = 0;
        this.startAlphas[i] = 0;
        continue;
      }

      const t = THREE.MathUtils.clamp(this.ages[i] / this.lifetimes[i], 0, 1);
      const base = i * 3;

      this.positions[base] += this.velocities[base] * delta;
      this.positions[base + 1] += this.velocities[base + 1] * delta;
      this.positions[base + 2] += this.velocities[base + 2] * delta;

      this.velocities[base] = this.velocities[base] * 0.9 + upInfluence.x;
      this.velocities[base + 1] = this.velocities[base + 1] * 0.9 + upInfluence.y;
      this.velocities[base + 2] = this.velocities[base + 2] * 0.88 + upInfluence.z + 6 * delta;

      this.sizes[i] = THREE.MathUtils.lerp(this.startSizes[i], this.endSizes[i], t);
      this.alphas[i] = this.startAlphas[i] * (1 - t) * (1 - t);
    }

    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("aSize") as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
