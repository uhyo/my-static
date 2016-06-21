// main builder

import {
    defaultOptions,
    BuildOptions,
} from './conf';
import {
    RenderContext,
    renderDirectory,
} from './render';
const path = require('path');

const findUp = require('find-up');
const mld = require('my-load-data');

interface FoundProject{
    projdir: string;
    projobj: any;
    options: BuildOptions;
}
// Find project.
export function findProject(options: BuildOptions): Promise<FoundProject>{
    const cwd = options.cwd || process.cwd();

    return findUp(options.project, {
        cwd,
    }).then(projpath=>{
        if (projpath == null){
            throw new Error(`Cannot find ${options.project} from ${cwd}`);
        }
        const projdir = path.dirname(projpath);
        return mld.fromFile(projpath).then(projobj=>({
            projdir,
            projobj,
            options,
        }));
    });
}

// Build files.
export function render({projdir, projobj, options}: FoundProject): Promise<any>{
    const context: RenderContext = {
        projdir,
        data: {},
        options,
        renderers: {},
    };
    const {outDir} = options;
    if (!outDir){
        return Promise.reject(new Error('outDir is not provided'));
    }
    return renderDirectory(context, projdir, outDir);
}

// Start building.
export function build(options: BuildOptions = {}): Promise<any>{
    // Default options
    options = (Object as any).assign({}, defaultOptions, options);

    return findProject(options).then(render);
}
