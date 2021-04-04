import { BufferReader } from './buffer.js';
/*
struct dugn {
    char magic[4];  // "DUGN"
    uint32 version; // 10: Rance VI, 13: GALZOO Island
    uint32 sizeX;
    uint32 sizeY;
    uint32 sizeZ;
    uint32 unknown[10];
    struct cell cells[sizeZ][sizeY][sizeX];
    // unknown data follows...
};

struct cell {
    int32 floor_texture;
    int32 ceiling_texture;
    int32 north_texture;
    int32 south_texture;
    int32 east_texture;
    int32 west_texture;
    int32 north_door;
    int32 south_door;
    int32 east_door;
    int32 west_door;
    int32 stairs_texture;
    int32 stairs_orientation;
    int32 unknown[23];
    if (version == 10) {
        struct {
            uint32 i;
            strz s;
        } unknown[6];
        uint8 unknown[8];
    } else if (version == 13) {
        uint8 unknown[38];
        int32 polyobj_index;
        float polyobj_scale;
        float polyobj_rotationY;
        float polyobj_rotationZ;  // always zero
        float polyobj_rotationX;  // always zero
        float polyobj_positionX;
        float polyobj_positionY;
        float polyobj_positionZ;
        int32 roof_orientation;
        int32 roof_texture;
        int32 unused;  // always -1
        int32 roof_underside_texture;
        int32 unused;  // always -1
    }
};
*/
export class Dugn {
    constructor(buf) {
        this.cells = [];
        const r = new BufferReader(buf);
        if (r.readFourCC() !== "DUGN") {
            throw new Error('not a DUGN');
        }
        this.version = r.readU32();
        this.sizeX = r.readU32();
        this.sizeY = r.readU32();
        this.sizeZ = r.readU32();
        r.offset += 40;
        const nr_cells = this.sizeX * this.sizeY * this.sizeZ;
        for (let i = 0; i < nr_cells; i++) {
            this.cells.push(new Cell(this.version, r));
        }
        this.offsetAfterCells = r.offset;
    }
    cellAt(x, y, z) {
        return this.cells[((z * this.sizeY) + y) * this.sizeX + x];
    }
}
export class Cell {
    constructor(version, r) {
        this.version = version;
        this.pairs = [];
        switch (version) {
            case 10:
                const offset = r.offset;
                r.offset += 140;
                for (let i = 0; i < 6; i++) {
                    const n = r.readU32();
                    const s = r.readStrZ();
                    this.pairs.push({ n, s });
                }
                r.offset += 8;
                this.v = new DataView(r.buffer, offset, r.offset - offset);
                break;
            case 13:
                this.v = new DataView(r.buffer, r.offset, 230);
                r.offset += 230;
                break;
            default:
                throw new Error('unknown DUGN version ' + version);
        }
    }
    getAttr(n) {
        return this.v.getInt32(n * 4, true);
    }
    get floor_texture() { return this.getAttr(0); }
    get ceiling_texture() { return this.getAttr(1); }
    get north_texture() { return this.getAttr(2); }
    get south_texture() { return this.getAttr(3); }
    get east_texture() { return this.getAttr(4); }
    get west_texture() { return this.getAttr(5); }
    get north_door() { return this.getAttr(6); }
    get south_door() { return this.getAttr(7); }
    get east_door() { return this.getAttr(8); }
    get west_door() { return this.getAttr(9); }
    get stairs_texture() { return this.getAttr(10); }
    get stairs_orientation() { return this.getAttr(11); }
    get polyobj_index() {
        return this.version === 13 ? this.v.getInt32(178, true) : -1;
    }
    get polyobj_scale() {
        return this.version === 13 ? this.v.getFloat32(182, true) : 1;
    }
    get polyobj_rotationY() {
        return this.version === 13 ? this.v.getFloat32(186, true) : 0;
    }
    get polyobj_rotationZ() {
        return this.version === 13 ? this.v.getFloat32(190, true) : 0;
    }
    get polyobj_rotationX() {
        return this.version === 13 ? this.v.getFloat32(194, true) : 0;
    }
    get polyobj_positionX() {
        return this.version === 13 ? this.v.getFloat32(198, true) : 0;
    }
    get polyobj_positionY() {
        return this.version === 13 ? this.v.getFloat32(202, true) : 0;
    }
    get polyobj_positionZ() {
        return this.version === 13 ? this.v.getFloat32(206, true) : 0;
    }
    get roof_orientation() {
        return this.version === 13 ? this.v.getInt32(210, true) : -1;
    }
    get roof_texture() {
        return this.version === 13 ? this.v.getInt32(214, true) : -1;
    }
    get roof_underside_texture() {
        return this.version === 13 ? this.v.getInt32(222, true) : -1;
    }
}
