import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import {Dtex, TextureType} from './dtex.js';
import {Dugn, Cell} from './dugn.js';
import {PolyObj} from './polyobj.js';
import {LibModule} from './lib.js';

type Qnt = {width: number, height: number, hasAlpha: boolean, buf: Uint8Array};

interface Disposable {
    dispose(): void;
}

const planeGeometry = new THREE.PlaneGeometry(1, 1);

export class DungeonModel extends THREE.Group {
    private materials: MaterialCache;
    public sizeX: number;
    public sizeY: number;
    public sizeZ: number;

    constructor(dgn: Dugn, dtx: Dtex, polyFactory: PolyObjModelFactory | null, lib: LibModule) {
        super();
        this.sizeX = dgn.sizeX;
        this.sizeY = dgn.sizeY;
        this.sizeZ = dgn.sizeZ;
        this.materials = new MaterialCache(dtx, lib);
        for (let z = 0; z < dgn.sizeZ; z++) {
            for (let y = 0; y < dgn.sizeY; y++) {
                for (let x = 0; x < dgn.sizeX; x++) {
                    const cell = dgn.cellAt(x, y, dgn.sizeZ - 1 - z);
                    this.add(new CellModel(x, y, z, cell, this.materials, polyFactory));
                }
            }
        }
    }

    dispose() {
        this.materials.dispose();
    }
}

export class CellModel extends THREE.Group {
    constructor(public x: number, public y: number, public z: number, public cell: Cell, materials: MaterialCache, polyFactory: PolyObjModelFactory | null) {
        super();
        if (cell.floor_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Ceiling, cell.floor_texture));
            plane.rotation.x = Math.PI / -2;
            plane.position.set(x + 0.5, y, z + 0.5);
        }
        if (cell.ceiling_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Floor, cell.ceiling_texture));
            plane.rotation.x = Math.PI / 2;
            plane.position.set(x + 0.5, y + 1.0, z + 0.5);
        }
        if (cell.north_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Wall, cell.north_texture));
            plane.position.set(x + 0.5, y + 0.5, z);
        }
        if (cell.south_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Wall, cell.south_texture));
            plane.rotation.y = Math.PI;
            plane.position.set(x + 0.5, y + 0.5, z + 1.0);
        }
        if (cell.east_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Wall, cell.east_texture));
            plane.rotation.y = Math.PI / -2;
            plane.position.set(x + 1.0, y + 0.5, z + 0.5);
        }
        if (cell.west_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Wall, cell.west_texture));
            plane.rotation.y = Math.PI / 2;
            plane.position.set(x, y + 0.5, z + 0.5);
        }
        if (cell.north_door >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Door, cell.north_door));
            plane.position.set(x + 0.5, y + 0.5, z);
        }
        if (cell.south_door >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Door, cell.south_door));
            plane.rotation.y = Math.PI;
            plane.position.set(x + 0.5, y + 0.5, z + 1.0);
        }
        if (cell.east_door >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Door, cell.east_door));
            plane.rotation.y = Math.PI / -2;
            plane.position.set(x + 1.0, y + 0.5, z + 0.5);
        }
        if (cell.west_door >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Door, cell.west_door));
            plane.rotation.y = Math.PI / 2;
            plane.position.set(x, y + 0.5, z + 0.5);
        }
        if (cell.stairs_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Stairs, cell.stairs_texture));
            plane.scale.y = Math.sqrt(2);
            plane.position.set(x + 0.5, y + 0.5, z + 0.5);
            plane.rotation.y = Math.PI / 2 * cell.stairs_orientation;
            plane.rotation.x = Math.PI / -4;
            plane.rotation.order = "ZYX";
        }
        if (polyFactory && cell.polyobj_index >= 0) {
            const obj = polyFactory.createModel(cell.polyobj_index);
            const scale = cell.polyobj_scale / 2;
            obj.scale.set(scale, scale, scale);
            obj.rotation.y = cell.polyobj_rotationY * Math.PI / -180;
            const posX = x + 0.5 + cell.polyobj_positionX / 2;
            const posY = y + cell.polyobj_positionY / 2;
            const posZ = z + 0.5 - cell.polyobj_positionZ / 2;
            obj.position.set(posX, posY, posZ);
            this.add(obj);
        }
        if (cell.roof_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Stairs, cell.roof_texture));
            plane.scale.y = Math.sqrt(2);
            plane.position.set(x + 0.5, y + 0.5, z + 0.5);
            plane.rotation.y = Math.PI / 2 * cell.roof_orientation;
            plane.rotation.x = Math.PI / -4;
            plane.rotation.order = "ZYX";
        }
        if (cell.roof_underside_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Stairs, cell.roof_underside_texture));
            plane.scale.y = Math.sqrt(2);
            plane.position.set(x + 0.5, y + 0.5, z + 0.5);
            plane.rotation.y = Math.PI + Math.PI / 2 * cell.roof_orientation;
            plane.rotation.x = Math.PI / 4;
            plane.rotation.order = "ZYX";
        }
    }

    private addPlane(material: THREE.MeshBasicMaterial) {
        const plane = new THREE.Mesh(planeGeometry, material);
        this.add(plane);
        return plane;
    }
}

class ResourceManager {
    private resources: Disposable[] = [];

    protected track<T extends Disposable>(obj: T): T {
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

class MaterialCache extends ResourceManager {
    private materials: THREE.MeshBasicMaterial[][] = [];

    constructor(private dtx: Dtex, private lib: LibModule) {
        super();
    }

    get(type: number, index: number): THREE.MeshBasicMaterial {
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
}

export class PolyObjModelFactory extends ResourceManager {
    private models: THREE.Group[] = [];
    private materials: THREE.MeshBasicMaterial[] = [];

    constructor(readonly polyobj: PolyObj, private lib: LibModule) {
        super();
    }

    createModel(index: number): THREE.Object3D {
        if (this.models[index]) {
            return this.models[index].clone();
        }

        const obj = this.polyobj.objects[index];
        const model = new THREE.Group();
        for (const part of obj.parts) {
            const positions: number[][] = [];
            const uvs: number[][] = [];
            for (const triangle of part.triangles) {
                if (!positions[triangle.material]) {
                    positions[triangle.material] = [];
                    uvs[triangle.material] = [];
                }
                for (const i of [0, 2, 1]) {  // left->right handed system
                    const pos = part.vertices[triangle.index[i]];
                    positions[triangle.material].push(pos.x, pos.y, -pos.z);
                    const uv = triangle.uv[i];
                    uvs[triangle.material].push(uv.u, uv.v);
                }
            }
            for (let i = 0; i < positions.length; i++) {
                if (!positions[i]) {
                    continue;
                }
                const geometry = this.track(new THREE.BufferGeometry());
                geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions[i]), 3));
                geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs[i]), 2));
                model.add(new THREE.Mesh(geometry, this.getMaterial(obj.materials[i])));
            }
        }
        this.models[index] = model;
        return model.clone();
    }

    private getMaterial(index: number): THREE.MeshBasicMaterial {
        if (!this.materials[index]) {
            const textureData = this.polyobj.textures[index];
            const qnt = decodeQnt(this.lib, textureData);
            const texture = this.track(new THREE.DataTexture(qnt.buf, qnt.width, qnt.height, THREE.RGBAFormat, THREE.UnsignedByteType));
            const params = {map: texture, transparent: qnt.hasAlpha};
            this.materials[index] = this.track(new THREE.MeshBasicMaterial(params));
        }
        return this.materials[index];
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
