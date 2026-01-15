import { LumiDB, PointCloudMaterial } from "@lumidb/lumidb";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const LUMIDB_URL = localStorage.getItem("LUMIDB_URL") ?? "https://lumidb.example.com";
const TABLE_NAME = localStorage.getItem("TABLE_NAME") ?? "example_table";
const APIKEY = localStorage.getItem("APIKEY") ?? "secret_api_key";

// Set up a minimal 3D viewer with three.js

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 50_000);
// LumiDB uses a Z-up right-handed coordinate system. Update the three.js camera to use Z-up too.
camera.up.set(0, 0, 1);
camera.position.set(0, -300, 300);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
document.querySelector("#viewer")?.appendChild(renderer.domElement);
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

// Set up LumiDB

// Define a custom material that will be used for points.
const pointsMaterial = new PointCloudMaterial({ pointSize: 3.0, colorMode: "rgb" });

// To use the example material from this repo, you could switch this to:
// const pointsMaterial = new ExampleCustomPointMaterial(5.0);

async function initializeTiles() {
    // Initialize the LumiDB client

    // This uses a static API key. For more secure usage, you can define a custom token callback function.
    // See: https://www.npmjs.com/package/@lumidb/lumidb#:~:text=js%20%2Dbased%20viewer.-,Authentication,-Option%201%3A%20Server
    const lumidb = new LumiDB({
        baseUrl: LUMIDB_URL,
        auth: { apikey: APIKEY },
    });

    const tableInfo = await lumidb.getTableMetadata(TABLE_NAME);

    console.log("table info:", tableInfo);

    // Get the 3D Tileset
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
    console.log({ rootTile });
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

            // The `geometricError` of each tile represents how close to each other the points of the tile are
            // (in world units). Large tiles have high geometricError; detailed leaf tiles have low values.
            //
            // The visibility of each tile is determined by the screen-space error. We estimate this by dividing the
            // geometricError by the distance to the tile. This is because far-away objects appear smaller on the screen.
            //
            // A full implementation could use a more advanced heuristic and also check frustum visibility.
            const tileCenter = getCenter(tile.boundingVolume.region).sub(rootOffset);
            const distanceToCamera = new THREE.Vector3().subVectors(tileCenter, camera.position).length();
            const screenSpaceError = tile.geometricError / distanceToCamera;

            if (!loadedTiles.has(tile.tileId)) {
                tilesToLoad.push([tile, screenSpaceError]);
            }

            // Skip traversing children when viewError is below threshold - tile is detailed enough.
            // Lower threshold = more aggressive loading, higher quality.
            //
            // A full implementation might have a point budget or limit the total tile count too.
            if (screenSpaceError > 0.01) {
                if (tile.children)
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

// 3D Tileset bounding region is defined as [west, south, east, north, bottom, top]
function getCenter(region: number[]) {
    return new THREE.Vector3((region[0] + region[2]) / 2, (region[1] + region[3]) / 2, (region[4] + region[5]) / 2);
}

animate();

initializeTiles();
