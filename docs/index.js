import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { DungeonCollection } from './dungeon_collection.js';
import { DungeonModel, CellModel } from './model.js';
import createLib from './lib.js';
export const $ = document.querySelector.bind(document);
class DungeonViewer {
    constructor(lib) {
        this.lib = lib;
        this.renderer = new THREE.WebGLRenderer();
        this.camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.5, 100);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.raycaster = new THREE.Raycaster();
        this.scene = null;
        this.model = null;
        this.selectionMarker = new SelectionMarker();
        this.dirty = false;
        this.renderer.setSize(800, 600);
        $('#viewer').appendChild(this.renderer.domElement);
        this.renderer.domElement.addEventListener('click', this.onCanvasClick.bind(this));
        this.controls.enableDamping = true;
        this.controls.addEventListener('change', () => this.dirty = true);
        this.raycaster.near = this.camera.near;
        const tick = () => {
            requestAnimationFrame(tick);
            this.controls.update();
            if (this.scene && this.dirty) {
                this.renderer.render(this.scene, this.camera);
                this.dirty = false;
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
        $('table.cell-info').hidden = true;
    }
    onCanvasClick(evt) {
        if (!this.model) {
            return;
        }
        this.dirty = true;
        const canvas = this.renderer.domElement;
        const x = (window.scrollX + evt.clientX - canvas.offsetLeft) / canvas.offsetWidth * 2 - 1;
        const y = (window.scrollY + evt.clientY - canvas.offsetTop) / canvas.offsetHeight * -2 + 1;
        this.raycaster.setFromCamera({ x, y }, this.camera);
        const intersects = this.raycaster.intersectObjects(this.model.children, true);
        let obj = intersects[0] ? intersects[0].object : null;
        while (obj && !(obj instanceof CellModel)) {
            obj = obj.parent;
        }
        if (!obj) {
            this.scene.remove(this.selectionMarker);
            return;
        }
        this.scene.add(this.selectionMarker);
        this.selectionMarker.position.set(obj.x + 0.5, obj.y + 0.5, obj.z + 0.5);
        const cell = obj.cell;
        $('#cell-coords').innerText = `(${obj.x + 1}, ${obj.z + 1}, ${obj.y + 1})`;
        for (let i = 0; i < 35; i++) {
            $('#cell-attr' + i).innerText = cell.getAttr(i) + '';
        }
        $('table.cell-info').hidden = false;
    }
}
class SelectionMarker extends THREE.Mesh {
    constructor() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
        super(geometry, material);
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
