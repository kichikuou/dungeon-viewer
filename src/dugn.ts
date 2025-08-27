import {BufferReader} from './buffer.js';

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
    vec3 sphereTheta;
    float sphereColorTop;
    float sphereColorBottom;
    uint32 footer6;

    if (GALZOO) {
        float footer7;
        uint32 footer8;  // always zero
    }
    if (PastelChimeContinue && version >= 10) {
        uint32 backColorR;
        uint32 backColorG;
        uint32 backColorB;
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
    int32 shadow_tex_floor;
    int32 shadow_tex_ceiling;
    int32 shadow_tex_north;
    int32 shadow_tex_south;
    int32 shadow_tex_east;
    int32 shadow_tex_west;
    int32 shadow_tex_door_north;
    int32 shadow_tex_door_south;
    int32 shadow_tex_door_east;
    int32 shadow_tex_door_west;
    int32 shadow_tex_stairs;
    int32 unknown1;
    int32 unknown2;
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
        int32 unknown3;
        int32 battle_background;
    }
    if (GALZOO) {
        int32 polyobj_index;
        float polyobj_mag;
        float polyobj_rotate_h;
        float polyobj_rotate_p;  // always zero
        float polyobj_rotate_b;  // always zero
        float polyobj_offset_x;
        float polyobj_offset_y;
        float polyobj_offset_z;
        int32 roof_orientation;
        int32 roof_texture;
        int32 unused;  // always -1
        int32 roof_underside_texture;
        int32 unused;  // always -1
    }
    if (PastelChimeContinue && version >= 9) {
        int32 door_lock_north;
        int32 door_lock_west;
        int32 door_lock_south;
        int32 door_lock_east;
        float door_angle_north;
        float door_angle_west;
        float door_angle_south;
        float door_angle_east;
        int32 walked;
        if (version >= 11) {
            int32 polyobj_index;
            float polyobj_mag;
            float polyobj_rotate_h;
            float polyobj_rotate_p;
            float polyobj_rotate_b;
            float polyobj_offset_x;
            float polyobj_offset_y;
            float polyobj_offset_z;
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
    readonly isField: boolean;
    readonly version: number;
    readonly sizeX: number;
    readonly sizeY: number;
    readonly sizeZ: number;
    readonly cells: Cell[] = [];
    readonly pvs: PVS[] | null = null;
    readonly sphereThetaX: number;
    readonly sphereThetaY: number;
    readonly sphereThetaZ: number;
    readonly sphereColorTop: number;
    readonly sphereColorBottom: number;
    readonly backColorR: number = 0;
    readonly backColorG: number = 0;
    readonly backColorB: number = 0;
    readonly footer: number[] = [];

    constructor(buf: ArrayBuffer, isField: boolean) {
        this.isField = isField;
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
            this.cells.push(new Cell(this.version, isField, r));
        }
        r.offset += 1;
        const has_pvs = r.readU32() != 0;
        if (has_pvs) {
            this.pvs = [];
            for (let i = 0; i < nr_cells; i++) {
                this.pvs.push(new PVS(this, r));
            }
        }
        this.sphereThetaX = r.readF32();
        this.sphereThetaY = r.readF32();
        this.sphereThetaZ = r.readF32();
        this.sphereColorTop = r.readF32();
        this.sphereColorBottom = r.readF32();
        this.footer.push(r.readU32());
        if (this.version == 13) {
            this.footer.push(r.readF32());
            this.footer.push(r.readF32());
        }
        if (isField && this.version >= 10) {
            this.backColorR = r.readU32();
            this.backColorG = r.readU32();
            this.backColorB = r.readU32();
        }
        if (r.offset !== r.buffer.byteLength) {
            throw new Error(`extra ${r.buffer.byteLength - r.offset} bytes of data at the end`);
        }
    }

    cellAt(x: number, y: number, z: number): Cell {
        return this.cells[((z * this.sizeY) + y) * this.sizeX + x];
    }

    pvsAt(x: number, y: number, z: number): PVS | null {
        if (!this.pvs) {
            return null;
        }
        return this.pvs[((z * this.sizeY) + y) * this.sizeX + x];
    }
}

export class Cell {
    static commonAttributes = [
        'floor_texture',
        'ceiling_texture',
        'north_texture',
        'south_texture',
        'east_texture',
        'west_texture',
        'north_door',
        'south_door',
        'east_door',
        'west_door',
        'stairs_texture',
        'stairs_orientation',
        'shadow_tex_floor',
        'shadow_tex_ceiling',
        'shadow_tex_north',
        'shadow_tex_south',
        'shadow_tex_east',
        'shadow_tex_west',
        'shadow_tex_door_north',
        'shadow_tex_door_south',
        'shadow_tex_door_east',
        'shadow_tex_door_west',
        'shadow_tex_stairs',
        'unknown1',
        'unknown2',
        'enterable',
        'enterable_north',
        'enterable_south',
        'enterable_east',
        'enterable_west',
        'floor_event',
        'north_event',
        'south_event',
        'east_event',
        'west_event',
    ] as const;

    static pascha2Attributes = [
        'door_lock_north',
        'door_lock_west',
        'door_lock_south',
        'door_lock_east',
        'door_angle_north',
        'door_angle_west',
        'door_angle_south',
        'door_angle_east',
        'walked',
        'polyobj_index',
        'polyobj_mag',
        'polyobj_rotate_h',
        'polyobj_rotate_p',
        'polyobj_rotate_b',
        'polyobj_offset_x',
        'polyobj_offset_y',
        'polyobj_offset_z',
    ] as const;

    readonly pairs: {n: number, s: Uint8Array}[] = [];
    readonly offsetAfterPairs: number;
    readonly floor_texture: number;
    readonly ceiling_texture: number;
    readonly north_texture: number;
    readonly south_texture: number;
    readonly east_texture: number;
    readonly west_texture: number;
    readonly north_door: number;
    readonly south_door: number;
    readonly east_door: number;
    readonly west_door: number;
    readonly stairs_texture: number;
    readonly stairs_orientation: number;
    readonly shadow_tex_floor: number;
    readonly shadow_tex_ceiling: number;
    readonly shadow_tex_north: number;
    readonly shadow_tex_south: number;
    readonly shadow_tex_east: number;
    readonly shadow_tex_west: number;
    readonly shadow_tex_door_north: number;
    readonly shadow_tex_door_south: number;
    readonly shadow_tex_door_east: number;
    readonly shadow_tex_door_west: number;
    readonly shadow_tex_stairs: number;
    readonly unknown1: number;
    readonly unknown2: number;
    readonly enterable: number;
    readonly enterable_north: number;
    readonly enterable_south: number;
    readonly enterable_east: number;
    readonly enterable_west: number;
    readonly floor_event: number;
    readonly north_event: number;
    readonly south_event: number;
    readonly east_event: number;
    readonly west_event: number;

    // Rance VI / GALZOO Island
    readonly unknown3: number | undefined;
    readonly battle_background: number | undefined;

    // GALZOO Island / Pastel Chime Continue (v11)
    readonly polyobj_index: number = -1;
    readonly polyobj_mag: number = 1;
    readonly polyobj_rotate_h: number = 0;
    readonly polyobj_rotate_p: number = 0;
    readonly polyobj_rotate_b: number = 0;
    readonly polyobj_offset_x: number = 0;
    readonly polyobj_offset_y: number = 0;
    readonly polyobj_offset_z: number = 0;

    // GALZOO Island
    readonly roof_orientation: number = 0;
    readonly roof_texture: number = -1;
    readonly galzoo_uk1: number | undefined;
    readonly roof_underside_texture: number = -1;
    readonly galzoo_uk2: number | undefined;

    // Pastel Chime Continue (v9+)
    readonly door_lock_north: number | undefined;
    readonly door_lock_west: number | undefined;
    readonly door_lock_south: number | undefined;
    readonly door_lock_east: number | undefined;
    readonly door_angle_north: number | undefined;
    readonly door_angle_west: number | undefined;
    readonly door_angle_south: number | undefined;
    readonly door_angle_east: number | undefined;
    readonly walked: number | undefined;

    constructor(readonly version: number, isField: boolean, r: BufferReader) {
        const offset = r.offset;
        this.floor_texture = r.readS32();
        this.ceiling_texture = r.readS32();
        this.north_texture = r.readS32();
        this.south_texture = r.readS32();
        this.east_texture = r.readS32();
        this.west_texture = r.readS32();
        this.north_door = r.readS32();
        this.south_door = r.readS32();
        this.east_door = r.readS32();
        this.west_door = r.readS32();
        this.stairs_texture = r.readS32();
        this.stairs_orientation = r.readS32();
        this.shadow_tex_floor = r.readS32();
        this.shadow_tex_ceiling = r.readS32();
        this.shadow_tex_north = r.readS32();
        this.shadow_tex_south = r.readS32();
        this.shadow_tex_east = r.readS32();
        this.shadow_tex_west = r.readS32();
        this.shadow_tex_door_north = r.readS32();
        this.shadow_tex_door_south = r.readS32();
        this.shadow_tex_door_east = r.readS32();
        this.shadow_tex_door_west = r.readS32();
        this.shadow_tex_stairs = r.readS32();
        this.unknown1 = r.readS32();
        this.unknown2 = r.readS32();
        this.enterable = r.readS32();
        this.enterable_north = r.readS32();
        this.enterable_south = r.readS32();
        this.enterable_east = r.readS32();
        this.enterable_west = r.readS32();
        this.floor_event = r.readS32();
        this.north_event = r.readS32();
        this.south_event = r.readS32();
        this.east_event = r.readS32();
        this.west_event = r.readS32();
        for (let i = 0; i < 6; i++) {
            const n = r.readU32();
            const s = r.readStrZ();
            this.pairs.push({n, s});
        }
        this.offsetAfterPairs = r.offset - offset;
        if (isField) {  // Pastel Chime Continue
            if (version >= 9) {
                this.door_lock_north = r.readS32();
                this.door_lock_west = r.readS32();
                this.door_lock_south = r.readS32();
                this.door_lock_east = r.readS32();
                this.door_angle_north = r.readF32();
                this.door_angle_west = r.readF32();
                this.door_angle_south = r.readF32();
                this.door_angle_east = r.readF32();
                this.walked = r.readU32();
            }
            if (version >= 11) {
                this.polyobj_index = r.readS32();
                this.polyobj_mag = r.readF32();
                this.polyobj_rotate_h = r.readF32();
                this.polyobj_rotate_p = r.readF32();
                this.polyobj_rotate_b = r.readF32();
                this.polyobj_offset_x = r.readF32();
                this.polyobj_offset_y = r.readF32();
                this.polyobj_offset_z = r.readF32();
            }
        } else {
            this.unknown3 = r.readS32();
            this.battle_background = r.readS32();
            if (version === 13) {  // GALZOO Island
                if (this.offsetAfterPairs !== 170) {
                    throw new Error('unexpected non-empty string field in DUGN v13');
                }
                this.polyobj_index = r.readS32();
                this.polyobj_mag = r.readF32();
                this.polyobj_rotate_h = r.readF32();
                this.polyobj_rotate_p = r.readF32();
                this.polyobj_rotate_b = r.readF32();
                this.polyobj_offset_x = r.readF32();
                this.polyobj_offset_y = r.readF32();
                this.polyobj_offset_z = r.readF32();
                this.roof_orientation = r.readS32();
                this.roof_texture = r.readS32();
                this.galzoo_uk1 = r.readS32();
                this.roof_underside_texture = r.readS32();
                this.galzoo_uk2 = r.readS32();
            }
        }
    }
}

export class PVS {
    private runLengths: [number, number][] = [];

    constructor(private dgn: Dugn, r: BufferReader) {
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

    getVisibleCells(): {x: number, y: number, z: number}[] {
        const cells: {x: number, y: number, z: number}[] = [];
        let i = 0, invisibleCells = 0, visibleCells = 0;
        for (let z = 0; z < this.dgn.sizeZ; z++) {
            for (let y = 0; y < this.dgn.sizeY; y++) {
                for (let x = 0; x < this.dgn.sizeX; x++) {
                    if (invisibleCells === 0 && visibleCells === 0) {
                        [invisibleCells, visibleCells] = this.runLengths[i++];
                    }
                    if (invisibleCells > 0) {
                        invisibleCells--;
                    } else {
                        cells.push({x, y, z});
                        visibleCells--;
                    }
                }
            }
        }
        return cells;
    }
}
