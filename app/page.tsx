'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap, RoughEase } from 'gsap/all';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number>();
  const hitCounterRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let renderCalls: Array<() => void> = [];
    let sceneBoxes: THREE.Mesh[] = [];
    let keys: { [key: number]: boolean } = {};

    // Initialize scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x242426, 20, 600);

    // Initialize camera
    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      10,
      600
    );
    camera.position.z = 90;

    // Initialize renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x242426);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.appendChild(renderer.domElement);

    // Window resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Add hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xebf7fd, 0xebf7fd, 0.2);
    hemiLight.position.set(0, 20, 20);
    scene.add(hemiLight);

    // Noise map texture generator
    function noiseMap(size = 256, intensity = 60, repeat = 0) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const width = (canvas.width = size);
      const height = (canvas.height = size);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const n = pixels.length;
      let i = 0;

      while (i < n) {
        pixels[i++] =
          pixels[i++] =
          pixels[i++] =
            Math.sin(i * i * i + (i / n) * Math.PI) * intensity;
        pixels[i++] = 255;
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

        // Point light
        const light = new THREE.PointLight(0xffffff, 1, 0);
        light.position.z = 25;
        light.position.x = 5;
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 50;
        light.shadow.bias = 0.1;
        light.shadow.radius = 5;
        (light as any).power = 3;
        this.add(light);

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

        // Headlights
        this.lights = Array(2)
          .fill(null)
          .map((_, i) => {
            const light = new THREE.SpotLight(0xffffff);
            light.position.x = 11;
            light.position.y = i < 1 ? -3 : 3;
            light.position.z = -3;
            light.angle = Math.PI / 3.5;
            light.castShadow = true;
            light.shadow.mapSize.width = 512;
            light.shadow.mapSize.height = 512;
            light.shadow.camera.near = 1;
            light.shadow.camera.far = 400;
            light.shadow.camera.fov = 40;
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
          this.lights.forEach((light, i) => {
            light.rotation.z = this.angle;
            light.target.position.clone(this.position);
            light.target.position.x += 10;
            light.target.position.y += i < 1 ? -0.5 : 0.5;
            light.target.updateMatrixWorld();
          });

          // Toggle headlights with L key
          if (keys[76]) {
            keys[76] = false;
            this.lightsOn = !this.lightsOn;
            gsap.to(this.lights, {
              intensity: this.lightsOn ? 1 : 0,
              duration: 0.3,
              stagger: 0.02,
              ease: RoughEase.ease,
            });
          }
        }

        // Keep car within bounds
        this.position.x =
          this.position.x > 990 || this.position.x < -990
            ? prev.x
            : this.position.x;
        this.position.y =
          this.position.y > 990 || this.position.y < -990
            ? prev.y
            : this.position.y;

        // Update camera
        camera.position.x += (this.position.x - camera.position.x) * 0.1;
        camera.position.y = this.position.y - 40 - this.speed * 10;

        camera.lookAt(new THREE.Vector3(this.position.x, this.position.y, 0));
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

    document.body.addEventListener('keydown', handleKeyDown);
    document.body.addEventListener('keyup', handleKeyUp);

    // Create and add car
    const car = new Car();
    scene.add(car);
    renderCalls.push(car.update.bind(car));

    // Create snowy ground
    const noise = noiseMap(256, 20, 30);
    function snowyGround() {
      const geometry = new THREE.PlaneGeometry(2000, 2000, 40, 45);
      for (let i = 0; i < geometry.vertices.length; i++) {
        geometry.vertices[i].x += (Math.cos(i * i) + 1 / 2) * 2;
        geometry.vertices[i].y += (Math.cos(i) + 1 / 2) * 2;
        geometry.vertices[i].z = (Math.sin(i * i * i) + 1 / 2) * -4;
      }
      geometry.verticesNeedUpdate = true;
      geometry.normalsNeedUpdate = true;
      geometry.computeFaceNormals();

      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 80,
        bumpMap: noise,
        bumpScale: 0.15,
        shading: THREE.SmoothShading,
      });

      const plane = new THREE.Mesh(geometry, material);
      plane.receiveShadow = true;
      plane.position.z = -5;

      return plane;
    }
    scene.add(snowyGround());

    // Create random boxes
    function randomBoxes() {
      const container = new THREE.Object3D();
      const boxCount = 100;

      for (let i = 0; i < boxCount; i++) {
        const size = 2 + Math.random() * 6;
        const geometry = new THREE.BoxGeometry(size, size, size);

        const material = new THREE.MeshPhongMaterial({
          color: 0x0a0a0a,
          shininess: 30,
          emissive: 0x000000,
          emissiveIntensity: 0,
        });

        const box = new THREE.Mesh(geometry, material);

        box.position.x = (Math.random() - 0.5) * 1800;
        box.position.y = (Math.random() - 0.5) * 1800;
        box.position.z = -5 + size / 2;

        box.rotation.z = Math.random() * Math.PI * 2;
        box.rotation.x = (Math.random() - 0.5) * 0.3;
        box.rotation.y = (Math.random() - 0.5) * 0.3;

        box.castShadow = true;
        box.receiveShadow = true;
        box.visible = false;

        container.add(box);
        sceneBoxes.push(box);
      }

      return container;
    }
    scene.add(randomBoxes());

    // Update box visibility based on headlight illumination
    function updateBoxVisibility() {
      if (!car || !car.lights || car.lights.length === 0) return;

      const lightRange = 150;
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
          console.log('Hit! Total hits:', hitCounterRef.current);

          // Remove box from scene
          scene.remove(box);

          // Remove box from array
          sceneBoxes.splice(i, 1);
        }
      }
    }

    // Animation loop
    let count = 3;
    function render() {
      animationIdRef.current = requestAnimationFrame(render);
      count += 0.03;

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
      window.removeEventListener('resize', handleResize);
      document.body.removeEventListener('keydown', handleKeyDown);
      document.body.removeEventListener('keyup', handleKeyUp);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="game-container" />
      <div className="controls">
        Drive with arrow keys or WASD. Toggle headlights with L
      </div>
    </>
  );
}
