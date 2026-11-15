import * as THREE from 'three';
import { createCharacterUnderwear } from './character-underwear.js';
import { FBXLoader } from './vendor/three-examples/examples/jsm/loaders/FBXLoader.js';

const ASSET_ROOT = './assets/akane/';

const textureDefinitions = {
  body: { map: 'T_SHINOBIGIRL_BODY_BaseColor.png', normal: 'T_SHINOBIGIRL_BODY_Normal.png', metalnessMap: 'body-metalness', roughnessMap: 'body-roughness' },
  eyes: { map: 'T_EYES_BASECOLOR_BROWN.png', normal: 'T_EYES_NORMAL.png', emissiveMap: 'T_EYES_EMISSIVE.png', aoMap: 'T_EYES_AO.png' },
  hair: { alphaMap: 'T_HAIR_WAVY_ALPHA.png', normal: 'T_HAIR_WAVY_normal.png' },
  head: { map: 'T_SHINOBIGIRL_HEAD_BaseColor.png', normal: 'T_SHINOBIGIRL_HEAD_Normal.png', metalnessMap: 'head-metalness', roughnessMap: 'head-roughness' },
  lashes: { map: 'T_SHINOBIGIRL_LASHES_basecolor.png' },
  teeth: { map: 'T_SHINOBIGIRL_Teeth_BaseColor.png', normal: 'T_SHINOBIGIRL_Teeth_Normal.png', roughnessMap: 'T_SHINOBIGIRL_Teeth_Roughness.png', aoMap: 'T_SHINOBIGIRL_Teeth_AO.png' },
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function getTexture(file, color = false) {
  if (!file) return null;
  if (!textureCache.has(file)) {
    const texture = textureLoader.load(`${ASSET_ROOT}textures/${file}`);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 8;
    textureCache.set(file, texture);
  }
  return textureCache.get(file);
}

function withMaps(definition, params = {}) {
  for (const key of ['map', 'emissiveMap']) if (definition[key]) params[key] = getTexture(definition[key], true);
  if (definition.normal) params.normalMap = getTexture(definition.normal);
  if (definition.metalnessMap) params.metalnessMap = getTexture(definition.metalnessMap);
  if (definition.roughnessMap) params.roughnessMap = getTexture(definition.roughnessMap);
  if (definition.aoMap) params.aoMap = getTexture(definition.aoMap);
  if (definition.alphaMap) params.alphaMap = getTexture(definition.alphaMap);
  return params;
}

function createMaterial(name) {
  switch (name) {
    case 'MAT_AKANE_BODY':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.body, { color: 0xffffff, roughness: 1, metalness: 1 }));
    case 'MAT_AKANE_CARUNCLE':
      return new THREE.MeshStandardMaterial({ color: 0xc98175, roughness: 0.62 });
    case 'MAT_AKANE_EYE_L':
    case 'MAT_AKANE_EYE_R':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.eyes, { color: 0xffffff, roughness: 0.34, metalness: 0.03, emissive: 0x21100b, emissiveIntensity: 0.08 }));
    case 'MAT_AKANE_HAIR':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.hair, { color: 0x34302f, roughness: 0.72, alphaTest: 0.42, side: THREE.DoubleSide }));
    case 'MAT_AKANE_HEAD':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.head, { color: 0xffffff, roughness: 1, metalness: 1, emissive: 0x080808, emissiveIntensity: 0.1 }));
    case 'MAT_AKANE_LASHES':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.lashes, { color: 0xffffff, roughness: 0.72, alphaTest: 0.32, side: THREE.DoubleSide }));
    case 'MAT_AKANE_TEETH':
      return new THREE.MeshStandardMaterial(withMaps(textureDefinitions.teeth, { color: 0xffffff, roughness: 0.58 }));
    default:
      return new THREE.MeshStandardMaterial({ color: 0xc98175, roughness: 0.7, side: THREE.DoubleSide });
  }
}

function disposeFbxMaterials(material) {
  for (const mat of Array.isArray(material) ? material : [material]) {
    if (!mat) continue;
    for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
    mat.dispose();
  }
}

export async function loadNudeCharacter() {
  // The FBX stores texture paths from the artist's workstation. Redirect those
  // requests to a local blank image; the web demo assigns the packaged maps below.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => /\.(png|jpe?g|tga|tif|bmp)(?:$|[?#])/i.test(url) ? `${ASSET_ROOT}blank.png` : url);
  const loader = new FBXLoader(manager);
  const [model, idleSource] = await Promise.all([
    loader.loadAsync(`${ASSET_ROOT}SK_ShinobiGirl_Nude.fbx`),
    loader.loadAsync(`${ASSET_ROOT}Holding_Idle.fbx`).catch(error => {
      console.warn('Unable to load Holding Idle animation', error);
      return null;
    }),
    Promise.all([
      convertUnityMetallicSmoothness('T_SHINOBIGIRL_BODY_MetallicSmoothness.png', 'body'),
      convertUnityMetallicSmoothness('T_SHINOBIGIRL_HEAD_MetallicSmoothness.png', 'head'),
    ]),
  ]);

  model.traverse(object => {
    if (!object.isMesh) return;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const converted = sourceMaterials.map(source => {
      const material = createMaterial(source?.name ?? '');
      disposeFbxMaterials(source);
      return material;
    });
    object.material = Array.isArray(object.material) ? converted : converted[0];
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
  });

  model.name = 'SK_ShinobiGirl_Nude';
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('FBX model has no visible height.');

  const targetHeight = 3.35;
  model.scale.setScalar(targetHeight / size.y);
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBounds.min.y;
  model.updateMatrixWorld(true);

  createCharacterUnderwear(model);

  const idleClip = idleSource?.animations.find(clip => clip.tracks.length > 0) ?? null;
  return {
    model,
    idleClip,
    dimensions: { width: size.x / size.y * targetHeight, height: targetHeight, depth: size.z / size.y * targetHeight },
  };
}

async function convertUnityMetallicSmoothness(file, prefix) {
  const source = await textureLoader.loadAsync(`${ASSET_ROOT}textures/${file}`);
  const image = source.image;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = width;
  inputCanvas.height = height;
  const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
  inputContext.drawImage(image, 0, 0);
  const { data } = inputContext.getImageData(0, 0, width, height);
  const metalness = document.createElement('canvas');
  const roughness = document.createElement('canvas');
  metalness.width = roughness.width = width;
  metalness.height = roughness.height = height;
  const metalContext = metalness.getContext('2d');
  const roughContext = roughness.getContext('2d');
  const metalData = metalContext.createImageData(width, height);
  const roughData = roughContext.createImageData(width, height);
  for (let i = 0; i < data.length; i += 4) {
    // Unity packs metallic in R and smoothness in A; Three.js samples
    // metalness from B and roughness from G.
    metalData.data[i + 2] = data[i];
    metalData.data[i + 3] = 255;
    roughData.data[i + 1] = 255 - data[i + 3];
    roughData.data[i + 3] = 255;
  }
  metalContext.putImageData(metalData, 0, 0);
  roughContext.putImageData(roughData, 0, 0);
  const metalTexture = new THREE.CanvasTexture(metalness);
  const roughTexture = new THREE.CanvasTexture(roughness);
  metalTexture.colorSpace = roughTexture.colorSpace = THREE.NoColorSpace;
  metalTexture.anisotropy = roughTexture.anisotropy = 8;
  textureCache.set(`${prefix}-metalness`, metalTexture);
  textureCache.set(`${prefix}-roughness`, roughTexture);
  source.dispose();
}
