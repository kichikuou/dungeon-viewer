import {BufferReader} from './buffer.js';

export enum TextureType {
    Wall = 0,
    Ceiling = 1,
    Floor = 2,
    Stairs = 3,
    Door = 4,
}

/*
struct dtex {
    char magic[4];            // "DTEX"
    uint32 version;           // 0: Rance IV, 1: GALZOO Island
    uint32 nr_rows;
    uint32 nr_columns
    struct row {
        uint32 nr_items;      // == nr_columns
        struct column {
            uint32 size;      // can be zero
            uint8 data[size];
        } columns[nr_items];
    } rows[nr_rows];
};
*/

export class Dtex {
    private data: Uint8Array[][] = [];

    constructor(buf: ArrayBuffer) {
        const r = new BufferReader(buf);
        if (r.readFourCC() !== "DTEX") {
            throw new Error('not a DTEX');
        }
        const version = r.readU32();
        if (version !== 0 && version !== 1) {
            throw new Error('unknown DTEX version');
        }
        const nr_rows = r.readU32();
        const nr_cols = r.readU32();
        for (let row = 0; row < nr_rows; row++) {
            this.data[row] = [];
            const nr_items = r.readU32();
            if (nr_items !== nr_cols) {
                throw new Error('unexpected number of textures');
            }
            for (let col = 0; col < nr_cols; col++) {
                const size = r.readU32();
                if (size !== 0) {
                    this.data[row][col] = r.readBytes(size);
                }
            }
        }
    }

    get(row: number, col: number): Uint8Array {
        return this.data[row][col];
    }
}