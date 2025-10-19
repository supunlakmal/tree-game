"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { gsap } from "gsap";
import { RoughEase } from "gsap/EasePack";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number | undefined>(undefined);
  const hitCounterRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const renderCalls: Array<() => void> = [];
    const sceneBoxes: THREE.Object3D[] = [];

    const keys: { [key: number]: boolean } = {};

    // Ground and world configuration
    const GROUND_SIZE = 2000; // Size of the ground plane (width and height)
    const GROUND_SEGMENTS_X = 40; // Ground geometry detail (X axis)
    const GROUND_SEGMENTS_Y = 45; // Ground geometry detail (Y axis)
    const TREE_DISTRIBUTION_AREA = 1800; // Area where trees are randomly placed
    const CAR_MOVEMENT_BOUNDS = 990; // Maximum distance car can travel from center
    const TREE_COUNT = 3000; // Number of palm trees to create
    const FALLBACK_BOX_COUNT = 100; // Number of fallback boxes if FBX fails

    // Initialize scene with pure black atmosphere
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 20, 600);

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 10, 600);
    camera.position.z = 90;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

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

    // Car class
    class Car extends THREE.Object3D {
      maxspeed = 3;
      speed = 0;
      angle = 0;
      steering = 0;
      lightsOn = true;
      wheels: THREE.Mesh[] = [];
      lights: THREE.SpotLight[] = [];

      constructor() {
        super();

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
      }

      update() {
        const prev = {
          x: this.position.x,
          y: this.position.y,
          rot: this.rotation.z,
        };

        const steerPower = 0.0006;

        // Steering
        if (keys[39] || keys[68]) {
          // Right arrow or D
          this.steering += this.steering > -0.01 ? steerPower : 0;
        } else if (keys[37] || keys[65]) {
          // Left arrow or A
          this.steering -= this.steering < 0.01 ? steerPower : 0;
        } else {
          this.steering *= 0.92;
        }

        // Acceleration
        if (keys[38] || keys[87]) {
          // Up arrow or W
          this.speed += this.speed < this.maxspeed ? 0.04 : 0;
        } else if (keys[40] || keys[83]) {
          // Down arrow or S
          this.speed -= this.speed > -this.maxspeed / 2 ? 0.04 : 0;
        } else {
          this.speed *= 0.96;
        }

        this.speed *= 1 - Math.abs(this.steering / 2);
        this.angle += this.steering * this.speed;

        // Rotate wheels
        if (this.wheels) {
          this.wheels.forEach((wheel) => {
            wheel.rotation.y += 0.1 * this.speed;
          });
        }

        // Update position
        const xdir = this.speed * Math.cos(this.angle);
        const ydir = this.speed * Math.sin(this.angle);

        this.position.x += xdir;
        this.position.y += -ydir;
        this.rotation.z = -this.angle;

        // Update headlights
        if (this.lights) {
          this.lights.forEach((light) => {
            light.target.updateMatrixWorld(false);
          });

          // Toggle headlights with L key
          if (keys[76]) {
            keys[76] = false;
            this.lightsOn = !this.lightsOn;
            gsap.to(this.lights, {
              intensity: this.lightsOn ? 800 : 0,
              duration: 0.3,
              stagger: 0.02,
              ease: RoughEase.ease,
            });
          }
        }

        // Keep car within bounds
        this.position.x = this.position.x > CAR_MOVEMENT_BOUNDS || this.position.x < -CAR_MOVEMENT_BOUNDS ? prev.x : this.position.x;
        this.position.y = this.position.y > CAR_MOVEMENT_BOUNDS || this.position.y < -CAR_MOVEMENT_BOUNDS ? prev.y : this.position.y;

        // Update camera
        camera.position.x += (this.position.x - camera.position.x) * 0.1;
        camera.position.y = this.position.y - 40 - this.speed * 10;

        // Look at point between car (z=0) and ground (z=-5) for better visibility
        camera.lookAt(new THREE.Vector3(this.position.x, this.position.y, -2.5));
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

    // Create and add car
    const car = new Car();
    scene.add(car);
    renderCalls.push(car.update.bind(car));

    // Create snowy ground
    const noise = noiseMap(256, 20, 30);
    function snowyGround() {
      const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS_X, GROUND_SEGMENTS_Y);

      // Modern Three.js uses BufferGeometry attributes
      const positionAttribute = geometry.getAttribute("position");
      const positions = positionAttribute.array as Float32Array;

      for (let i = 0; i < positions.length; i += 3) {
        const idx = i / 3;
        positions[i] += (Math.cos(idx * idx) + 1 / 2) * 2; // x
        positions[i + 1] += (Math.cos(idx) + 1 / 2) * 2; // y
        positions[i + 2] += (Math.sin(idx * idx * idx) + 1 / 2) * -4; // z (fixed: += instead of =)
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();

      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 80,
        bumpMap: noise,
        bumpScale: 0.15,
      });

      const plane = new THREE.Mesh(geometry, material);
      plane.receiveShadow = true;
      plane.position.z = -5;

      return plane;
    }
    scene.add(snowyGround());

    // Load and create random palm trees
    const treeContainer = new THREE.Object3D();
    scene.add(treeContainer);

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
        for (let i = 0; i < treeCount; i++) {
          // Clone the loaded palm tree model
          const tree = palmTreeModel.clone();

          // Random scale for variety (adjusted to 10x larger)
          const scale = 10.0; // Scale between 5.0 and 10.0
          tree.scale.set(scale, scale, scale);

          // Fix orientation - rotate to make tree stand upright
          // FBX models often need 90-degree rotation to align with Three.js coordinate system
          tree.rotation.x = Math.PI / 2; // Rotate 90 degrees to make tree vertical

          // Random position
          tree.position.x = (Math.random() - 0.5) * TREE_DISTRIBUTION_AREA;
          tree.position.y = (Math.random() - 0.5) * TREE_DISTRIBUTION_AREA;
          // Embed tree into ground so trunk base sits at ground level
          tree.position.z = -11;

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
          });
          const box = new THREE.Mesh(geometry, material);
          box.position.x = (Math.random() - 0.5) * TREE_DISTRIBUTION_AREA;
          box.position.y = (Math.random() - 0.5) * TREE_DISTRIBUTION_AREA;
          box.position.z = -5 + size / 2;
          box.rotation.z = Math.random() * Math.PI * 2;
          box.castShadow = true;
          box.receiveShadow = true;
          box.visible = false;
          treeContainer.add(box);
          sceneBoxes.push(box);
        }
      }
    );

    // Update box visibility based on headlight illumination
    function updateBoxVisibility() {
      if (!car || !car.lights || car.lights.length === 0) return;

      const lightRange = 300;
      const lightAngle = Math.PI / 3.5;

      sceneBoxes.forEach((box) => {
        const dx = box.position.x - car.position.x;
        const dy = box.position.y - car.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > lightRange) {
          box.visible = false;
          return;
        }

        const carAngle = car.angle;
        const angleToBox = Math.atan2(-dy, dx);
        let angleDiff = angleToBox - carAngle;

        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        if (Math.abs(angleDiff) < lightAngle && car.lightsOn) {
          box.visible = true;
        } else {
          box.visible = false;
        }
      });
    }

    // Check collisions between car and boxes
    function checkCollisions() {
      if (!car) return;

      const collisionThreshold = 15; // Distance for collision detection

      // Iterate backwards to safely remove items
      for (let i = sceneBoxes.length - 1; i >= 0; i--) {
        const box = sceneBoxes[i];

        // Calculate distance between car and box
        const dx = box.position.x - car.position.x;
        const dy = box.position.y - car.position.y;
        const dz = box.position.z - car.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Check if collision occurred
        if (distance < collisionThreshold) {
          // Increment hit counter
          hitCounterRef.current += 1;

          // Log to console
          console.log("Hit! Total hits:", hitCounterRef.current);

          // Remove tree/object from container
          treeContainer.remove(box);

          // Remove from array
          sceneBoxes.splice(i, 1);
        }
      }
    }

    // Animation loop
    function render() {
      animationIdRef.current = requestAnimationFrame(render);

      renderCalls.forEach((callback) => {
        callback();
      });

      updateBoxVisibility();
      checkCollisions();

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
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="game-container" />
      <div className="controls">Drive with arrow keys or WASD. Toggle headlights with L</div>
    </>
  );
}
