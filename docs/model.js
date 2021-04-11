import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { TextureType } from './dtex.js';
const planeGeometry = new THREE.PlaneGeometry(1, 1);
const stairsGeometry = createStairsGeometry();
export class DungeonModel extends THREE.Group {
    constructor(dgn, dtx, polyFactory, lib) {
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
    constructor(x, y, z, cell, materials, polyFactory) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
        this.cell = cell;
        if (cell.floor_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Floor, cell.floor_texture));
            plane.rotation.x = Math.PI / -2;
            plane.position.set(x + 0.5, y, z + 0.5);
        }
        if (cell.ceiling_texture >= 0) {
            const plane = this.addPlane(materials.get(TextureType.Ceiling, cell.ceiling_texture));
            plane.rotation.x = Math.PI / 2;
            plane.rotation.z = Math.PI;
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
            const stairs = this.addStairs(materials.get(TextureType.Stairs, cell.stairs_texture));
            stairs.position.set(x + 0.5, y + 0.5, z + 0.5);
            stairs.rotation.y = Math.PI / 2 * cell.stairs_orientation;
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
    addPlane(material) {
        const plane = new THREE.Mesh(planeGeometry, material);
        this.add(plane);
        return plane;
    }
    addStairs(material) {
        const stairs = new THREE.Mesh(stairsGeometry, material);
        this.add(stairs);
        return stairs;
    }
}
class ResourceManager {
    constructor() {
        this.resources = [];
    }
    track(obj) {
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
    constructor(dtx, lib) {
        super();
        this.dtx = dtx;
        this.lib = lib;
        this.materials = [];
    }
    get(type, index) {
        if (!this.materials[type])
            this.materials[type] = [];
        if (!this.materials[type][index]) {
            const textureData = this.dtx.get(type, index);
            const params = {};
            if (!textureData) {
                params.color = 0x6699FF;
            }
            else {
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
    constructor(polyobj, lib) {
        super();
        this.polyobj = polyobj;
        this.lib = lib;
        this.models = [];
        this.materials = [];
    }
    createModel(index) {
        if (this.models[index]) {
            return this.models[index].clone();
        }
        const obj = this.polyobj.objects[index];
        const model = new THREE.Group();
        for (const part of obj.parts) {
            const positions = [];
            const uvs = [];
            for (const triangle of part.triangles) {
                if (!positions[triangle.material]) {
                    positions[triangle.material] = [];
                    uvs[triangle.material] = [];
                }
                for (const i of [0, 2, 1]) { // left->right handed system
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
    getMaterial(index) {
        if (!this.materials[index]) {
            const textureData = this.polyobj.textures[index];
            const qnt = decodeQnt(this.lib, textureData);
            const texture = this.track(new THREE.DataTexture(qnt.buf, qnt.width, qnt.height, THREE.RGBAFormat, THREE.UnsignedByteType));
            const params = { map: texture, transparent: qnt.hasAlpha };
            this.materials[index] = this.track(new THREE.MeshBasicMaterial(params));
        }
        return this.materials[index];
    }
}
function createStairsGeometry() {
    const vertices = [
        { pos: [0, 6 / 6, 0 / 6], uv: [0, 12 / 12] },
        { pos: [1, 6 / 6, 0 / 6], uv: [1, 12 / 12] },
        { pos: [0, 6 / 6, 1 / 6], uv: [0, 11 / 12] },
        { pos: [1, 6 / 6, 1 / 6], uv: [1, 11 / 12] },
        { pos: [0, 5 / 6, 1 / 6], uv: [0, 10 / 12] },
        { pos: [1, 5 / 6, 1 / 6], uv: [1, 10 / 12] },
        { pos: [0, 5 / 6, 2 / 6], uv: [0, 9 / 12] },
        { pos: [1, 5 / 6, 2 / 6], uv: [1, 9 / 12] },
        { pos: [0, 4 / 6, 2 / 6], uv: [0, 8 / 12] },
        { pos: [1, 4 / 6, 2 / 6], uv: [1, 8 / 12] },
        { pos: [0, 4 / 6, 3 / 6], uv: [0, 7 / 12] },
        { pos: [1, 4 / 6, 3 / 6], uv: [1, 7 / 12] },
        { pos: [0, 3 / 6, 3 / 6], uv: [0, 6 / 12] },
        { pos: [1, 3 / 6, 3 / 6], uv: [1, 6 / 12] },
        { pos: [0, 3 / 6, 4 / 6], uv: [0, 5 / 12] },
        { pos: [1, 3 / 6, 4 / 6], uv: [1, 5 / 12] },
        { pos: [0, 2 / 6, 4 / 6], uv: [0, 4 / 12] },
        { pos: [1, 2 / 6, 4 / 6], uv: [1, 4 / 12] },
        { pos: [0, 2 / 6, 5 / 6], uv: [0, 3 / 12] },
        { pos: [1, 2 / 6, 5 / 6], uv: [1, 3 / 12] },
        { pos: [0, 1 / 6, 5 / 6], uv: [0, 2 / 12] },
        { pos: [1, 1 / 6, 5 / 6], uv: [1, 2 / 12] },
        { pos: [0, 1 / 6, 6 / 6], uv: [0, 1 / 12] },
        { pos: [1, 1 / 6, 6 / 6], uv: [1, 1 / 12] },
        { pos: [0, 0 / 6, 6 / 6], uv: [0, 0 / 12] },
        { pos: [1, 0 / 6, 6 / 6], uv: [1, 0 / 12] },
    ];
    const indices = [];
    for (let i = 0; i < 12; i++) {
        indices.push(i * 2 + 0, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const positions = new Float32Array(vertices.length * 3);
    const uvs = new Float32Array(vertices.length * 2);
    for (let i = 0; i < vertices.length; i++) {
        positions.set(vertices[i].pos, i * 3);
        uvs.set(vertices[i].uv, i * 2);
    }
    for (let i = 0; i < vertices.length * 3; i++) {
        positions[i] -= 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
}
function decodeQnt(lib, buf) {
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
    const pixels = lib.HEAPU8.slice(decoded, decoded + width * height * 4);
    lib._free(decoded);
    return { width, height, hasAlpha, buf: pixels };
}
