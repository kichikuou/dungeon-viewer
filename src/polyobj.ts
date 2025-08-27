import {BufferReader} from './buffer.js';

/*
struct Location {
    uint32 offset;
    uint32 length;
};

struct polyobj_header {
    char magic[4];    // "POL\0"
    uint32 reserved;  // must be zero
    uint32 nr_textures;
    struct Location textures[nr_textures];
    uint32 nr_objects;
    struct Location objects[nr_objects];
};

typedef float vec2[2];
typedef float vec3[3];

struct Object {
    strz name;      // in SJIS
    char magic[4];  // "POO\0"
    uint32 reserved;  // must be zero
    uint32 nr_materials;
    uint32 materials[nr_materials];  // texture IDs
    uint32 nr_parts;
    struct {
        uint32 nr_vertices;
        vec3 vertices[nr_vertices];
        uint32 nr_triangles;
        struct {
            uint32 material;
            uint32 index[3];
            vec2 uv[3];
        } triangles[nr_triangles];
    } parts[nr_parts];
};
*/

export class PolyObj {
    readonly textures: Uint8Array<ArrayBuffer>[] = [];
    readonly objects: Object[] = [];

    constructor(buf: ArrayBuffer) {
        const r = new BufferReader(buf);
        if (r.readFourCC() !== "POL\0") {
            throw new Error('not a POL file');
        }
        if (r.readU32() !== 0) {
            throw new Error('unknown POL version');
        }
        const nr_textures = r.readU32();
        for (let i = 0; i < nr_textures; i++) {
            const offset = r.readU32();
            const length = r.readU32();
            this.textures.push(new Uint8Array(buf, offset, length));
        }
        const nr_objects = r.readU32();
        for (let i = 0; i < nr_objects; i++) {
            const offset = r.readU32();
            const length = r.readU32();
            if (length > 0) {
                this.objects[i] = new Object(new BufferReader(buf.slice(offset, offset + length)));
            }
        }
    }
}

type Vec3 = {x: number, y: number, z: number};
type Vec2 = {u: number, v: number};
type Triangle = {
    material: number,
    index: [number, number, number],
    uv: [Vec2, Vec2, Vec2]
};

type ObjPart = {
    vertices: Vec3[];
    triangles: Triangle[];
};

class Object {
    readonly name: Uint8Array;
    readonly materials: number[] = [];
    readonly parts: ObjPart[] = [];

    constructor(r: BufferReader) {
        this.name = r.readStrZ();
        if (r.readFourCC() !== "POO\0") {
            throw new Error('not a POO');
        }
        if (r.readU32() !== 0) {
            throw new Error('unknown POO version');
        }
        const nr_materials = r.readU32();
        for (let i = 0; i < nr_materials; i++) {
            this.materials.push(r.readU32());
        }
        const nr_parts = r.readU32();
        for (let i = 0; i < nr_parts; i++) {
            const nr_vertices = r.readU32();
            const vertices: Vec3[] = [];
            for (let j = 0; j < nr_vertices; j++) {
                vertices.push({x: r.readF32(), y: r.readF32(), z: r.readF32()});
            }
            const nr_triangles = r.readU32();
            const triangles: Triangle[] = [];
            for (let j = 0; j < nr_triangles; j++) {
                triangles.push({
                    material: r.readU32(),
                    index: [r.readU32(), r.readU32(), r.readU32()],
                    uv: [
                        {u: r.readF32(), v: r.readF32()},
                        {u: r.readF32(), v: r.readF32()},
                        {u: r.readF32(), v: r.readF32()}
                    ]
                });
            }
            this.parts.push({vertices, triangles});
        }
    }
}
