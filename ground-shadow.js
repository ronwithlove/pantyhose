import { Box3, Matrix4, ShaderChunk, Vector2, Vector3, Vector4 } from 'three';

// Narrow, medium, and wide filters in light-space scene units. A blocker
// gradually contributes to a wider filter as its height above the ground grows.
const filters = [
  { radius: .014, taps: 5, band: 'x' },
  { radius: .075, taps: 8, band: 'y' },
  { radius: .175, taps: 12, band: 'z' },
];

function filterSamples({ radius, taps, band }) {
  const points = Array.from({ length: taps }, (_, index) => {
    const distance = radius * Math.sqrt((index + .5) / taps);
    const angle = index * 2.39996323;
    const x = (Math.cos(angle) * distance).toFixed(6);
    const y = (Math.sin(angle) * distance).toFixed(6);
    return `groundShadowSample(shadowMap, receiver, vec2(${x}, ${y}) * groundShadowUvPerUnit).${band}`;
  });
  return `(${points.join(' +\n    ')}) / ${taps.toFixed(1)}`;
}

const shadowShader = `
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
uniform vec3 groundShadowHeight;
uniform vec2 groundShadowUvPerUnit;
uniform vec4 groundShadowBounds;

vec3 groundShadowSample(sampler2D shadowMap, vec3 receiver, vec2 offset) {
  float depth = unpackRGBAToDepth(texture2D(shadowMap, receiver.xy + offset));
  if (depth >= 1.0) return vec3(0.0);

  // The inverse shadow transform gives the caster's height relative to the
  // receiving surface, including the sample's displacement in light space.
  float height = dot(groundShadowHeight, vec3(offset, depth - receiver.z));
  if (height <= 0.0) return vec3(0.0);

  float opacity = 0.70 * (1.0 - smoothstep(0.34, 1.76, height));
  float soft = smoothstep(0.20, 1.22, height);
  float wide = smoothstep(0.46, 1.57, height);
  return opacity * vec3(1.0 - soft, soft - wide, wide);
}

float getGroundShadow(sampler2D shadowMap, vec2 mapSize, float intensity,
                      float bias, float radius, vec4 shadowCoord) {
  vec3 receiver = shadowCoord.xyz / shadowCoord.w;
  vec2 border = 1.0 / mapSize;
  vec2 minimum = max(groundShadowBounds.xy, border);
  vec2 maximum = min(groundShadowBounds.zw, 1.0 - border);
  if (receiver.z > 1.0 || any(lessThan(receiver.xy, minimum)) ||
      any(greaterThan(receiver.xy, maximum))) return 1.0;

  float shadow = ${filters.map(filterSamples).join(' +\n    ')};
  return 1.0 - intensity * clamp(shadow, 0.0, 1.0);
}
#endif
`;

export function setupGroundShadows(keyLight, surfaces) {
  const inverseShadowMatrix = new Matrix4();
  // Conservative bounds around the animated legs and the portion of the shadow
  // that can still be visible. Skip filtering on the rest of the large floor.
  const casterBounds = new Box3(new Vector3(-.65, 0, -.65), new Vector3(.65, 1.84, .65));
  const shadowBounds = new Box3();
  const uniforms = {
    groundShadowHeight: { value: new Vector3() },
    groundShadowUvPerUnit: { value: new Vector2() },
    groundShadowBounds: { value: new Vector4() },
  };

  function updateUniforms() {
    const { camera, matrix } = keyLight.shadow;
    const elements = inverseShadowMatrix.copy(matrix).invert().elements;
    uniforms.groundShadowHeight.value.set(elements[1], elements[5], elements[9]);
    const uv = uniforms.groundShadowUvPerUnit.value.set(
      camera.zoom / (camera.right - camera.left),
      camera.zoom / (camera.top - camera.bottom),
    );
    const { min, max } = shadowBounds.copy(casterBounds).applyMatrix4(matrix);
    uniforms.groundShadowBounds.value.set(
      min.x - .18 * uv.x, min.y - .18 * uv.y, max.x + .18 * uv.x, max.y + .18 * uv.y,
    );
  }

  for (const surface of surfaces) {
    const { material } = surface;
    material.onBeforeRender = updateUniforms;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${shadowShader}`)
        .replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin.replace(
          'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
          'getGroundShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
        ));
    };
    material.customProgramCacheKey = () => 'ground-height-shadow';
  }
}
