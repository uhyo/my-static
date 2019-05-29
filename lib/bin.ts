import * as path from 'path';
import * as pkgDir from 'pkg-dir';
import * as cli from 'cli';

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
    force: ['f', 'Force all files to be re-rendered'],
    nobuild: [null, 'Disable startup building.'],
    watch: ['w', 'Watch'],
    server: ['s', 'Enable web server for testing.'],
    port: [null, 'Port number of web server.', 'number'],

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
        build: !options.nobuild,
        watch: !!options.watch,
        force: !!options.force,
        target: args.length > 0 ? args : null,
        server: !!options.server,
        port: options.port,
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
