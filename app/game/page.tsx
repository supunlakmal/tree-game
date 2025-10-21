"use client";

import UserDisplay from "@/components/UserDisplay";
import { clearStoredUsername, getStoredUsername, updateLastPlayed, updateUserCountry } from "@/lib/auth";
import { detectUserCountry } from "@/lib/geo";
import { saveScore } from "@/lib/scores";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export default function Game() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number | undefined>(undefined);
  const hitCounterRef = useRef<number>(0);
  const [username, setUsername] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [hitCount, setHitCount] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    const storedUsername = getStoredUsername();
    if (!storedUsername) {
      router.push("/");
      return;
    }
    setUsername(storedUsername);

    // Update last played timestamp
    updateLastPlayed(storedUsername);

    // Optionally update country on game start (in background)
    detectUserCountry().then((country) => {
      if (country) {
        updateUserCountry(storedUsername, country);
      }
    }).catch(() => {
      // Silent fail - country update is not critical
    });
  }, [router]);

  // End game function
  const endGame = async () => {
    const score = hitCounterRef.current;
    setFinalScore(score);
    setGameOver(true);

    // Save score to database
    if (username) {
      const result = await saveScore(username, score);
      setScoreSaved(result.success);
    }

    // Stop animation
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
  };

  // Countdown timer - 2 minutes
  useEffect(() => {
    if (!username || gameOver) return;

    const timerInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [username, gameOver]);

  useEffect(() => {
    if (!username || !containerRef.current) return;

    const container = containerRef.current;
    const renderCalls: Array<(delta: number) => void> = [];
    const sceneBoxes: THREE.Object3D[] = [];

    const keys: { [key: number]: boolean } = {};
    const WORLD_UP = new THREE.Vector3(0, 0, 1);
    const tempVec1 = new THREE.Vector3();
    const tempVec2 = new THREE.Vector3();
    const tempVec3 = new THREE.Vector3();
    const tempQuat1 = new THREE.Quaternion();
    const tempQuat2 = new THREE.Quaternion();

    // Ground and world configuration
    const PLANET_RADIUS = 520; // Radius of the spherical ground
    const PLANET_SEGMENTS = 128; // Geometry detail for the globe
    const CAR_SURFACE_OFFSET = 12; // How far above the ground the car floats
    const TREE_COUNT = 700; // Number of palm trees to create
    const FALLBACK_BOX_COUNT = 100; // Number of fallback boxes if FBX fails

    // Initialize scene with pure black atmosphere
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, PLANET_RADIUS * 0.25, PLANET_RADIUS * 4);

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, PLANET_RADIUS * 6);
    camera.position.set(0, -PLANET_RADIUS * 0.4, PLANET_RADIUS + 160);
    camera.up.set(0, 0, 1);

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();

    // Window resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Minimal hemisphere light for dark atmosphere (only headlights should illuminate)
    const hemiLight = new THREE.HemisphereLight(0xebf7fd, 0xebf7fd, 0.01);
    hemiLight.position.set(0, 20, 20);
    scene.add(hemiLight);

    // Minimal ambient light to create dramatic darkness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.01);
    scene.add(ambientLight);

    // Group that holds the spherical ground and all scenery attached to it
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    const skyTexture = createNightSkyTexture();
    const skyGeometry = new THREE.SphereGeometry(PLANET_RADIUS * 5, 64, 64);
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    skyDome.renderOrder = -1;
    scene.add(skyDome);

    // Noise map texture generator (fixed: normalize values to 0-255 range)
    function noiseMap(size = 256, intensity = 60, repeat = 0) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const width = (canvas.width = size);
      const height = (canvas.height = size);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const n = pixels.length;
      let i = 0;

      while (i < n) {
        // Normalize sin output (-1 to 1) to pixel range (0 to 255)
        const value = ((Math.sin(i * i * i + (i / n) * Math.PI) + 1) / 2) * intensity;
        pixels[i++] = value; // R
        pixels[i++] = value; // G
        pixels[i++] = value; // B
        pixels[i++] = 255; // A
      }
      ctx.putImageData(imageData, 0, 0);

      const texture = new THREE.Texture(canvas);
      if (repeat) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
      }
      texture.needsUpdate = true;

      return texture;
    }

    function createNightSkyTexture(size = 1024, starCount = 900) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;

      const center = size / 2;
      const gradient = ctx.createRadialGradient(center, center * 0.8, size * 0.1, center, center, size * 0.8);
      gradient.addColorStop(0, "#0c1038");
      gradient.addColorStop(0.5, "#050618");
      gradient.addColorStop(1, "#000000");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 1.2 + 0.2;
        const alpha = Math.random() * 0.7 + 0.2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${200 + Math.floor(Math.random() * 35)}, ${210 + Math.floor(Math.random() * 25)}, 255, ${alpha})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      const threeColorConfig = THREE as unknown as { SRGBColorSpace?: string; sRGBEncoding?: number };
      if ("colorSpace" in texture) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (texture as any).colorSpace = threeColorConfig.SRGBColorSpace ?? "srgb";
      } else if ("encoding" in texture && typeof threeColorConfig.sRGBEncoding !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (texture as any).encoding = threeColorConfig.sRGBEncoding;
      }
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      return texture;
    }

    // Car geometries and materials
    const carGeometry = new THREE.BoxGeometry(20, 10, 3);
    const carMaterial = new THREE.MeshPhongMaterial({
      color: 0xb74242,
      shininess: 100,
      emissive: 0xff0000,
      emissiveIntensity: 0.6,
    });

    const carTopGeometry = new THREE.BoxGeometry(12, 8, 5);
    const carTopMaterial = new THREE.MeshPhongMaterial({
      color: 0xb74242,
      shininess: 100,
      emissive: 0x990000,
      emissiveIntensity: 0.7,
    });

    const wheelGeometry = new THREE.CylinderGeometry(3, 3, 1, 6);
    const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    class DustParticleSystem {
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
      private readonly maxParticles: number;
      private nextIndex = 0;
      private emitAccumulator = 0;

      constructor(maxParticles = 240) {
        this.maxParticles = maxParticles;
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

    // Car class
    class Car extends THREE.Object3D {
      maxspeed = 3;
      speed = 0;
      angle = 0;
      steering = 0;
      lightsOn = true;
      wheels: THREE.Mesh[] = [];
      lights: THREE.SpotLight[] = [];
      private readonly dustEmitter?: DustParticleSystem;
      private readonly emitterOffset = new THREE.Vector3(-12, 0, -4);
      private readonly emitterWorld = new THREE.Vector3();
      private readonly emitterBackward = new THREE.Vector3();

      constructor(dustEmitter?: DustParticleSystem) {
        super();
        this.dustEmitter = dustEmitter;

        // Car body
        const carBody = new THREE.Mesh(carGeometry, carMaterial);
        carBody.castShadow = true;
        carBody.receiveShadow = true;
        this.add(carBody);

        // Car top
        const carTop = new THREE.Mesh(carTopGeometry, carTopMaterial);
        carTop.position.x -= 2;
        carTop.position.z += 3.5;
        carTop.castShadow = true;
        carTop.receiveShadow = true;
        this.add(carTop);

        this.castShadow = true;
        this.receiveShadow = true;

        // Wheels
        this.wheels = Array(4)
          .fill(null)
          .map((_, i) => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.y = i < 2 ? 6 : -6;
            wheel.position.x = i % 2 ? 6 : -6;
            wheel.position.z = -3;
            this.add(wheel);
            return wheel;
          });

        // Headlights (very high intensity for dark atmosphere - only light source)
        this.lights = Array(2)
          .fill(null)
          .map((_, i) => {
            const light = new THREE.SpotLight(0xffffff, 800);
            light.position.x = 11;
            light.position.y = i < 1 ? -3 : 3;
            light.position.z = -3;
            light.angle = Math.PI / 3.5;
            light.penumbra = 0.5;
            light.decay = 1.5;
            light.distance = 600;
            light.castShadow = true;
            light.shadow.mapSize.width = 512;
            light.shadow.mapSize.height = 512;
            (light.shadow.camera as THREE.PerspectiveCamera).near = 1;
            (light.shadow.camera as THREE.PerspectiveCamera).far = 600;
            (light.shadow.camera as THREE.PerspectiveCamera).fov = 40;
            light.target.position.y = i < 1 ? -0.5 : 0.5;
            light.target.position.x = 35;
            this.add(light.target);
            this.add(light);
            return light;
          });

        // Position car on top of the globe
        this.position.set(0, 0, PLANET_RADIUS + CAR_SURFACE_OFFSET);
      }

      update(delta: number) {
        const deltaFactor = delta > 0 ? Math.min(delta * 60, 2.5) : 1;
        const steerPower = 0.0008 * deltaFactor;

        // Steering
        if (keys[39] || keys[68]) {
          // Right arrow or D
          this.steering += this.steering > -0.01 ? steerPower : 0;
        } else if (keys[37] || keys[65]) {
          // Left arrow or A
          this.steering -= this.steering < 0.01 ? steerPower : 0;
        } else {
          this.steering *= Math.pow(0.92, deltaFactor);
        }

        // Acceleration
        if (keys[38] || keys[87]) {
          // Up arrow or W
          this.speed += this.speed < this.maxspeed ? 0.04 * deltaFactor : 0;
        } else if (keys[40] || keys[83]) {
          // Down arrow or S
          this.speed -= this.speed > -this.maxspeed / 2 ? 0.04 * deltaFactor : 0;
        } else {
          this.speed *= Math.pow(0.96, deltaFactor);
        }

        this.speed *= 1 - Math.abs(this.steering / 2);
        this.angle += this.steering * this.speed * deltaFactor;

        const forward = tempVec1.set(Math.cos(this.angle), -Math.sin(this.angle), 0).normalize();

        // Rotate wheels
        if (this.wheels) {
          this.wheels.forEach((wheel) => {
            wheel.rotation.y += 0.1 * this.speed * deltaFactor;
          });
        }

        // Rotate the planet under the car to simulate traveling across the globe
        const rotationAmount = (this.speed / PLANET_RADIUS) * deltaFactor;
        if (Math.abs(rotationAmount) > 1e-5) {
          const axis = tempVec2.copy(forward).cross(WORLD_UP);
          if (axis.lengthSq() > 1e-8) {
            planetGroup.rotateOnWorldAxis(axis.normalize(), rotationAmount);
          }
        }

        this.rotation.z = -this.angle;

        if (this.dustEmitter) {
          this.emitterWorld.copy(this.emitterOffset);
          this.localToWorld(this.emitterWorld);
          this.emitterBackward.copy(forward).multiplyScalar(-1);
          this.dustEmitter.update(delta, this.emitterWorld, this.emitterBackward, WORLD_UP, this.speed);
        }

        // Update headlights
        if (this.lights) {
          this.lights.forEach((light) => {
            light.target.updateMatrixWorld(false);
          });
        }

        // Update camera to stay behind the car and slightly above
        const desiredCameraPosition = tempVec2
          .copy(this.position)
          .add(tempVec3.copy(forward).multiplyScalar(-80));
        desiredCameraPosition.addScaledVector(WORLD_UP, 45);
        camera.position.lerp(desiredCameraPosition, 0.08);

        const lookTarget = tempVec3.copy(this.position).addScaledVector(forward, 60);
        camera.lookAt(lookTarget);
      }
    }

    // Keyboard event handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.keyCode] = true;
      e.preventDefault();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.keyCode] = false;
      e.preventDefault();
    };

    document.body.addEventListener("keydown", handleKeyDown);
    document.body.addEventListener("keyup", handleKeyUp);

    const dustSystem = new DustParticleSystem(260);
    scene.add(dustSystem.points);

    // Create and add car
    const car = new Car(dustSystem);
    scene.add(car);
    renderCalls.push((delta) => car.update(delta));

    const initialForward = new THREE.Vector3(1, 0, 0);
    camera.position.copy(car.position).addScaledVector(initialForward, -80).addScaledVector(WORLD_UP, 45);
    const initialLookTarget = car.position.clone().addScaledVector(initialForward, 60);
    camera.lookAt(initialLookTarget);

    // Create snowy ground
    const noise = noiseMap(512, 24, 12);
    function randomPointOnPlanet(radius: number) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const sinPhi = Math.sin(phi);
      const normal = new THREE.Vector3(
        sinPhi * Math.cos(theta),
        sinPhi * Math.sin(theta),
        Math.cos(phi)
      );
      return { normal, position: normal.clone().multiplyScalar(radius) };
    }
    function createPlanetSurface() {
      const geometry = new THREE.SphereGeometry(PLANET_RADIUS, PLANET_SEGMENTS, PLANET_SEGMENTS);
      geometry.computeVertexNormals();

      const material = new THREE.MeshPhongMaterial({
        color: 0xdedede,
        shininess: 80,
        bumpMap: noise,
        bumpScale: 0.85,
        specular: new THREE.Color(0x222222),
      });

      const planet = new THREE.Mesh(geometry, material);
      planet.receiveShadow = true;
      planet.castShadow = false;

      return planet;
    }
    planetGroup.add(createPlanetSurface());

    // Load and create random palm trees
    const treeContainer = new THREE.Object3D();
    planetGroup.add(treeContainer);

    const loader = new FBXLoader();
    loader.load(
      "/modals/Environment_PalmTree_3.fbx",
      (palmTreeModel) => {
        console.log("Palm tree model loaded successfully!");

        // Enable shadows on all meshes in the loaded model
        palmTreeModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).castShadow = true;
            (child as THREE.Mesh).receiveShadow = true;
          }
        });

        // Create palm tree instances
        const treeCount = TREE_COUNT;
        const baseTreeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        for (let i = 0; i < treeCount; i++) {
          // Clone the loaded palm tree model
          const tree = palmTreeModel.clone();

          // Clone materials for this instance to avoid shared references
          tree.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  // Clone each material in the array
                  mesh.material = mesh.material.map((mat) => {
                    const clonedMat = mat.clone();
                    clonedMat.transparent = true;
                    clonedMat.opacity = 0; // Start invisible
                    return clonedMat;
                  });
                } else {
                  // Clone single material
                  const clonedMat = mesh.material.clone();
                  clonedMat.transparent = true;
                  clonedMat.opacity = 0; // Start invisible
                  mesh.material = clonedMat;
                }
              }
            }
          });

          // Random scale for variety (adjusted to 10x larger)
          const scale = 10.0; // Scale between 5.0 and 10.0
          tree.scale.set(scale, scale, scale);

          // Position tree on the globe
          const { normal, position } = randomPointOnPlanet(PLANET_RADIUS);
          tree.quaternion.copy(baseTreeQuaternion);
          tree.quaternion.premultiply(tempQuat2.setFromAxisAngle(WORLD_UP, Math.random() * Math.PI * 2));
          tree.quaternion.premultiply(tempQuat1.setFromUnitVectors(WORLD_UP, normal));

          // Sink slightly into the surface so roots meet the snow
          tree.position.copy(position.clone().add(normal.clone().multiplyScalar(-6)));

          // Initially invisible (will be revealed by headlights)
          tree.visible = false;

          treeContainer.add(tree);
          sceneBoxes.push(tree); // Using existing array for visibility/collision
        }

        console.log(`Created ${treeCount} palm tree instances`);
      },
      (progress) => {
        console.log(`Loading palm tree: ${((progress.loaded / progress.total) * 100).toFixed(2)}%`);
      },
      (error) => {
        console.error("Error loading palm tree model:", error);
        console.log("Falling back to boxes...");

        // Fallback to boxes if FBX loading fails
        for (let i = 0; i < FALLBACK_BOX_COUNT; i++) {
          const size = 2 + Math.random() * 6;
          const geometry = new THREE.BoxGeometry(size, size, size);
          const material = new THREE.MeshPhongMaterial({
            color: 0x0a0a0a,
            shininess: 30,
            emissive: 0x000000,
            emissiveIntensity: 0,
            transparent: true, // Enable transparency for gradual fade-in
            opacity: 0, // Start invisible
          });
          const box = new THREE.Mesh(geometry, material);
          const { normal, position } = randomPointOnPlanet(PLANET_RADIUS);
          box.quaternion.copy(tempQuat2.setFromAxisAngle(WORLD_UP, Math.random() * Math.PI * 2));
          box.quaternion.premultiply(tempQuat1.setFromUnitVectors(WORLD_UP, normal));
          box.position.copy(position.clone().add(normal.clone().multiplyScalar(size / 2)));
          box.castShadow = true;
          box.receiveShadow = true;
          box.visible = false;
          treeContainer.add(box);
          sceneBoxes.push(box);
        }
      }
    );

    // Update box visibility and opacity based on headlight illumination
    function updateBoxVisibility() {
      if (!car || !car.lights || car.lights.length === 0) return;

      const carPosition = tempVec1.set(0, 0, 0);
      car.getWorldPosition(carPosition);
      const carForward = tempVec2.set(1, 0, 0).applyQuaternion(car.quaternion).normalize();

      const lightRange = 320;
      const lightAngle = Math.PI / 3.5;
      const lightAngleCos = Math.cos(lightAngle);

      sceneBoxes.forEach((box) => {
        let intensity = 0;

        const toBox = tempVec3;
        box.getWorldPosition(toBox);
        toBox.sub(carPosition);
        const distance = toBox.length();

        if (car.lightsOn && distance > 0 && distance <= lightRange) {
          const directionDot = toBox.normalize().dot(carForward);
          if (directionDot > lightAngleCos) {
            const distanceFactor = 1.3 - distance / lightRange;
            const angleFactor = (directionDot - lightAngleCos) / (1 - lightAngleCos);
            intensity = Math.pow(Math.max(0, distanceFactor * angleFactor), 0.7);
          }
        }

        intensity = Math.min(1, intensity);

        box.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if ("opacity" in mat) {
                  mat.transparent = true;
                  mat.opacity = intensity;
                }
              });
            }
          }
        });

        box.visible = intensity > 0.02;
      });
    }

    // Check collisions between car and boxes
    function checkCollisions() {
      if (!car) return;

      const carPosition = tempVec1.set(0, 0, 0);
      car.getWorldPosition(carPosition);
      const collisionThreshold = 28;

      for (let i = sceneBoxes.length - 1; i >= 0; i--) {
        const box = sceneBoxes[i];
        const toBox = tempVec2;
        box.getWorldPosition(toBox);
        const distance = toBox.distanceTo(carPosition);

        if (distance < collisionThreshold) {
          hitCounterRef.current += 1;
          setHitCount(hitCounterRef.current);

          console.log("Hit! Total hits:", hitCounterRef.current);

          box.parent?.remove(box);
          sceneBoxes.splice(i, 1);
        }
      }
    }

    // Animation loop
    function render() {
      animationIdRef.current = requestAnimationFrame(render);

      const delta = Math.min(clock.getDelta(), 0.1);

      renderCalls.forEach((callback) => {
        callback(delta);
      });

      updateBoxVisibility();
      checkCollisions();

      skyDome.position.copy(camera.position);

      renderer.toneMappingExposure = Math.pow(0.91, 5.0);
      renderer.render(scene, camera);
    }

    render();

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
      document.body.removeEventListener("keydown", handleKeyDown);
      document.body.removeEventListener("keyup", handleKeyUp);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      scene.remove(dustSystem.points);
      dustSystem.dispose();
      scene.remove(skyDome);
      skyGeometry.dispose();
      skyMaterial.dispose();
      renderer.dispose();
    };
  }, [username]);

  // Don't render game until username is verified
  if (!username) {
    return null;
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get timer color based on remaining time
  const getTimerClass = () => {
    if (timeRemaining > 60) return "timer-green";
    if (timeRemaining > 30) return "timer-yellow";
    return "timer-red";
  };

  return (
    <>
      <UserDisplay username={username} />

      {/* Game Timer */}
      {!gameOver && (
        <div className={`game-timer ${getTimerClass()}`}>
          <div className="timer-icon">⏱</div>
          <div className="timer-value">{formatTime(timeRemaining)}</div>
        </div>
      )}

      {/* Hit Counter */}
      {!gameOver && (
        <div className="hit-counter">
          <div className="hit-counter-icon">🎯</div>
          <div className="hit-counter-label">Hits</div>
          <div className="hit-counter-value">{hitCount}</div>
        </div>
      )}

      <div ref={containerRef} className="game-container" />
      <div className="controls">Drive with arrow keys or WASD | 2 minute timed game</div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="game-over-modal">
          <div className="game-over-content">
            <h2 className="game-over-title">Game Over!</h2>
            <div className="final-score">
              <span className="score-label">Final Score:</span>
              <span className="score-value">{finalScore}</span>
            </div>
            {scoreSaved ? <p className="save-status success">Score saved successfully!</p> : <p className="save-status error">Failed to save score</p>}
            <div className="game-over-actions">
              <button
                onClick={() => {
                  setGameOver(false);
                  setFinalScore(0);
                  setScoreSaved(false);
                  hitCounterRef.current = 0;
                  window.location.reload();
                }}
                className="play-again-button"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  clearStoredUsername();
                  router.push("/");
                }}
                className="home-button"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
