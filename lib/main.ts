// main builder

import {
    PROJECT_FILE,
    BuildOptions,
} from './conf';
const path = require('path');

const findUp = require('find-up');
const mld = require('my-load-data');

// Find project.
export function findProject(options: BuildOptions): Promise<{
    projdir: string;
    projobj: any;
}>{
    const proj = options.project || PROJECT_FILE;
    const cwd = options.cwd || process.cwd();
    return findUp(proj, {
        cwd,
    }).then(projpath=>{
        if (projpath == null){
            throw new Error(`Cannot find ${proj} from ${cwd}`);
        }
        const projdir = path.dirname(projpath);
        return mld.fromFile(projpath).then(projobj=>({
            projdir,
            projobj,
        }));
    });
}

// Start building.
export function build(options: BuildOptions = {}): Promise<any>{
    return findProject(options);
}
