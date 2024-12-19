import { LumiDB } from "@lumidb/lumidb";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CustomPointMaterial } from "./material";

// Set up a minimal 3D viewer with three.js

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 10_000);
camera.up.set(0, 0, 1);
camera.position.set(0, -300, 200);

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

document.querySelector("#viewer")?.appendChild(renderer.domElement);

async function loadPoints() {
    // Ask for the LumiDB API key, store it and fetch points from LumiDB
    const apikey = localStorage.getItem("lumidb-apikey") ?? prompt("Enter your LumiDB API key:");

    if (!apikey) {
        document.body.innerHTML = "No API key provided.";
        return;
    }

    localStorage.setItem("lumidb-apikey", apikey);

    const lumidb = new LumiDB("https://api.lumidb.com", apikey);

    const resp = await lumidb.query({
        tableName: "turku",
        queryBoundary: {
            Polygon: [
                [
                    [2488624, 8505802],
                    [2488741, 8505971],
                    [2489471, 8505522],
                    [2489248, 8505339],
                    [2488624, 8505802],
                ],
            ],
        },
        queryCRS: "EPSG:3857",
        maxPoints: 5_000_000,
        maxDensity: null,
        sourceFileFilter: null,
        classFilter: null,
    });

    if (resp.pointCount === 0) {
        alert("The response contains no points!");
    } else {
        const material = new CustomPointMaterial();
        setInterval(() => {
            material.setColorMode(Math.floor(Math.random() * 5) + 1);
            material.setPointSize(Math.random() * 6.0);
        }, 2000);

        // or alternatively, you could use PointCloudMaterial provided by the library:
        // const material = new PointCloudMaterial({
        //     colorMode: "classification",
        //     pointSize: 3.0
        // });

        // or three.js builtin PointsMaterial
        // const material = new THREE.PointsMaterial({ size: 1, color: 0xff00ff, opacity: 0.7, transparent: true });

        scene.remove(loadingCube);
        scene.add(new THREE.Points(resp.pointGeometry, material));
    }
}

animate();
loadPoints();
