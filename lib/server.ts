import {
    FoundProject,
} from './conf';
import * as log from './log';

const path = require('path');

// Start server for output directory.
export function startServer({projdir, options, settings}: FoundProject): Promise<any>{
    return new Promise((resolve, reject)=>{
        const {
            outDir,
            server,
        } = settings;
        let {
            port,
            contentRoot,
        } = server || {
            port: null,
            contentRoot: null,
        };
        if (!port){
            port = 8080;
        }
        if (!contentRoot){
            contentRoot = '/';
        }
        const express = require('express');

        const app = express();
        app.use(contentRoot, express.static(outDir));
        app.listen(port);

        log.info('myst server is listening at http://localhost:%d%s', port, contentRoot);
        resolve();
    });
}
