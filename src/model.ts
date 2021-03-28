import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import {Dtex, TextureType} from './dtex.js';
import {Dugn, Cell} from './dugn.js';
import {LibModule} from './lib.js';

type Qnt = {width: number, height: number, hasAlpha: boolean, buf: Uint8Array};

interface Disposable {
    dispose(): void;
}

export class DungeonModel extends THREE.Group {
    private resources: Disposable[] = [];
    private planeGeometry: THREE.PlaneGeometry;
    private materials: THREE.MeshBasicMaterial[][] = [];

    constructor(dgn: Dugn, private dtx: Dtex, private lib: LibModule) {
        super();
        this.planeGeometry = this.track(new THREE.PlaneGeometry(1, 1));
        let i = 0;
        for (let z = 0; z < dgn.sizeZ; z++) {
            for (let y = 0; y < dgn.sizeY; y++) {
                for (let x = 0; x < dgn.sizeX; x++) {
                    const cell = dgn.cellAt(x, y, dgn.sizeZ - 1 - z);
                    this.addCell(x, y, z, cell);
                }
            }
        }
    }

    private addCell(x: number, y: number, z: number, cell: Cell) {
        if (cell.floor_texture >= 0) {
            const plane = this.addPlane(TextureType.Ceiling, cell.floor_texture);
            plane.rotation.x = Math.PI / -2;
            plane.position.set(x + 0.5, y, z + 0.5);
        }
        if (cell.ceiling_texture >= 0) {
            const plane = this.addPlane(TextureType.Floor, cell.ceiling_texture);
            plane.rotation.x = Math.PI / 2;
            plane.position.set(x + 0.5, y + 1.0, z + 0.5);
        }
        if (cell.north_texture >= 0) {
            const plane = this.addPlane(TextureType.Wall, cell.north_texture);
            plane.position.set(x + 0.5, y + 0.5, z);
        }
        if (cell.south_texture >= 0) {
            const plane = this.addPlane(TextureType.Wall, cell.south_texture);
            plane.rotation.y = Math.PI;
            plane.position.set(x + 0.5, y + 0.5, z + 1.0);
        }
        if (cell.east_texture >= 0) {
            const plane = this.addPlane(TextureType.Wall, cell.east_texture);
            plane.rotation.y = Math.PI / -2;
            plane.position.set(x + 1.0, y + 0.5, z + 0.5);
        }
        if (cell.west_texture >= 0) {
            const plane = this.addPlane(TextureType.Wall, cell.west_texture);
            plane.rotation.y = Math.PI / 2;
            plane.position.set(x, y + 0.5, z + 0.5);
        }
        if (cell.north_door >= 0) {
            const plane = this.addPlane(TextureType.Door, cell.north_door);
            plane.position.set(x + 0.5, y + 0.5, z);
        }
        if (cell.south_door >= 0) {
            const plane = this.addPlane(TextureType.Door, cell.south_door);
            plane.rotation.y = Math.PI;
            plane.position.set(x + 0.5, y + 0.5, z + 1.0);
        }
        if (cell.east_door >= 0) {
            const plane = this.addPlane(TextureType.Door, cell.east_door);
            plane.rotation.y = Math.PI / -2;
            plane.position.set(x + 1.0, y + 0.5, z + 0.5);
        }
        if (cell.west_door >= 0) {
            const plane = this.addPlane(TextureType.Door, cell.west_door);
            plane.rotation.y = Math.PI / 2;
            plane.position.set(x, y + 0.5, z + 0.5);
        }
        if (cell.stairs_texture >= 0) {
            const plane = this.addPlane(TextureType.Stairs, cell.stairs_texture);
            plane.scale.y = Math.sqrt(2);
            plane.position.set(x + 0.5, y + 0.5, z + 0.5);
            plane.rotation.x = Math.PI / -4;
            plane.rotation.y = Math.PI / 2 * cell.stairs_orientation;
            plane.rotation.order = "ZYX";
        }
    }

    private addPlane(type: number, textureIndex: number) {
        const material = this.getMaterial(type, textureIndex);
        const plane = new THREE.Mesh(this.planeGeometry, material);
        this.add(plane);
        return plane;
    }

    private getMaterial(type: number, index: number): THREE.MeshBasicMaterial {
        if (!this.materials[type])
            this.materials[type] = [];
        if (!this.materials[type][index]) {
            const textureData = this.dtx.get(type, index);
            const params: THREE.MeshBasicMaterialParameters = {};
            if (!textureData) {
                params.color = 0x6699FF;
            } else {
                const qnt = decodeQnt(this.lib, textureData);
                const texture = this.track(new THREE.DataTexture(qnt.buf, qnt.width, qnt.height, THREE.RGBAFormat, THREE.UnsignedByteType));
                texture.flipY = true;
                params.map = texture;
                params.transparent = qnt.hasAlpha;
            }
            this.materials[type][index] = this.track(new THREE.MeshBasicMaterial(params));
        }
        return this.materials[type][index];
    }

    private track<T extends Disposable>(obj: T): T {
        this.resources.push(obj);
        return obj;
    }

    dispose() {
        for (const obj of this.resources) {
            obj.dispose();
        }
        this.resources = [];
    }
}

function decodeQnt(lib: LibModule, buf: Uint8Array): Qnt {
    const ptr = lib._malloc(buf.byteLength);
    lib.HEAPU8.set(buf, ptr);
    const decoded = lib._qnt_extract(ptr);
    lib._free(ptr);
    if (decoded === 0)
        throw new Error('qnt_extract failed');
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const ofs = dv.getUint32(4, true) === 0 ? 0 : 4;
    const width = dv.getUint32(16 + ofs, true);
    const height = dv.getUint32(20 + ofs, true);
    const hasAlpha = dv.getUint32(36 + ofs, true) !== 0;
    const pixels: Uint8Array = lib.HEAPU8.slice(decoded, decoded + width * height * 4);
    lib._free(decoded);
    return {width, height, hasAlpha, buf: pixels};
}