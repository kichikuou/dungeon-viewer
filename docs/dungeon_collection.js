import { Dtex } from './dtex.js';
import { Dugn } from './dugn.js';
import { PolyObj } from './polyobj.js';
import { BufferReader, readFileAsArrayBuffer } from './buffer.js';
/*
struct dlf_header {
    char magic[4];   // "DLF\0"
    uint32 reserved; // zero
    struct {
        uint32 dgn_offset;
        uint32 dgn_length;
        uint32 dtx_offset;
        uint32 dtx_length;
        uint32 tes_offset;
        uint32 tes_length;
    } index[100];
};
*/
export class DungeonCollection {
    constructor() {
        this.dgn = [];
        this.dtx = [];
        this.tes = [];
        this.polyobj = null;
    }
    async addFile(file) {
        if (file.name.toLowerCase() === 'dungeondata.dlf') {
            // Rance VI
            const headerBuf = await readFileAsArrayBuffer(file.slice(0, 8 + 100 * 24));
            const r = new BufferReader(headerBuf);
            if (r.readFourCC() !== "DLF\0") {
                throw new Error('not a dlf file');
            }
            r.offset = 8;
            for (let i = 0; i < 100; i++) {
                const dgnOffset = r.readU32();
                const dgnLength = r.readU32();
                const dtxOffset = r.readU32();
                const dtxLength = r.readU32();
                const tesOffset = r.readU32();
                const tesLength = r.readU32();
                if (dgnOffset)
                    this.dgn[i] = file.slice(dgnOffset, dgnOffset + dgnLength);
                if (dtxOffset)
                    this.dtx[i] = file.slice(dtxOffset, dtxOffset + dtxLength);
                if (tesOffset)
                    this.tes[i] = file.slice(tesOffset, tesOffset + tesLength);
            }
            return;
        }
        const match = /^map(\d+)\.(dgn|dtx|mrk|tes)$/.exec(file.name.toLowerCase());
        if (match) {
            // GALZOO Island
            const i = Number(match[1]);
            switch (match[2]) {
                case 'dgn':
                    this.dgn[i] = file;
                    break;
                case 'dtx':
                    this.dtx[i] = file;
                    break;
                case 'tes':
                    this.tes[i] = file;
                    break;
            }
            return;
        }
        if (file.name.toLowerCase() === 'polyobj.lin') {
            // GALZOO Island
            this.polyobj = file;
            return;
        }
        console.log('unrecognized file: ' + file.name);
    }
    getIds() {
        const ids = [];
        for (let i = 0; i < this.dgn.length; i++) {
            if (this.dgn[i] && this.dtx[i])
                ids.push(i);
        }
        return ids;
    }
    async getDugn(i) {
        return new Dugn(await readFileAsArrayBuffer(this.dgn[i]));
    }
    async getDtex(i) {
        return new Dtex(await readFileAsArrayBuffer(this.dtx[i]));
    }
    async getPolyObj() {
        if (!this.polyobj) {
            return null;
        }
        return new PolyObj(await readFileAsArrayBuffer(this.polyobj));
    }
}
