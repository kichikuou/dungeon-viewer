export function readFileAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}
export class BufferReader {
    constructor(buf) {
        this.offset = 0;
        this.view = new DataView(buf);
    }
    get buffer() {
        return this.view.buffer;
    }
    readU32() {
        const val = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return val;
    }
    readS32() {
        const val = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return val;
    }
    readF32() {
        const val = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return val;
    }
    readFourCC() {
        const fourcc = new Uint8Array(this.view.buffer, this.offset, 4);
        this.offset += 4;
        return String.fromCharCode.apply(null, Array.from(fourcc));
    }
    readBytes(len) {
        const bytes = new Uint8Array(this.view.buffer, this.offset, len);
        this.offset += len;
        return bytes;
    }
    readStrZ() {
        const begin = this.offset;
        while (this.view.getUint8(this.offset) !== 0) {
            this.offset++;
        }
        this.offset++;
        return new Uint8Array(this.view.buffer, begin, this.offset - 1 - begin);
    }
    expectU32(expected) {
        const val = this.readU32();
        if (val !== expected) {
            throw new Error(`Expected ${expected} but got ${val} at offset ${this.offset - 4}`);
        }
        return val;
    }
}
