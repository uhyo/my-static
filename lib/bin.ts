///<reference path="../typings/bundle.d.ts" />
const path = require('path');
const pkgDir = require('pkg-dir');
const cli = require('cli');

import {
    BuildOptions,
} from './conf';
import {
    build,
} from './main';

cli.enable('version');

const pkg = require(path.join(pkgDir.sync(__dirname), 'package.json'));

cli.parse({
    project: ['p', 'Project file', 'path'],
    outDir: ['o', 'Output directory', 'path'],
});

cli.main((args, options)=>{
    build({
        project: options.project,
        outDir: options.outDir,
    }).then(()=>{
        // TODO
        process.exit(0);
    }).catch(e=>{
        console.error(e);
        process.exit(1);
    });
});
