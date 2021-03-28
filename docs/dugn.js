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
        uint8 unknown[90];
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
    get floor_texture() { return this.v.getInt32(0, true); }
    get ceiling_texture() { return this.v.getInt32(4, true); }
    get north_texture() { return this.v.getInt32(8, true); }
    get south_texture() { return this.v.getInt32(12, true); }
    get east_texture() { return this.v.getInt32(16, true); }
    get west_texture() { return this.v.getInt32(20, true); }
    get north_door() { return this.v.getInt32(24, true); }
    get south_door() { return this.v.getInt32(28, true); }
    get east_door() { return this.v.getInt32(32, true); }
    get west_door() { return this.v.getInt32(36, true); }
    get stairs_texture() { return this.v.getInt32(40, true); }
    get stairs_orientation() { return this.v.getInt32(44, true); }
}
