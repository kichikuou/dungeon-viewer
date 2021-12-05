export function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as ArrayBuffer); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}

export class BufferReader {
    private view: DataView;
    public offset = 0;

    constructor(buf: ArrayBuffer) {
        this.view = new DataView(buf);
    }

    get buffer(): ArrayBuffer {
        return this.view.buffer;
    }

    readU32(): number {
        const val = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readS32(): number {
        const val = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readF32(): number {
        const val = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readFourCC(): string {
        const fourcc = new Uint8Array(this.view.buffer, this.offset, 4);
        this.offset += 4;
        return String.fromCharCode.apply(null, Array.from(fourcc));
    }

    readBytes(len: number): Uint8Array {
        const bytes = new Uint8Array(this.view.buffer, this.offset, len);
        this.offset += len;
        return bytes;
    }

    readStrZ(): Uint8Array {
        const begin = this.offset;
        while (this.view.getUint8(this.offset) !== 0) {
            this.offset++;
        }
        this.offset++;
        return new Uint8Array(this.view.buffer, begin, this.offset - 1 - begin);
    }

    expectU32(expected: number): number {
        const val = this.readU32();
        if (val !== expected) {
            throw new Error(`Expected ${expected} but got ${val} at offset ${this.offset - 4}`);
        }
        return val;
    }
}
