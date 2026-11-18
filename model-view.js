import * as THREE from 'three';
import { createCharacterUnderwear } from './character-underwear.js?v=20261117-lower-body';
import { GLTFLoader } from './vendor/three-examples/examples/jsm/loaders/GLTFLoader.js';

const ASSET_ROOT = './assets/akane/';
const BODY_TEXTURE = 'T_SHINOBIGIRL_BODY_';
// Full-body FBX reference in meters, used to keep the original scene placement.
const REFERENCE_HEIGHT = 1.7793343715392085;
const REFERENCE_ORIGIN = [-0.00001147551693279, 0.00819156840219754, -0.0707735833711931];

export async function loadAkaneCharacter() {
  const loader = new GLTFLoader();
  const [asset, baseColor, normal, packedSurface] = await Promise.all([
    loader.loadAsync(`${ASSET_ROOT}lower-body.glb`),
    loadBodyTexture('BaseColor', THREE.SRGBColorSpace),
    loadBodyTexture('Normal'),
    loadBodyTexture('MetallicSmoothness'),
  ]);
  const model = asset.scene;
  const body = model.getObjectByName('SK_AKANE_BODY_FULL');
  const idleClip = asset.animations.find(clip => clip.name === 'Holding Idle');
  if (!body?.isSkinnedMesh || !idleClip) throw new Error('Akane requires a skinned body and Holding Idle.');

  // The original textures use the FBX UV convention. Blender flips V in glTF.
  const uv = body.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;

  const surface = convertUnitySurface(packedSurface);
  body.material.dispose();
  body.material = new THREE.MeshStandardMaterial({
    map: baseColor, normalMap: normal, roughnessMap: surface, metalnessMap: surface,
    roughness: 1, metalness: 1,
  });
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  const scale = 3.35 / REFERENCE_HEIGHT;
  model.name = 'Akane lower body';
  model.scale.setScalar(scale);
  model.position.fromArray(REFERENCE_ORIGIN).multiplyScalar(-scale);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body);
  createCharacterUnderwear(model);

  const size = bounds.getSize(new THREE.Vector3());
  return { model, idleClip, dimensions: { width: size.x, height: size.y, depth: size.z } };
}

async function loadBodyTexture(map, colorSpace = THREE.NoColorSpace) {
  const texture = await new THREE.TextureLoader().loadAsync(`${ASSET_ROOT}textures/${BODY_TEXTURE}${map}.png`);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  return texture;
}

function convertUnitySurface(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.image.naturalWidth || source.image.width;
  canvas.height = source.image.naturalHeight || source.image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = pixels;
  for (let i = 0; i < data.length; i += 4) {
    // Unity stores metallic in R and smoothness in A. Three.js reads B and G.
    data[i + 2] = data[i];
    data[i + 1] = 255 - data[i + 3];
    data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = source.anisotropy;
  source.dispose();
  return texture;
}
