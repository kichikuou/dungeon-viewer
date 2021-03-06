import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import { DungeonCollection } from './dungeon_collection.js';
import { DungeonModel, CellModel, PolyObjModelFactory } from './model.js';
import createLib from './lib.js';
import { Matrix4 } from "https://unpkg.com/three@0.126.1/build/three.module.js";
export const $ = document.querySelector.bind(document);
const sjisDecoder = new TextDecoder('shift-jis');
class DungeonViewer {
    constructor(lib) {
        this.lib = lib;
        this.polyModelFactory = null;
        this.renderer = new THREE.WebGLRenderer();
        this.camera = new THREE.PerspectiveCamera(50, 800 / 600, 1, 200);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.raycaster = new THREE.Raycaster();
        this.scene = null;
        this.model = null;
        this.selectionMarker = new SelectionMarker();
        this.visibilityMarker = new VisibilityMarker();
        this.dirty = false;
        this.renderer.setSize(800, 600);
        $('#viewer').appendChild(this.renderer.domElement);
        setClickHandler(this.renderer.domElement, this.onCanvasClick.bind(this));
        this.controls.enableDamping = true;
        this.controls.addEventListener('change', () => this.dirty = true);
        this.raycaster.near = this.camera.near;
        $('#show-pvs-check').addEventListener('change', () => {
            if ($('#show-pvs-check').checked)
                this.scene.add(this.visibilityMarker);
            else
                this.scene.remove(this.visibilityMarker);
            this.dirty = true;
        });
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
        if (!this.polyModelFactory) {
            const po = await dungeons.getPolyObj();
            if (po) {
                this.polyModelFactory = new PolyObjModelFactory(po, this.lib);
            }
        }
        if (this.model) {
            this.model.dispose();
        }
        this.model = new DungeonModel(dgn, dtx, this.polyModelFactory, this.lib);
        this.scene = new THREE.Scene();
        this.scene.add(this.model);
        if ($('#show-pvs-check').checked)
            this.scene.add(this.visibilityMarker);
        this.camera.position.set(dgn.sizeX, dgn.sizeY * 4, 40);
        this.controls.target.set(dgn.sizeX - 1, dgn.sizeY - 1, -dgn.sizeZ - 1);
        this.dirty = true;
        $('#cellinfo').hidden = true;
        $('#cellinfo-rance6').hidden = true;
        $('#cellinfo-galzoo').hidden = true;
        $('#show-pvs').hidden = true;
        this.visibilityMarker.clearPVS();
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
            this.visibilityMarker.clearPVS();
            return;
        }
        this.selectCell(obj.x, obj.y, obj.z);
    }
    selectCell(x, y, z) {
        if (!this.model) {
            return;
        }
        const cell = this.model.dgn.cellAt(x, y, z);
        this.scene.add(this.selectionMarker);
        this.selectionMarker.position.set(x * 2, y * 2, z * -2);
        this.dirty = true;
        this.visibilityMarker.setPVS(this.model.dgn.pvsAt(x, y, z));
        // Scenario coordinates: Used in scenario files (before being transformed
        // by CDungeon::TransMapPos()). X increases from west to east, Y increases
        // from north to south, Z increases from down to up.
        $('#scenario-coords').innerText = `(${x + 1}, ${this.model.sizeZ - z}, ${y + 1})`;
        // Dungeon coordinates: Used in DrawDungeon.DLL. X increases from west
        // to east, Y increases from down to up, Z increases from south to north.
        $('#dungeon-coords').innerText = `(${x}, ${y}, ${z})`;
        for (let i = 0; i < 35; i++) {
            $('#cell-attr' + i).innerText = cell.getAttr(i) + '';
        }
        $('#cell-unknown1').innerText = cell.unknown1 + '';
        $('#cell-unknown2').innerText = cell.unknown2 + '';
        $('#cellinfo').hidden = false;
        $('#show-pvs').hidden = false;
        if (cell.version == 10) {
            for (let i = 0; i < 6; i++) {
                $('#cell-rance6-num' + (i + 1)).innerText = cell.pairs[i].n + '';
                $('#cell-rance6-str' + (i + 1)).innerText = '"' + sjisDecoder.decode(cell.pairs[i].s) + '"';
            }
            $('#cellinfo-rance6').hidden = false;
        }
        else if (cell.version == 13) {
            $('#cell-galzoo178').innerText = cell.polyobj_index + '';
            if (cell.polyobj_index >= 0) {
                const name = this.polyModelFactory.polyobj.objects[cell.polyobj_index].name;
                $('#cell-galzoo178').innerText += ' (' + sjisDecoder.decode(name) + ')';
            }
            $('#cell-galzoo182').innerText = cell.polyobj_scale.toFixed(3);
            $('#cell-galzoo186').innerText = cell.polyobj_rotationY.toFixed(3);
            $('#cell-galzoo190').innerText = cell.polyobj_rotationZ.toFixed(3);
            $('#cell-galzoo194').innerText = cell.polyobj_rotationX.toFixed(3);
            $('#cell-galzoo198').innerText = cell.polyobj_positionX.toFixed(3);
            $('#cell-galzoo202').innerText = cell.polyobj_positionY.toFixed(3);
            $('#cell-galzoo206').innerText = cell.polyobj_positionZ.toFixed(3);
            $('#cell-galzoo210').innerText = cell.roof_orientation + '';
            $('#cell-galzoo214').innerText = cell.roof_texture + '';
            $('#cell-galzoo222').innerText = cell.roof_underside_texture + '';
            $('#cellinfo-galzoo').hidden = false;
        }
    }
}
class SelectionMarker extends THREE.Mesh {
    constructor() {
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
        super(geometry, material);
    }
}
class VisibilityMarker extends THREE.InstancedMesh {
    constructor() {
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
        super(geometry, material, 5000);
    }
    setPVS(pvs) {
        const cells = pvs.getVisibleCells();
        this.count = cells.length;
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            this.setMatrixAt(i, new Matrix4().makeTranslation(c.x * 2, c.y * 2, c.z * -2));
        }
        this.instanceMatrix.needsUpdate = true;
    }
    clearPVS() {
        this.count = 0;
    }
}
function setClickHandler(element, handler) {
    let dragged = false;
    element.addEventListener('pointerdown', () => dragged = false);
    element.addEventListener('pointermove', () => dragged = true);
    element.addEventListener('click', (ev) => {
        if (!dragged)
            handler(ev);
    });
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
        window.viewer = viewer;
        $('.usage').hidden = true;
    }
    viewer.view(dungeons, ids[0]);
}
