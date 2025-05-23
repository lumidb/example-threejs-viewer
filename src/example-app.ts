import { LumiDB, PointCloudMaterial } from "@lumidb/lumidb";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const LUMIDB_URL = "https://lumidb.example.com";
const TABLE_NAME = "example_table";

// Set up a minimal 3D viewer with three.js
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 50_000);
camera.up.set(0, 0, 1);
camera.position.set(0, -3000, 3000);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new MapControls(camera, renderer.domElement);
controls.autoRotate = true;
controls.addEventListener("end", () => {
    controls.autoRotate = false;
});

const scene = new THREE.Scene();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

const pointsMaterial = new PointCloudMaterial({
    colorMode: "rgb",
    pointSize: 3.0,
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

    // Keep track of loaded tiles to avoid loading same tile multiple times.
    const loadedTiles = new Set<string>();

    // Load the root tile
    const rootTile = await lumidb.get3DTile({
        tableName: TABLE_NAME,
        content: tileset.root.content,
        output_type: "threejs",
    });
    const rootPoints = new THREE.Points(rootTile.pointGeometry, pointsMaterial);
    scene.add(rootPoints);
    loadedTiles.add(tileset.root.tileId);

    // For simplicity, we'll center everything around the root tile.
    const rootOffset = new THREE.Vector3().fromArray(rootTile.offset);

    async function loadMore() {
        const tilesToLoad: Array<[typeof tileset.root, number]> = [];

        // Walk the hierarchy in BFS order to evaluate the view-space error of each tile.
        const queue = [tileset.root];
        while (true) {
            const tile = queue.shift();
            if (!tile) {
                break;
            }

            // Estimate the error based on the distance to the camera.
            // We'd probably want to check if it's in the frustum, and maybe prioritize nodes in the center of the screen.
            const center = getCenter(tile.boundingVolume.region).sub(rootOffset);
            const viewError = tile.geometricError / new THREE.Vector3().subVectors(center, camera.position).length();

            if (!loadedTiles.has(tile.tileId)) {
                tilesToLoad.push([tile, viewError]);
            }

            // No need to walk the subrees if the error is small.
            if (viewError > 0.01) {
                for (const child of tile.children) {
                    queue.push(child);
                }
            }
        }

        console.log("Tiles to load:", tilesToLoad.length);

        // Sort the tiles by error, so we load the most important ones first.
        tilesToLoad.sort((a, b) => b[1] - a[1]);

        // Only load 10 nodes at a time.
        tilesToLoad.splice(10);

        for (const [tile, _] of tilesToLoad) {
            // Instead of awaiting here, we'd want to load the tiles in parallel.
            const tileData = await lumidb.get3DTile({
                tableName: TABLE_NAME,
                content: tile.content,
                output_type: "threejs",
            });

            const tileOffset = new THREE.Vector3().fromArray(tileData.offset).sub(rootOffset);
            const threePoints = new THREE.Points(tileData.pointGeometry, pointsMaterial);
            threePoints.position.copy(tileOffset);

            scene.add(threePoints);
            loadedTiles.add(tile.tileId);
        }
    }

    // For simplicity, bind the loadMore function to a button. In real usage, we'd want to load and unload tiles
    // in the background as the user navigates.
    const pointsButton = document.getElementById("load-more-points");
    pointsButton?.addEventListener("click", () => {
        loadMore().catch((error) => {
            console.error(error);
            document.body.innerHTML = "Error: " + error;
        });
    });
    pointsButton?.style.setProperty("visibility", "visible");
}

// 3D Tileset bounding region is defined as [west, south, bottom, east, north, top]
function getCenter(region: number[]) {
    return new THREE.Vector3((region[0] + region[2]) / 2, (region[1] + region[3]) / 2, (region[4] + region[5]) / 2);
}

animate();

initializeTiles();
