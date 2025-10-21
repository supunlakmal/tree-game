import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { COLLISION_THRESHOLD, FALLBACK_BOX_COUNT, HEADLIGHT_ANGLE, HEADLIGHT_RANGE, PLANET_RADIUS, PLANET_SEGMENTS, TREE_COUNT } from "./config";
import { createNightSkyTexture, createNoiseMap } from "./noise";

const worldUp = new THREE.Vector3(0, 0, 1);

export interface PlanetAssets {
  planet: THREE.Mesh;
  treeContainer: THREE.Object3D;
}

export function createPlanetSurface(): PlanetAssets {
  const noise = createNoiseMap(512, 24, 12);
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

  const treeContainer = new THREE.Object3D();

  return { planet, treeContainer };
}

export interface SkyAssets {
  skyDome: THREE.Mesh;
  skyGeometry: THREE.SphereGeometry;
  skyMaterial: THREE.MeshBasicMaterial;
}

export function createSkyDome(): SkyAssets {
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

  return { skyDome, skyGeometry, skyMaterial };
}

const tempQuaternionA = new THREE.Quaternion();
const tempQuaternionB = new THREE.Quaternion();
const tempVector = new THREE.Vector3();

export function randomPointOnPlanet(radius: number) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  const normal = new THREE.Vector3(sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi));
  return { normal, position: normal.clone().multiplyScalar(radius) };
}

export async function populatePalmTrees(options: {
  planetGroup: THREE.Group;
  sceneBoxes: THREE.Object3D[];
  treeContainer: THREE.Object3D;
  treeCount?: number;
  fallbackCount?: number;
}) {
  const { planetGroup, sceneBoxes, treeContainer, treeCount = TREE_COUNT, fallbackCount = FALLBACK_BOX_COUNT } = options;

  planetGroup.add(treeContainer);

  const loader = new FBXLoader();

  const loadModel = () =>
    new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        "/modals/Environment_PalmTree_3.fbx",
        (model) => resolve(model),
        undefined,
        (error) => reject(error)
      );
    });

  try {
    const palmTreeModel = await loadModel();

    palmTreeModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const baseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

    for (let i = 0; i < treeCount; i++) {
      const tree = palmTreeModel.clone(true);

      tree.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((mat) => {
                const cloned = mat.clone();
                cloned.transparent = true;
                cloned.opacity = 0;
                return cloned;
              });
            } else {
              const cloned = mesh.material.clone();
              cloned.transparent = true;
              cloned.opacity = 0;
              mesh.material = cloned;
            }
          }
        }
      });

      tree.scale.setScalar(8 + Math.random() * 12);

      const { normal, position } = randomPointOnPlanet(PLANET_RADIUS);
      tree.quaternion.copy(baseQuaternion);
      tree.quaternion.premultiply(tempQuaternionB.setFromAxisAngle(worldUp, Math.random() * Math.PI * 2));
      tree.quaternion.premultiply(tempQuaternionA.setFromUnitVectors(worldUp, normal));

      tempVector.copy(normal).multiplyScalar(-6);
      tree.position.copy(position).add(tempVector);

      tree.visible = false;

      treeContainer.add(tree);
      sceneBoxes.push(tree);
    }
  } catch (error) {
    console.error("Error loading palm tree model:", error);
    console.log("Falling back to boxes...");

    for (let i = 0; i < fallbackCount; i++) {
      const size = 2 + Math.random() * 6;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshPhongMaterial({
        color: 0x0a0a0a,
        shininess: 30,
        emissive: 0x000000,
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      });

      const box = new THREE.Mesh(geometry, material);
      const { normal, position } = randomPointOnPlanet(PLANET_RADIUS);
      box.quaternion.copy(tempQuaternionB.setFromAxisAngle(worldUp, Math.random() * Math.PI * 2));
      box.quaternion.premultiply(tempQuaternionA.setFromUnitVectors(worldUp, normal));
      box.position.copy(position.clone().add(normal.clone().multiplyScalar(size / 2)));
      box.castShadow = true;
      box.receiveShadow = true;
      box.visible = false;

      treeContainer.add(box);
      sceneBoxes.push(box);
    }
  }
}

const scratchPosition = new THREE.Vector3();
const scratchCarForward = new THREE.Vector3();
const scratchToObject = new THREE.Vector3();

export function updateObjectVisibility(
  car: {
    lightsOn: boolean;
    lights: THREE.SpotLight[];
    getWorldPosition: (target: THREE.Vector3) => THREE.Vector3;
    quaternion: THREE.Quaternion;
  },
  sceneBoxes: THREE.Object3D[]
) {
  if (!car.lights || car.lights.length === 0) {
    return;
  }

  const carPosition = scratchPosition.set(0, 0, 0);
  car.getWorldPosition(carPosition);
  const carForward = scratchCarForward.set(1, 0, 0).applyQuaternion(car.quaternion).normalize();

  const lightAngleCos = Math.cos(HEADLIGHT_ANGLE);

  sceneBoxes.forEach((object) => {
    let intensity = 0;

    object.getWorldPosition(scratchToObject);
    scratchToObject.sub(carPosition);
    const distance = scratchToObject.length();

    if (car.lightsOn && distance > 0 && distance <= HEADLIGHT_RANGE) {
      const directionDot = scratchToObject.normalize().dot(carForward);
      if (directionDot > lightAngleCos) {
        const distanceFactor = 1.3 - distance / HEADLIGHT_RANGE;
        const angleFactor = (directionDot - lightAngleCos) / (1 - lightAngleCos);
        intensity = Math.pow(Math.max(0, distanceFactor * angleFactor), 0.7);
      }
    }

    intensity = Math.min(1, intensity);

    object.traverse((child) => {
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

    object.visible = intensity > 0.02;
  });
}

const collisionCarPosition = new THREE.Vector3();
const collisionBoxPosition = new THREE.Vector3();

export function checkCollisions(car: THREE.Object3D, sceneBoxes: THREE.Object3D[], onHit: () => void) {
  car.getWorldPosition(collisionCarPosition);

  for (let i = sceneBoxes.length - 1; i >= 0; i--) {
    const object = sceneBoxes[i];
    object.getWorldPosition(collisionBoxPosition);
    const distance = collisionBoxPosition.distanceTo(collisionCarPosition);

    if (distance < COLLISION_THRESHOLD) {
      onHit();
      object.parent?.remove(object);
      sceneBoxes.splice(i, 1);
    }
  }
}
