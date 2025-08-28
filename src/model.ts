import * as THREE from "three";
import {BufferReader} from './buffer.js';
import {Dtex, TextureType} from './dtex.js';
import {Dugn, Cell} from './dugn.js';
import {Dsa, DsaCell} from './dsa.js';
import {PolyObj} from './polyobj.js';
import {LibModule} from './lib.js';

type Image = {texture: THREE.DataTexture, hasAlpha: boolean};

interface Disposable {
    dispose(): void;
}

const planeGeometry = createPlaneGeometry();
const stairsGeometry = createStairsGeometry();

export class DungeonModel extends THREE.Group {
    private materials: MaterialCache;
    public sizeX: number;
    public sizeY: number;
    public sizeZ: number;
    set onTextureLoad(handler: () => void) {
        this.materials.onTextureLoad = handler;
    }

    constructor(readonly dgn: Dugn | Dsa, dtx: Dtex, polyFactory: PolyObjModelFactory | null, lib: LibModule) {
        super();
        this.sizeX = dgn.sizeX;
        this.sizeY = dgn.sizeY;
        this.sizeZ = dgn.sizeZ;
        this.materials = new MaterialCache(dtx, lib);
        for (let z = 0; z < dgn.sizeZ; z++) {
            for (let y = 0; y < dgn.sizeY; y++) {
                for (let x = 0; x < dgn.sizeX; x++) {
                    this.add(new CellModel(dgn, x, y, z, this.materials, polyFactory));
                }
            }
        }
    }

    dispose() {
        this.materials.dispose();
    }
}

export class CellModel extends THREE.Group {
    cell: Cell | DsaCell;

    constructor(dgn: Dugn | Dsa, public x: number, public y: number, public z: number, materials: MaterialCache, polyFactory: PolyObjModelFactory | null) {
        super();

        const cell = this.cell = dgn.cellAt(x, y, z);
        const [wx, wy, wz] = [x * 2, y * 2, -z * 2];
        if (cell.floor_texture >= 0) {
            const plane = this.addPlane(materials.get('floor', cell.floor_texture, cell.shadow_tex_floor));
            plane.rotation.x = Math.PI / -2;
            plane.position.set(wx, wy - 1, wz);
        }
        if (cell.ceiling_texture >= 0) {
            const plane = this.addPlane(materials.get('ceiling', cell.ceiling_texture, cell.shadow_tex_ceiling));
            if (dgn.isField) {
                // Make it a billboard.
                plane.position.set(wx, wy, wz);
                plane.scale.set(1.7, 1.7, 1.7);
                plane.onBeforeRender = (_renderer, _scene, camera) => {
                    plane.quaternion.copy(camera.quaternion);
                };
            } else {
                plane.rotation.x = Math.PI / 2;
                plane.rotation.z = Math.PI;
                plane.position.set(wx, wy + 1, wz);
            }
        }
        if (cell.north_texture >= 0) {
            const plane = this.addPlane(materials.get('wall', cell.north_texture, cell.shadow_tex_north));
            plane.position.set(wx, wy, wz - 1);
        }
        if (cell.south_texture >= 0) {
            const plane = this.addPlane(materials.get('wall', cell.south_texture, cell.shadow_tex_south));
            plane.rotation.y = Math.PI;
            plane.position.set(wx, wy, wz + 1);
        }
        if (cell.east_texture >= 0) {
            const plane = this.addPlane(materials.get('wall', cell.east_texture, cell.shadow_tex_east));
            plane.rotation.y = Math.PI / -2;
            plane.position.set(wx + 1, wy, wz);
        }
        if (cell.west_texture >= 0) {
            const plane = this.addPlane(materials.get('wall', cell.west_texture, cell.shadow_tex_west));
            plane.rotation.y = Math.PI / 2;
            plane.position.set(wx - 1, wy, wz);
        }
        if (cell.north_door >= 0) {
            const plane = this.addPlane(materials.get('door', cell.north_door));
            plane.position.set(wx, wy, wz - 1);
        }
        if (cell.south_door >= 0) {
            const plane = this.addPlane(materials.get('door', cell.south_door));
            plane.rotation.y = Math.PI;
            plane.position.set(wx, wy, wz + 1);
        }
        if (cell.east_door >= 0) {
            const plane = this.addPlane(materials.get('door', cell.east_door));
            plane.rotation.y = Math.PI / -2;
            plane.position.set(wx + 1, wy, wz);
        }
        if (cell.west_door >= 0) {
            const plane = this.addPlane(materials.get('door', cell.west_door));
            plane.rotation.y = Math.PI / 2;
            plane.position.set(wx - 1, wy, wz);
        }
        if (cell.stairs_texture >= 0) {
            const stairs = this.addStairs(materials.get('stairs', cell.stairs_texture));
            stairs.position.set(wx, wy, wz);
            stairs.rotation.y = Math.PI / 2 * cell.stairs_orientation;
        }
        if (polyFactory && cell.polyobj_index >= 0) {
            const obj = polyFactory.createModel(cell.polyobj_index);
            obj.scale.set(cell.polyobj_mag, cell.polyobj_mag, cell.polyobj_mag);
            obj.rotation.y = cell.polyobj_rotate_h * Math.PI / -180;
            const posX = wx + cell.polyobj_offset_x;
            const posY = wy - 1 + cell.polyobj_offset_y;
            const posZ = wz - cell.polyobj_offset_z;
            obj.position.set(posX, posY, posZ);
            this.add(obj);
        }
        if (cell.roof_texture >= 0) {
            const plane = this.addPlane(materials.get('stairs', cell.roof_texture));
            plane.scale.y = Math.sqrt(2);
            plane.position.set(wx, wy, wz);
            plane.rotation.y = Math.PI / 2 * cell.roof_orientation;
            plane.rotation.x = Math.PI / -4;
            plane.rotation.order = "ZYX";
        }
        if (cell.roof_underside_texture >= 0) {
            const plane = this.addPlane(materials.get('stairs', cell.roof_underside_texture));
            plane.scale.y = Math.sqrt(2);
            plane.position.set(wx, wy, wz);
            plane.rotation.y = Math.PI + Math.PI / 2 * cell.roof_orientation;
            plane.rotation.x = Math.PI / 4;
            plane.rotation.order = "ZYX";
        }
    }

    private addPlane(material: THREE.MeshBasicMaterial): THREE.Object3D {
        const plane = new THREE.Mesh(planeGeometry, material);
        this.add(plane);
        return plane;
    }

    private addStairs(material: THREE.MeshBasicMaterial): THREE.Object3D {
        const stairs = new THREE.Mesh(stairsGeometry, material);
        this.add(stairs);
        return stairs;
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
    private materials = new Map<string, THREE.MeshBasicMaterial>();
    private textures = new Map<string, Promise<Image>>();
    public onTextureLoad: (() => void) | null = null;

    constructor(private dtx: Dtex, private lib: LibModule) {
        super();
    }

    private getTexture(type: TextureType, index: number): Promise<Image> | null {
        if (index < 0) {
            return null;
        }
        const key = `${type}:${index}`;
        let promise = this.textures.get(key);
        if (promise) {
            return promise;
        }

        const textureData = this.dtx.get(type, index);
        if (!textureData) {
            return null;
        }

        promise = decodeImage(this.lib, textureData).then(image => {
            this.track(image.texture);
            return image;
        });
        this.textures.set(key, promise);
        return promise;
    }

    get(type: TextureType, index: number, shadow_index?: number): THREE.MeshBasicMaterial {
        if (shadow_index === undefined) {
            shadow_index = -1;
        }
        const key = `${type}:${index}:${shadow_index}`;
        let cached = this.materials.get(key);
        if (cached) return cached;

        const material = new THREE.MeshBasicMaterial();
        this.materials.set(key, this.track(material));

        const imagePromise = this.getTexture(type, index);
        if (!imagePromise) {
            material.color = new THREE.Color(0x6699FF);
        } else {
            imagePromise.then((image) => {
                const texture = image.texture;
                texture.flipY = true;
                material.map = texture;
                material.transparent = image.hasAlpha;
                material.alphaTest = 0.01;
                material.needsUpdate = true;
                if (this.onTextureLoad) this.onTextureLoad();
            });
        }

        const lightMapPromise = this.getTexture('light', shadow_index);
        if (lightMapPromise) {
            lightMapPromise.then((image) => {
                const texture = image.texture;
                texture.flipY = true;
                material.lightMap = texture;
                material.needsUpdate = true;
            });
        }
        return material;
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
            const material = new THREE.MeshBasicMaterial();
            this.materials[index] = this.track(material);
            const textureData = this.polyobj.textures[index];
            decodeImage(this.lib, textureData).then((image) => {
                const texture = this.track(image.texture);
                material.map = texture;
                material.transparent = image.hasAlpha;
                material.needsUpdate = true;
            });
        }
        return this.materials[index];
    }
}

function createPlaneGeometry(): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
    return geometry;
}

function createStairsGeometry(): THREE.BufferGeometry {
    const vertices = [
        {pos: [-1,  3/3, -3/3], uv: [0, 12/12]},
        {pos: [ 1,  3/3, -3/3], uv: [1, 12/12]},
        {pos: [-1,  3/3, -2/3], uv: [0, 11/12]},
        {pos: [ 1,  3/3, -2/3], uv: [1, 11/12]},
        {pos: [-1,  2/3, -2/3], uv: [0, 10/12]},
        {pos: [ 1,  2/3, -2/3], uv: [1, 10/12]},
        {pos: [-1,  2/3, -1/3], uv: [0, 9/12]},
        {pos: [ 1,  2/3, -1/3], uv: [1, 9/12]},
        {pos: [-1,  1/3, -1/3], uv: [0, 8/12]},
        {pos: [ 1,  1/3, -1/3], uv: [1, 8/12]},
        {pos: [-1,  1/3,  0/3], uv: [0, 7/12]},
        {pos: [ 1,  1/3,  0/3], uv: [1, 7/12]},
        {pos: [-1,  0/3,  0/3], uv: [0, 6/12]},
        {pos: [ 1,  0/3,  0/3], uv: [1, 6/12]},
        {pos: [-1,  0/3,  1/3], uv: [0, 5/12]},
        {pos: [ 1,  0/3,  1/3], uv: [1, 5/12]},
        {pos: [-1, -1/3,  1/3], uv: [0, 4/12]},
        {pos: [ 1, -1/3,  1/3], uv: [1, 4/12]},
        {pos: [-1, -1/3,  2/3], uv: [0, 3/12]},
        {pos: [ 1, -1/3,  2/3], uv: [1, 3/12]},
        {pos: [-1, -2/3,  2/3], uv: [0, 2/12]},
        {pos: [ 1, -2/3,  2/3], uv: [1, 2/12]},
        {pos: [-1, -2/3,  3/3], uv: [0, 1/12]},
        {pos: [ 1, -2/3,  3/3], uv: [1, 1/12]},
        {pos: [-1, -3/3,  3/3], uv: [0, 0/12]},
        {pos: [ 1, -3/3,  3/3], uv: [1, 0/12]},
    ];
    const indices = [];
    for (let i = 0; i < 12; i++) {
        indices.push(i*2+0, i*2+2, i*2+1,  i*2+1, i*2+2, i*2+3);
    }
    const positions = new Float32Array(vertices.length * 3);
    const uvs = new Float32Array(vertices.length * 2);
    for (let i = 0; i < vertices.length; i++) {
        positions.set(vertices[i].pos, i * 3);
        uvs.set(vertices[i].uv, i * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
}

function decodeImage(lib: LibModule, buf: Uint8Array<ArrayBuffer>): Promise<Image> {
    const fmt = String.fromCharCode.apply(null, Array.from(buf.slice(0, 4)));
    if (fmt === 'QNT\0') {
        return Promise.resolve(decodeQnt(lib, buf));
    } else if (fmt === 'ROU\0') {
        return Promise.resolve(decodeRou(buf));
    } else if (fmt === 'RIFF') {
        return decodeWebp(buf);
    } else {
        throw new Error('Unknown texture format ' + fmt);
    }
}

function decodeQnt(lib: LibModule, buf: Uint8Array): Image {
    const ptr = lib.malloc(buf.byteLength);
    lib.memset(ptr, buf);
    const decoded = lib.qnt_extract(ptr);
    lib.free(ptr);
    if (decoded === 0)
        throw new Error('qnt_extract failed');
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const ofs = dv.getUint32(4, true) === 0 ? 0 : 4;
    const width = dv.getUint32(16 + ofs, true);
    const height = dv.getUint32(20 + ofs, true);
    const hasPixel = dv.getUint32(32 + ofs, true) !== 0;
    const hasAlpha = dv.getUint32(36 + ofs, true) !== 0;
    const size = width * height * (hasPixel ? 4 : 1);
    const pixels = lib.memget(decoded, size);
    lib.free(decoded);
    const format = hasPixel ? THREE.RGBAFormat : THREE.LuminanceFormat;
    const texture = new THREE.DataTexture(pixels, width, height, format, THREE.UnsignedByteType);
    return { texture, hasAlpha };
}

function decodeRou(buf: Uint8Array<ArrayBuffer>): Image {
    const r = new BufferReader(buf.buffer);
    r.offset = buf.byteOffset;
    if (r.readFourCC() !== 'ROU\0') {
        throw new Error('Not a ROU image');
    }
    r.expectU32(0);
    const hdrSize = r.readU32();
    if (hdrSize !== 0x44) {
        throw new Error('ROU: Unexpected header size ' + hdrSize);
    }
    r.expectU32(0);
    r.expectU32(0);
    const width = r.readU32();
    const height = r.readU32();
    r.expectU32(24);  // color bits
    r.expectU32(0);
    const pixels_size = r.readU32();
    const alpha_size = r.readU32();  // 0x4000
    if (pixels_size && pixels_size !== width * height * 3) {
        throw new Error(`ROU: Unexpected pixels_size. ${pixels_size} != ${width} * ${height} * 3`);
    }
    if (alpha_size && alpha_size !== width * height) {
        throw new Error(`ROU: Unexpected alpha_size. ${alpha_size} != ${width} * ${height}`);
    }
    while (r.offset + buf.byteOffset < hdrSize) {
        r.expectU32(0);
    }
    if (buf.byteLength != hdrSize + pixels_size + alpha_size) {
        throw new Error(`ROU: Unexpected data length. ${buf.byteLength} != ${hdrSize} + ${pixels_size} + ${alpha_size}`);
    }

    if (pixels_size === 0) {
        const alpha = buf.subarray(hdrSize, hdrSize + alpha_size);
        const texture = new THREE.DataTexture(alpha, width, height, THREE.LuminanceFormat, THREE.UnsignedByteType);
        return { texture, hasAlpha: true };
    }
    if (alpha_size === 0) {
        const pixels = buf.subarray(hdrSize, hdrSize + pixels_size);
        // BGR -> RGB
        let bgr = hdrSize;
        const rgb_buf = new Uint8Array(width * height * 3);
        let rgb = 0;
        while (rgb < width * height * 3) {
            rgb_buf[rgb++] = buf[bgr + 2];
            rgb_buf[rgb++] = buf[bgr + 1];
            rgb_buf[rgb++] = buf[bgr];
            bgr += 3;
        }
        const texture = new THREE.DataTexture(rgb_buf, width, height, THREE.RGBFormat, THREE.UnsignedByteType);
        return { texture, hasAlpha: false };
    }
    // BGR buffer + alpha buffer -> RGBA buffer
    let bgr = hdrSize;
    let alpha = hdrSize + pixels_size;
    const rgba_buf = new Uint8Array(width * height * 4);
    let rgba = 0;
    while (rgba < width * height * 4) {
        rgba_buf[rgba++] = buf[bgr + 2];
        rgba_buf[rgba++] = buf[bgr + 1];
        rgba_buf[rgba++] = buf[bgr];
        rgba_buf[rgba++] = buf[alpha++];
        bgr += 3;
    }
    const texture = new THREE.DataTexture(rgba_buf, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    return { texture, hasAlpha: true };
}

async function decodeWebp(buf: Uint8Array): Promise<Image> {
    const decoder = new ImageDecoder({ data: buf, type: "image/webp" });
    const image = (await decoder.decode()).image;
    const pixels = new Uint8Array(image.allocationSize());
    await image.copyTo(pixels);
    const hasAlpha = image.format![3] == 'A';
    if (image.format === 'BGRX' || image.format === 'BGRA') {
        // BGRA -> RGBA
        for (let i = 0; i < pixels.length; i += 4) {
            const tmp = pixels[i];
            pixels[i] = pixels[i + 2];
            pixels[i + 2] = tmp;
        }
    }
    const texture = new THREE.DataTexture(pixels, image.codedWidth, image.codedHeight, THREE.RGBAFormat, THREE.UnsignedByteType);
    return { texture, hasAlpha };
}