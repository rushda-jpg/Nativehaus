import * as THREE from "three";

const cache = new Map<string, Promise<THREE.Texture>>();

/**
 * Rasterizes a plan image (SVG today; a high-resolution PNG/vector
 * replacement later needs no change here) onto an offscreen canvas at a
 * fixed high resolution, then wraps it as a THREE.CanvasTexture with
 * anisotropic filtering — keeps plan linework/text crisp at the oblique
 * angles the residence explorer views it from. The texture's own aspect
 * ratio always matches the source image's, so callers size their plane
 * from it rather than guessing — the plan is never stretched to fill a
 * fixed shape.
 */
export function loadPlanTexture(src: string, targetWidth = 2048): Promise<THREE.Texture> {
  const cached = cache.get(src);
  if (cached) return cached;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const aspect = image.naturalHeight / image.naturalWidth || 1;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = Math.round(targetWidth * aspect);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D canvas context unavailable for plan rasterization"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => reject(new Error(`Failed to load plan image: ${src}`));
    image.src = src;
  });

  cache.set(src, promise);
  return promise;
}

/** Aspect ratio (height/width) of an already-resolved texture's source
 * image, read back from the canvas backing it — used to size planes
 * without distortion. */
export function textureAspect(texture: THREE.Texture): number {
  const image = texture.image as HTMLCanvasElement | undefined;
  if (!image || !image.width) return 1;
  return image.height / image.width;
}
