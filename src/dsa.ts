import {BufferReader} from './buffer.js';

const AIN_INT = 10;
const AIN_FLOAT = 11;
const AIN_STRING = 12;
const AIN_STRUCT = 13;
const AIN_ARRAY_STRUCT = 17;
const AIN_BOOL = 47;

const structDefs: Record<string, string[]> = {
    'dungeon_set_data_t': [
        'nID',
        'sDungeonName',
        'nDgn',
        'nDtx',
        'nWallpaper',
        'nBGM',
        'slp',
        'nBackColorR',
        'nBackColorG',
        'nBackColorB',
        'xyzMapSize',
        'fxyz',
        'nFloor',
        'nEntX',
        'nEntY',
        'aObject',
        'DungeonCreateInfo',
        'aPosProposedMonster',
        'aPosProposedTreasure',
        'aPosProposedTrap',
        'aPosNoMonster',
        'aPosNoTreasure',
        'aPosNoTrap',
    ],
    'dungeon_object_t': [
        'nType',
        'nChara',
        'nSpPlateNormal',
        'nSpPlateSelect',
        'fpos',
        'fposBase',
        'posSet',
        'bFound',
        'sName',
        'bHit',
        'fHitRange',
        'nStopCount',
        'fWalkStepBase',
        'fWalkStep',
        'fSenseRange',
        'nAppearanceCount',
        'nEventType',
        'nEventID',
        'bValidNamePlate',
        'nAnimeFrameNum',
    ],
    'dungeon_create_info_t': [
        'aposItem',
        'aposEnemy',
        'aposTrap',
        'aposNoTreasure',
        'aposNoMonster',
        'aposNoTrap',
    ],
    'sphere_lighting_param_t': [
        'fThetaX',
        'fThetaY',
        'fThetaZ',
        'fColorTop',
        'fColorBottom',
    ],
    'xyz_t': [
        'x',
        'y',
        'z',
    ],
    'fxyz_t': [
        'x',
        'y',
        'z',
    ],
    'pos_t': [
        'x',
        'y',
    ],
    'fpos_t': [
        'x',
        'y',
    ],
}

function readStructData(r: BufferReader) {
    const size = r.readU32();
    r.expectFourCC("SCT\0");
    r.expectU32(0);
    const structName = new TextDecoder('shift-jis').decode(r.readStrZ());
    const nrSlots = r.readU32();
    const slots: any[] = [];
    for (let i = 0; i < nrSlots; i++) {
        const tag = r.readU32();
        switch (tag) {
        case AIN_INT:
            slots.push(r.readS32());
            break;
        case AIN_FLOAT:
            slots.push(r.readF32());
            break;
        case AIN_STRING:
            slots.push(new TextDecoder('shift-jis').decode(r.readStrZ()));
            break;
        case AIN_STRUCT:
            slots.push(readStructData(r));
            break;
        case AIN_ARRAY_STRUCT:
            slots.push(readArrayStruct(r));
            break;
        case AIN_BOOL:
            slots.push(r.readS32() !== 0);
            break;
        default:
            throw new Error(`Unknown tag ${tag.toString(16)} at offset ${r.offset}`);
        }
    }
    const slotNames = structDefs[structName];
    if (!slotNames) {
        throw new Error(`Unknown struct name "${structName}"`);
    }
    if (slots.length !== slotNames.length) {
        throw new Error(`Struct "${structName}" has ${slotNames.length} slots, but got ${slots.length}`);
    }
    const obj: Record<string, any> = {};
    for (let i = 0; i < slots.length; i++) {
        obj[slotNames[i]] = slots[i];
    }
    return obj;
}

function readArrayStruct(r: BufferReader) {
    const size = r.readU32();
    r.expectFourCC("ARY\0");
    r.expectU32(0);
    r.expectU32(AIN_ARRAY_STRUCT);
    const structName = new TextDecoder('shift-jis').decode(r.readStrZ());
    const nrSlots = r.readU32();
    const slots: any[] = [];
    for (let i = 0; i < nrSlots; i++) {
        slots.push(readStructData(r));
    }
    return slots;
}

export class DsaCell {
    static attributes = [
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
    ] as const;

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
    readonly door_lock_north: number;
    readonly door_lock_west: number;
    readonly door_lock_south: number;
    readonly door_lock_east: number;
    readonly door_angle_north: number;
    readonly door_angle_west: number;
    readonly door_angle_south: number;
    readonly door_angle_east: number;
    readonly walked: number;

    constructor(r: BufferReader) {
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
    get polyobj_index(): number { return -1; }
    get polyobj_mag(): number { return 1; }
    get polyobj_rotate_b(): number { return 0; }
    get polyobj_rotate_h(): number { return 0; }
    get polyobj_rotate_p(): number { return 0; }
    get polyobj_offset_x(): number { return 0; }
    get polyobj_offset_y(): number { return 0; }
    get polyobj_offset_z(): number { return 0; }
    get roof_orientation(): number { return -1; }
    get roof_texture(): number { return -1; }
    get roof_underside_texture(): number { return -1; }
}

export class Dsa {
    readonly dsd: any;
    readonly cells: DsaCell[];

    constructor(buf: ArrayBuffer) {
        const r = new BufferReader(buf);
        r.expectU32(0);
        r.expectU32(0);
        r.expectU32(0);
        r.expectU32(0);
        r.expectU32(0x20);  // header size?
        const size = r.readU32();
        r.expectU32(0);
        r.expectU32(0);
        this.dsd = readStructData(r);
        this.cells = [];
        while (r.offset < r.buffer.byteLength) {
            const count = r.readU8() + 1;
            const cell = new DsaCell(r);
            for (let i = 0; i < count; i++) {
                this.cells.push(cell);
            }
        }
        if (r.offset !== size + 0x20) {
            throw new Error(`dsa file size mismatch: expected ${size + 0x20}, got ${r.offset}`);
        }
        if (this.cells.length != this.sizeX * this.sizeY * this.sizeZ) {
            throw new Error(`expected ${this.sizeX * this.sizeY * this.sizeZ} cells, got ${this.cells.length}`);
        }
        console.log(this.dsd);
    }

    get isField(): boolean { return true; }
    get sizeX(): number { return this.dsd['xyzMapSize']['x']; }
    get sizeY(): number { return this.dsd['xyzMapSize']['y']; }
    get sizeZ(): number { return this.dsd['xyzMapSize']['z']; }
    get backColorR(): number { return 0; }
    get backColorG(): number { return 0; }
    get backColorB(): number { return 0; }

    cellAt(x: number, y: number, z: number): DsaCell {
        if (x < 0 || x >= this.sizeX || y < 0 || y >= this.sizeY || z < 0 || z >= this.sizeZ) {
            throw new Error(`Cell at (${x}, ${y}, ${z}) is out of bounds`);
        }
        return this.cells[((y * this.sizeZ) + z) * this.sizeX + x];
    }

    pvsAt(x: number, y: number, z: number): null {
        // DSA does not have PVS data
        return null;
    }
}
