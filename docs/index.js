import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { DungeonCollection } from './dungeon_collection.js';
import { DungeonModel } from './model.js';
import createLib from './lib.js';
export const $ = document.querySelector.bind(document);
class DungeonViewer {
    constructor(lib) {
        this.lib = lib;
        this.renderer = new THREE.WebGLRenderer();
        this.camera = new THREE.PerspectiveCamera(50, 800 / 600, 1, 100);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.scene = null;
        this.model = null;
        this.dirty = false;
        this.renderer.setSize(800, 600);
        $('.content').appendChild(this.renderer.domElement);
        this.controls.enableDamping = true;
        const tick = () => {
            requestAnimationFrame(tick);
            if (this.scene && (this.controls.update() || this.dirty)) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        tick();
    }
    async view(dungeons, index) {
        const dgn = await dungeons.getDugn(index);
        const dtx = await dungeons.getDtex(index);
        if (this.model) {
            this.model.dispose();
        }
        this.model = new DungeonModel(dgn, dtx, this.lib);
        this.scene = new THREE.Scene();
        this.scene.add(this.model);
        this.camera.position.set(dgn.sizeX / 2, dgn.sizeY * 2, 50);
        this.controls.target.set(dgn.sizeX / 2, dgn.sizeY / 2, dgn.sizeZ / 2);
        this.dirty = true;
    }
}
const dungeons = new DungeonCollection();
let viewer;
document.body.addEventListener('dragover', (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
}, false);
document.body.addEventListener('drop', (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    handleFiles(evt.dataTransfer.files);
}, false);
$('#fileselect').addEventListener('change', (evt) => {
    let input = evt.target;
    handleFiles(input.files);
}, false);
$('#dungeon-id').addEventListener('change', async (evt) => {
    let input = evt.target;
    const index = Number(input.value);
    viewer.view(dungeons, index);
}, false);
async function handleFiles(files) {
    for (let file of files) {
        await dungeons.addFile(file);
    }
    const ids = dungeons.getIds();
    if (ids.length === 0) {
        return;
    }
    const select = $('#dungeon-id');
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }
    for (const id of ids) {
        const opt = document.createElement('option');
        opt.setAttribute('value', id + '');
        opt.textContent = id + '';
        select.appendChild(opt);
        select.hidden = false;
    }
    if (!viewer) {
        viewer = new DungeonViewer(await createLib());
        $('.usage').hidden = true;
    }
    viewer.view(dungeons, ids[0]);
}
