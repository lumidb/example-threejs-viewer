import { LumiDB, PointCloudMaterial } from "@lumidb/lumidb";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const LUMIDB_URL = "https://staging.lumidb.com";
const TABLE_NAME = "hesa_async";

// Set up a minimal 3D viewer with three.js

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 10_000);
camera.up.set(0, 0, 1);
camera.position.set(0, -3000, 2000);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.autoRotate = true;
controls.addEventListener("end", () => {
    controls.autoRotate = false;
});

const scene = new THREE.Scene();

const loadingCube = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshNormalMaterial());
scene.add(loadingCube);

function animate() {
    requestAnimationFrame(animate);
    loadingCube.rotateZ(0.05);
    controls.update();
    renderer.render(scene, camera);
}

const pointsMaterial = new PointCloudMaterial({
    colorMode: "rgb",
    pointSize: 2.0,
});

document.querySelector("#viewer")?.appendChild(renderer.domElement);

async function initializeTiles() {
    // Initialize the LumiDB client
    const apikey = sessionStorage.getItem("lumidb-apikey") ?? prompt("Enter your LumiDB API key:");
    if (!apikey) {
        throw new Error("No API key provided.");
    }

    sessionStorage.setItem("lumidb-apikey", apikey);

    const lumidb = new LumiDB({ baseUrl: LUMIDB_URL, auth: { apikey: apikey } });

    // Get the tileset
    const tileset = await lumidb.get3DTileset({
        tableName: TABLE_NAME,
        output_format: "json",
        outputProj: "EPSG:3857",
        queryBoundary: null,
        classFilter: null,
        sourceFileFilter: null,
    });

    // Load the root tile
    const loadedNodes = new Set<string>();
    const rootTile = await lumidb.get3DTile({
        tableName: TABLE_NAME,
        content: tileset.root.content,
        output_type: "threejs",
    });
    const threePoints = new THREE.Points(rootTile.pointGeometry, pointsMaterial);
    scene.add(threePoints);
    scene.remove(loadingCube);
    loadedNodes.add(tileset.root.content.uri);
    const rootOffset = new THREE.Vector3().fromArray(rootTile.offset);

    async function loadMore() {
        const nodesToLoad: Array<[typeof tileset.root, number]> = [];

        // Walk the hierarchy in BFS order to find the next nodes to load
        const queue = [tileset.root];
        while (true) {
            const node = queue.shift();
            if (!node) {
                break;
            }

            // Estimate the view-space error based on the distance to the camera.
            // We'd probably want to check if it's in the frustum too.
            const center = getCenter(node.boundingVolume.region).sub(rootOffset);
            const error = node.geometricError / new THREE.Vector3().subVectors(center, camera.position).length();

            if (!loadedNodes.has(node.content.uri)) {
                nodesToLoad.push([node, error]);
            }

            // No need to walk the subrees if the error is small.
            if (error > 0.01) {
                for (const child of node.children) {
                    queue.push(child);
                }
            }
        }

        // Sort the nodes by error, so we load the most important ones first.
        nodesToLoad.sort((a, b) => b[1] - a[1]);

        // Only load first 10 nodes.
        nodesToLoad.splice(10);

        for (const [node, _] of nodesToLoad) {
            const tileData = await lumidb.get3DTile({
                tableName: TABLE_NAME,
                content: node.content,
                output_type: "threejs",
            });

            const offset = new THREE.Vector3().subVectors(new THREE.Vector3().fromArray(tileData.offset), rootOffset);
            const threePoints = new THREE.Points(tileData.pointGeometry, pointsMaterial);
            threePoints.position.copy(offset);
            scene.add(threePoints);
        }
    }

    // bind the loadMore function to the button
    const pointsButton = document.getElementById("load-more-points");
    pointsButton?.addEventListener("click", () => {
        loadMore().catch((error) => {
            document.body.innerHTML = "Error: " + error;
        });
    });
    pointsButton?.style.setProperty("visibility", "visible");
}

// Get the center of a 3D tileset bounding volume.
// Order of the bounding volume is [west, south, east, north, bottom, top]
function getCenter(bounds: number[]) {
    return new THREE.Vector3((bounds[2] + bounds[0]) / 2, (bounds[3] + bounds[1]) / 2, (bounds[5] + bounds[4]) / 2);
}

animate();

initializeTiles().catch((error) => {
    document.body.innerHTML = "Error: " + error;
});
