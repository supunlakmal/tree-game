import * as THREE from "three";

export function createNoiseMap(size = 256, intensity = 60, repeat = 0) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D context for noise map generation");
  }

  const width = (canvas.width = size);
  const height = (canvas.height = size);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const total = pixels.length;
  let index = 0;

  while (index < total) {
    const value = ((Math.sin(index * index * index + (index / total) * Math.PI) + 1) / 2) * intensity;
    pixels[index++] = value;
    pixels[index++] = value;
    pixels[index++] = value;
    pixels[index++] = 255;
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

export function createNightSkyTexture(size = 1024, starCount = 900) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D context for sky texture generation");
  }

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
