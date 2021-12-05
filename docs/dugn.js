import { BufferReader } from './buffer.js';
/*
struct dugn {
    char magic[4];  // "DUGN"
    uint32 version; // Rance VI => 10, GALZOO Island => 13, Pastel Chime Continue => (8, 10 or 11)
    uint32 sizeX;
    uint32 sizeY;
    uint32 sizeZ;
    uint32 unknown[10];
    struct cell cells[sizeZ][sizeY][sizeX];
    uint8 unknown;  // must be zero
    uint32 has_pvs; // 0 or 1
    struct {
        uint32 len;
        struct PVS pvs;  // len bytes
    } pvs_array[has_pvs][sizeZ][sizeY][sizeX];
    float footer1;
    float footer2;
    float footer3;
    float footer4;
    float footer5;
    uint32 footer6;

    if (GALZOO) {
        float footer7;
        uint32 footer8;  // always zero
    }
    if (PastelChimeContinue && version >= 10) {
        uint32 footer7;
        uint32 footer8;
        uint32 footer9;
    }
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
    int32 unknown[13];
    int32 enterable;
    int32 enterable_north;
    int32 enterable_south;
    int32 enterable_east;
    int32 enterable_west;
    int32 floor_event;
    int32 north_event;
    int32 south_event;
    int32 east_event;
    int32 west_event;
    struct {
        uint32 i;
        strz s;     // in sjis
    } pairs[6];     // unused in GALZOO (all zero)

    if (Rance6 || GALZOO) {
        int32 unknown1;
        int32 battle_background;
    }
    if (GALZOO) {
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
    if (PastelChimeContinue) {
        if (version >= 10) {
            int32 unknown[9];
        }
        if (version == 11) {
            int32 unknown[8];
        }
    }
};

struct PVS {
    uint32 nr_total_cells;
    struct {
        uint32 invisible_cells;
        uint32 visible_cells;
    } run_lengths[];
};
*/
export class Dugn {
    constructor(buf, fromDlf) {
        this.cells = [];
        this.pvs = null;
        this.footer = [];
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
            this.cells.push(new Cell(this.version, fromDlf, r));
        }
        r.offset += 1;
        const has_pvs = r.readU32() != 0;
        if (has_pvs) {
            this.pvs = [];
            for (let i = 0; i < nr_cells; i++) {
                this.pvs.push(new PVS(this, r));
            }
        }
        this.footer.push(r.readF32());
        this.footer.push(r.readF32());
        this.footer.push(r.readF32());
        this.footer.push(r.readF32());
        this.footer.push(r.readF32());
        this.footer.push(r.readU32());
        if (this.version == 13) {
            this.footer.push(r.readF32());
            this.footer.push(r.readF32());
        }
        if (!fromDlf && (this.version === 10 || this.version === 11)) {
            this.footer.push(r.readU32());
            this.footer.push(r.readU32());
            this.footer.push(r.readU32());
        }
        if (r.offset !== r.buffer.byteLength) {
            throw new Error(`extra ${r.buffer.byteLength - r.offset} bytes of data at the end`);
        }
    }
    cellAt(x, y, z) {
        return this.cells[((z * this.sizeY) + y) * this.sizeX + x];
    }
    pvsAt(x, y, z) {
        if (!this.pvs) {
            return null;
        }
        return this.pvs[((z * this.sizeY) + y) * this.sizeX + x];
    }
}
export class Cell {
    constructor(version, fromDlf, r) {
        this.version = version;
        this.pairs = [];
        const offset = r.offset;
        r.offset += 140;
        for (let i = 0; i < 6; i++) {
            const n = r.readU32();
            const s = r.readStrZ();
            this.pairs.push({ n, s });
        }
        this.offsetAfterPairs = r.offset - offset;
        switch (version) {
            case 8:
                break;
            case 10:
                r.offset += fromDlf ? 8 : 36;
                break;
            case 11:
                r.offset += 68;
                break;
            case 13:
                if (this.offsetAfterPairs !== 170) {
                    throw new Error('unexpected non-empty string field in DUGN v13');
                }
                r.offset += 60;
                break;
            default:
                throw new Error('unknown DUGN version ' + version);
        }
        this.v = new DataView(r.buffer, offset, r.offset - offset);
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
    get unknown1() {
        return this.v.getInt32(this.offsetAfterPairs, true);
    }
    get buttle_background() {
        return this.v.getInt32(this.offsetAfterPairs + 4, true);
    }
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
export class PVS {
    constructor(dgn, r) {
        this.dgn = dgn;
        this.runLengths = [];
        const len = r.readU32();
        if (len % 8 !== 4)
            throw new Error('unexpected PVS length');
        const end = r.offset + len;
        const nrCells = r.readU32();
        if (nrCells !== dgn.sizeX * dgn.sizeY * dgn.sizeZ)
            throw new Error('bad PVS');
        let total = 0;
        while (r.offset < end) {
            const invisibleCells = r.readU32();
            const visibleCells = r.readU32();
            this.runLengths.push([invisibleCells, visibleCells]);
            total += invisibleCells + visibleCells;
        }
        if (total !== nrCells)
            throw new Error('broken PVS');
    }
    getVisibleCells() {
        const cells = [];
        let i = 0, invisibleCells = 0, visibleCells = 0;
        for (let z = 0; z < this.dgn.sizeZ; z++) {
            for (let y = 0; y < this.dgn.sizeY; y++) {
                for (let x = 0; x < this.dgn.sizeX; x++) {
                    if (invisibleCells === 0 && visibleCells === 0) {
                        [invisibleCells, visibleCells] = this.runLengths[i++];
                    }
                    if (invisibleCells > 0) {
                        invisibleCells--;
                    }
                    else {
                        cells.push({ x, y, z });
                        visibleCells--;
                    }
                }
            }
        }
        return cells;
    }
}
