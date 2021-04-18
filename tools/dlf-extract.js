#!/usr/bin/env node
import arg from 'arg';
import fs from 'fs';
import path from 'path';
import {BufferReader} from '../docs/buffer.js';

const args = arg({
    '--help': Boolean,
    '--output': String,
    // aliases
    '-h': '--help',
    '-o': '--output',
});

if (args['--help'] || args._.length !== 1) {
    console.log('usage: node dlf-extract.js [options] DungeonData.dlf');
    console.log('    Extract a dlf archive');
    console.log('Options:');
    console.log('    -h, --help          Print this message and exit');
    console.log('    -o, --output <dir>  Extract files into <dir>');
    process.exit(args['--help'] ? 0 : 1);
}

const dlfHeaderSize = 0x20 + 99 * 3 * 8;
const fd = fs.openSync(args._[0], 'r');
const headerBuf = Buffer.alloc(dlfHeaderSize);
if (fs.readSync(fd, headerBuf, 0, dlfHeaderSize) !== dlfHeaderSize)
    throw new Error('read error');

const r = new BufferReader(headerBuf.buffer);
if (r.readFourCC() !== "DLF\0") {
    throw new Error('not a dlf file');
}

if (args['--output'])
    fs.mkdirSync(args['--output'], {recursive: true});

r.offset = 0x20;
for (let i = 1; i <= 99; i++) {
    const dgnOffset = r.readU32();
    const dgnLength = r.readU32();
    const dtxOffset = r.readU32();
    const dtxLength = r.readU32();
    const tesOffset = r.readU32();
    const tesLength = r.readU32();
    const s = i < 10 ? '0' + i : i;
    if (dgnOffset)
        extract(`map${s}.dgn`, fd, dgnOffset, dgnLength);
    if (dtxOffset)
        extract(`map${s}.dtx`, fd, dtxOffset, dtxLength);
    if (tesOffset)
        extract(`map${s}.tes`, fd, tesOffset, tesLength);
}

function extract(fname, fd, offset, length) {
    const buf = Buffer.alloc(length);
    if (fs.readSync(fd, buf, 0, length, offset) !== length)
        throw new Error('read error');
    if (args['--output'])
        fname = path.join(args['--output'], fname);
    console.log(fname);
    fs.writeFileSync(fname, buf);
}
