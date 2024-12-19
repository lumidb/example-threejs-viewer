import * as THREE from "three";

export class CustomPointMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            glslVersion: "300 es",

            uniforms: {
                uColorMode: { value: 3 },
                uPointSize: { value: 5.0 },
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
                    else if (uColorMode == 4) {
                        /* POINT SOURCE ID */
                        vColor = randomColor(point_source_id);
                    }
                    else if (uColorMode == 5) {
                        /* SOURCE FILE ID */
                        vColor = randomColor(float(source_file_id));
                    } else {
                        vColor=vec3(1.0,0.0,0.0);
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

    setColorMode(colorMode: number) {
        this.uniforms.uColorMode.value = colorMode;
    }

    setPointSize(pointSize: number) {
        this.uniforms.uPointSize.value = pointSize;
    }
}
