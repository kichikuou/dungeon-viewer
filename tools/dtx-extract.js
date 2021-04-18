#!/usr/bin/env node
import arg from 'arg';
import fs from 'fs';
import path from 'path';
import {Dtex} from '../docs/dtex.js';

const args = arg({
    '--help': Boolean,
    '--output': String,
    // aliases
    '-h': '--help',
    '-o': '--output',
});

if (args['--help'] || args._.length !== 1) {
    console.log('usage: node dtx-extract.js [options] <input.dtx>');
    console.log('    Extract a dtx archive');
    console.log('Options:');
    console.log('    -h, --help          Print this message and exit');
    console.log('    -o, --output <dir>  Extract files into <dir>');
    process.exit(args['--help'] ? 0 : 1);
}

const data = fs.readFileSync(args._[0]);
const dtex = new Dtex(data.buffer);

if (args['--output'])
    fs.mkdirSync(args['--output'], {recursive: true});

for (let i = 0; i < dtex.nr_rows; i++) {
    for (let j = 0; j < dtex.nr_cols; j++) {
        const buf = dtex.get(i, j);
        if (!buf)
            continue;
        let outPath = `${i}_${j}.qnt`;
        if (args['--output'])
            outPath = path.join(args['--output'], outPath);
        console.log(outPath);
        fs.writeFileSync(outPath, buf);
    }
}
