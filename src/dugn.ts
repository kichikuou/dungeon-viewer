import {BufferReader} from './buffer.js';

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
        float polyobj_rotation;
        uint8 unknown[40];
    }
};
*/

export class Dugn {
    readonly version: number;
    readonly sizeX: number;
    readonly sizeY: number;
    readonly sizeZ: number;
    readonly cells: Cell[] = [];
    readonly offsetAfterCells: number;

    constructor(buf: ArrayBuffer) {
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

    cellAt(x: number, y: number, z: number): Cell {
        return this.cells[((z * this.sizeY) + y) * this.sizeX + x];
    }
}

export class Cell {
    private v: DataView;
    readonly pairs: {n: number, s: Uint8Array}[] = [];

    constructor(private version: number, r: BufferReader) {
        switch (version) {
        case 10:
            const offset = r.offset;
            r.offset += 140;
            for (let i = 0; i < 6; i++) {
                const n = r.readU32();
                const s = r.readStrZ();
                this.pairs.push({n, s});
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

    getAttr(n: number): number {
        return this.v.getInt32(n * 4, true);
    }

    get floor_texture(): number { return this.getAttr(0); }
    get ceiling_texture(): number { return this.getAttr(1); }
    get north_texture(): number { return this.getAttr(2); }
    get south_texture(): number { return this.getAttr(3); }
    get east_texture(): number { return this.getAttr(4); }
    get west_texture(): number { return this.getAttr(5); }
    get north_door(): number { return this.getAttr(6); }
    get south_door(): number { return this.getAttr(7); }
    get east_door(): number { return this.getAttr(8); }
    get west_door(): number { return this.getAttr(9); }
    get stairs_texture(): number { return this.getAttr(10); }
    get stairs_orientation(): number { return this.getAttr(11); }
    get polyobj_index(): number {
        return this.version === 13 ? this.v.getInt32(178, true) : -1;
    }
    get polyobj_scale(): number {
        return this.version === 13 ? this.v.getFloat32(182, true) : 1;
    }
    get polyobj_rotation(): number {
        return this.version === 13 ? this.v.getFloat32(186, true) : 0;
    }
}
