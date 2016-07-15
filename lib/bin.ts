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

import * as log from './log';

cli.enable('version');

const pkg = require(path.join(pkgDir.sync(__dirname), 'package.json'));

cli.parse({
    project: ['p', 'Project file', 'path'],
    outDir: ['o', 'Output directory', 'path'],
    watch: ['w', 'Watch'],
    force: ['f', 'Force all files to be re-rendered'],
    // logs
    quiet: ['q', 'Quiet logs'],
    verbose: [null, 'Verbose logs'],
});

cli.main((args, options)=>{
    if (options.quiet){
        log.setLogLevel(log.LogLevel.error);
    }
    if (options.verbose){
        log.setLogLevel(log.LogLevel.verbose);
    }

    build({
        project: options.project,
        outDir: options.outDir,
        watch: !!options.watch,
        force: !!options.force,
        target: args.length > 0 ? args : null,
    }).then(()=>{
        log.info('Build done.');
    }).catch(e=>{
        if (e){
            log.error(e);
            if (e.stack){
                console.error(e.stack);
            }
        }
        process.exit(1);
    });
});
