import * as THREE from "three";

export const ColorMode = {
    rgb: 1,
    intensity: 2,
    classification: 3,
};

/** Example for implementing a custom material for rendering the points.
 *  NOTE: Not currently used in the example by default. */
export class ExampleCustomPointMaterial extends THREE.ShaderMaterial {
    constructor(pointSize: number) {
        super({
            glslVersion: "300 es",

            uniforms: {
                uColorMode: { value: ColorMode["rgb"] },
                uPointSize: { value: pointSize },
            },

            vertexShader: `
                uniform float uPointSize;
                uniform int uColorMode;

                // Attributes from the LumiDB response bufferGeometry:
                in vec3 color;
                in float classification;
                in float point_source_id;
                in float intensity;
                in int source_file_id;

                out vec3 vColor;

                vec3 randomColor(float x) {
                    return vec3(
                        0.5 + 0.5 * cos(6.0 * (3.0 * x + 0.00)),
                        0.5 + 0.5 * cos(6.0 * (3.0 * x + 0.33)),
                        0.5 + 0.5 * cos(6.0 * (3.0 * x + 0.66))
                    );
                }

                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = uPointSize;

                    if (uColorMode == 1) {
                        /* RGB */
                        vColor = color;
                    }
                    else if (uColorMode == 2) {
                        /* INTENSITY */
                        vColor = vec3(intensity);
                    }
                    else if (uColorMode == 3) {
                        /* CLASSIFICATION */
                        vColor = randomColor(classification);
                    }
                    else {
                        vColor = vec3(1.0,0.0,0.0);
                    }
                }
            `,

            fragmentShader: `
                in vec3 vColor;
                out vec4 FragColor;

                void main() {
                    // make points circular
                    float u = 2.0 * gl_PointCoord.x - 1.0;
                    float v = 2.0 * gl_PointCoord.y - 1.0;
                    if (u * u + v * v > 1.0) { discard; }

                    FragColor = vec4(vColor, 1.0);
                }
            `,
        });
    }

    setColorMode(colorMode: keyof typeof ColorMode) {
        this.uniforms.uColorMode.value = ColorMode[colorMode];
    }

    setPointSize(pointSize: number) {
        this.uniforms.uPointSize.value = pointSize;
    }
}
