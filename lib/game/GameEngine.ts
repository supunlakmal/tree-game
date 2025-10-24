import * as THREE from "three";

import { Car } from "./car";
import { CAMERA_FOV, PLANET_RADIUS } from "./config";
import { DustParticleSystem } from "./dustParticleSystem";
import {
  checkCollisions,
  createPlanetSurface,
  createSkyDome,
  populatePalmTrees,
  updateObjectVisibility,
  updatePalmTreeWind,
} from "./environment";

export interface GameEngineOptions {
  container: HTMLDivElement;
  onHit: (totalHits: number) => void;
}

export class GameEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    PLANET_RADIUS * 6
  );
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly clock = new THREE.Clock();
  private readonly planetGroup = new THREE.Group();
  private readonly keyState: Record<number, boolean> = {};
  private readonly sceneBoxes: THREE.Object3D[] = [];
  private readonly worldUp = new THREE.Vector3(0, 0, 1);

  private resizeHandler?: () => void;
  private visualViewportHandler?: () => void;
  private car!: Car;
  private dustSystem!: DustParticleSystem;
  private skyAssets: ReturnType<typeof createSkyDome> | null = null;
  private animationId?: number;
  private disposed = false;
  private hitCount = 0;

  constructor(private readonly options: GameEngineOptions) {
    this.initializeScene();
    this.initializeRenderer();
    this.initializeWorld();
    this.initializePlayer();
    this.initializeEventHandlers();
  }

  start() {
    if (this.disposed) return;
    this.clock.start();
    this.render();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.removeEventHandlers();

    const { container } = this.options;
    if (container && this.renderer.domElement.parentElement === container) {
      container.removeChild(this.renderer.domElement);
    }

    if (this.dustSystem) {
      this.scene.remove(this.dustSystem.points);
      this.dustSystem.dispose();
    }

    if (this.skyAssets) {
      this.scene.remove(this.skyAssets.skyDome);
      this.skyAssets.skyGeometry.dispose();
      this.skyAssets.skyMaterial.dispose();
    }

    this.renderer.dispose();
  }

  getHitCount() {
    return this.hitCount;
  }

  setKeyState(keyCode: number, isPressed: boolean) {
    this.keyState[keyCode] = isPressed;
  }

  private initializeScene() {
    this.scene.fog = new THREE.Fog(0x000000, PLANET_RADIUS * 0.25, PLANET_RADIUS * 4);
  }

  private initializeRenderer() {
    const { container } = this.options;

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.updateRendererSize();
    this.renderer.setClearColor(0x000000);
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.resizeHandler = () => {
      this.updateRendererSize();
    };
    window.addEventListener("resize", this.resizeHandler);

    if (window.visualViewport) {
      this.visualViewportHandler = () => {
        this.updateRendererSize();
      };
      window.visualViewport.addEventListener("resize", this.visualViewportHandler);
    }
  }

  private updateRendererSize() {
    const { container } = this.options;
    const width = container.clientWidth || window.innerWidth || 1;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const height = container.clientHeight || viewportHeight || 1;

    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private initializeWorld() {
    this.scene.add(this.planetGroup);

    const hemiLight = new THREE.HemisphereLight(0xebf7fd, 0xebf7fd, 0.01);
    hemiLight.position.set(0, 20, 20);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.01);
    this.scene.add(ambientLight);

    const planetAssets = createPlanetSurface();
    this.planetGroup.add(planetAssets.planet);
    this.planetGroup.add(planetAssets.treeContainer);

    this.skyAssets = createSkyDome();
    this.scene.add(this.skyAssets.skyDome);

    this.dustSystem = new DustParticleSystem(260);
    this.scene.add(this.dustSystem.points);

    void populatePalmTrees({
      planetGroup: this.planetGroup,
      treeContainer: planetAssets.treeContainer,
      sceneBoxes: this.sceneBoxes,
    });
  }

  private initializePlayer() {
    this.car = new Car({
      camera: this.camera,
      planetGroup: this.planetGroup,
      keyState: this.keyState,
      worldUp: this.worldUp,
      dustEmitter: this.dustSystem,
    });

    this.scene.add(this.car);

    const initialForward = new THREE.Vector3(1, 0, 0);
    this.camera.position.copy(this.car.position).addScaledVector(initialForward, -80).addScaledVector(this.worldUp, 45);
    this.camera.up.copy(this.worldUp);
    const initialLookTarget = this.car.position.clone().addScaledVector(initialForward, 60);
    this.camera.lookAt(initialLookTarget);
  }

  private initializeEventHandlers() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    document.body.addEventListener("keydown", this.handleKeyDown);
    document.body.addEventListener("keyup", this.handleKeyUp);
  }

  private removeEventHandlers() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (this.visualViewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this.visualViewportHandler);
      this.visualViewportHandler = undefined;
    }
    document.body.removeEventListener("keydown", this.handleKeyDown);
    document.body.removeEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown(event: KeyboardEvent) {
    this.setKeyState(event.keyCode, true);
    event.preventDefault();
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.setKeyState(event.keyCode, false);
    event.preventDefault();
  }

  private render = () => {
    this.animationId = requestAnimationFrame(this.render);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.car.update(delta);
    updatePalmTreeWind(this.clock.elapsedTime);
    updateObjectVisibility(this.car, this.sceneBoxes);
    checkCollisions(this.car, this.sceneBoxes, () => this.registerHit());

    if (this.skyAssets) {
      this.skyAssets.skyDome.position.copy(this.camera.position);
    }

    this.renderer.toneMappingExposure = Math.pow(0.91, 5.0);
    this.renderer.render(this.scene, this.camera);
  };

  private registerHit() {
    this.hitCount += 1;
    this.options.onHit(this.hitCount);
  }
}
