import * as THREE from "three";

import { CAR_SURFACE_OFFSET, PLANET_RADIUS } from "./config";
import { DustParticleSystem } from "./dustParticleSystem";

export interface CarOptions {
  camera: THREE.PerspectiveCamera;
  planetGroup: THREE.Group;
  keyState: Record<number, boolean>;
  worldUp?: THREE.Vector3;
  dustEmitter?: DustParticleSystem;
}

const defaultWorldUp = new THREE.Vector3(0, 0, 1);

export class Car extends THREE.Object3D {
  maxSpeed = 3;
  speed = 0;
  angle = 0;
  steering = 0;
  lightsOn = true;
  readonly lights: THREE.SpotLight[] = [];

  private readonly wheels: THREE.Mesh[] = [];
  private readonly emitterOffset = new THREE.Vector3(-12, 0, -4);
  private readonly emitterWorld = new THREE.Vector3();
  private readonly emitterBackward = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly desiredCameraPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly rotationAxis = new THREE.Vector3();

  private readonly worldUp: THREE.Vector3;
  private readonly dustEmitter?: DustParticleSystem;

  constructor(
    private readonly options: CarOptions,
    private readonly carGeometry = new THREE.BoxGeometry(20, 10, 3),
    private readonly carMaterial = new THREE.MeshPhongMaterial({
      color: 0xb74242,
      shininess: 100,
      emissive: 0xff0000,
      emissiveIntensity: 0.6,
    }),
    private readonly carTopGeometry = new THREE.BoxGeometry(12, 8, 5),
    private readonly carTopMaterial = new THREE.MeshPhongMaterial({
      color: 0xb74242,
      shininess: 100,
      emissive: 0x990000,
      emissiveIntensity: 0.7,
    }),
    private readonly wheelGeometry = new THREE.CylinderGeometry(3, 3, 1, 6),
    private readonly wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  ) {
    super();

    this.worldUp = options.worldUp ?? defaultWorldUp;
    this.dustEmitter = options.dustEmitter;

    this.createBody();
    this.createWheels();
    this.createLights();

    this.castShadow = true;
    this.receiveShadow = true;

    this.position.set(0, 0, PLANET_RADIUS + CAR_SURFACE_OFFSET);
  }

  update(delta: number) {
    const { keyState, planetGroup, camera } = this.options;
    const deltaFactor = delta > 0 ? Math.min(delta * 60, 2.5) : 1;
    const steerPower = 0.0008 * deltaFactor;

    const maxSteering = 0.01;

    if (keyState[39] || keyState[68]) {
      this.steering = Math.min(this.steering + steerPower, maxSteering);
    } else if (keyState[37] || keyState[65]) {
      this.steering = Math.max(this.steering - steerPower, -maxSteering);
    } else {
      this.steering *= Math.pow(0.92, deltaFactor);
    }

    if (keyState[38] || keyState[87]) {
      this.speed += this.speed < this.maxSpeed ? 0.04 * deltaFactor : 0;
    } else if (keyState[40] || keyState[83]) {
      this.speed -= this.speed > -this.maxSpeed / 2 ? 0.04 * deltaFactor : 0;
    } else {
      this.speed *= Math.pow(0.96, deltaFactor);
    }

    this.speed *= 1 - Math.abs(this.steering / 2);
    this.angle += this.steering * this.speed * deltaFactor;

    this.forward.set(Math.cos(this.angle), -Math.sin(this.angle), 0).normalize();

    this.wheels.forEach((wheel) => {
      wheel.rotation.y += 0.1 * this.speed * deltaFactor;
    });

    const rotationAmount = (this.speed / PLANET_RADIUS) * deltaFactor;
    if (Math.abs(rotationAmount) > 1e-5) {
      this.rotationAxis.copy(this.forward).cross(this.worldUp);
      if (this.rotationAxis.lengthSq() > 1e-8) {
        planetGroup.rotateOnWorldAxis(this.rotationAxis.normalize(), rotationAmount);
      }
    }

    this.rotation.z = -this.angle;

    if (this.dustEmitter) {
      this.emitterWorld.copy(this.emitterOffset);
      this.localToWorld(this.emitterWorld);
      this.emitterBackward.copy(this.forward).multiplyScalar(-1);
      this.dustEmitter.update(delta, this.emitterWorld, this.emitterBackward, this.worldUp, this.speed);
    }

    this.lights.forEach((light) => {
      light.target.updateMatrixWorld(false);
    });

    this.desiredCameraPosition
      .copy(this.position)
      .add(this.forward.clone().multiplyScalar(-80))
      .addScaledVector(this.worldUp, 45);
    camera.position.lerp(this.desiredCameraPosition, 0.08);

    this.lookTarget.copy(this.position).addScaledVector(this.forward, 60);
    camera.lookAt(this.lookTarget);
  }

  private createBody() {
    const body = new THREE.Mesh(this.carGeometry, this.carMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    this.add(body);

    const top = new THREE.Mesh(this.carTopGeometry, this.carTopMaterial);
    top.position.x -= 2;
    top.position.z += 3.5;
    top.castShadow = true;
    top.receiveShadow = true;
    this.add(top);
  }

  private createWheels() {
    this.wheels.push(
      ...Array.from({ length: 4 }, (_, i) => {
        const wheel = new THREE.Mesh(this.wheelGeometry, this.wheelMaterial);
        wheel.position.y = i < 2 ? 6 : -6;
        wheel.position.x = i % 2 ? 6 : -6;
        wheel.position.z = -3;
        this.add(wheel);
        return wheel;
      })
    );
  }

  private createLights() {
    this.lights.push(
      ...Array.from({ length: 2 }, (_, i) => {
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
      })
    );
  }
}
