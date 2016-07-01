// main builder

import {
    defaultOptions,
    BuildOptions,
    ProjectSettings,
} from './conf';
import {
    RenderContext,
    renderDirectory,
} from './render';
import {
    loadData,
} from './load-data';
const path = require('path');

const findUp = require('find-up');
const mld = require('my-load-data');

interface FoundProject{
    projdir: string;
    projobj: ProjectSettings;
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
// read data.
export function makeContext({projdir, projobj, options}: FoundProject): Promise<RenderContext>{
    // data directory.
    const renderers = {};
    if ('string' !== typeof projobj.data){
        return Promise.resolve({
            projdir,
            data: {},
            options,
            renderers,
        });
    }

    const datadir = path.join(projdir, projobj.data);
    return loadData(datadir).then(data=>({
        projdir,
        data,
        options,
        renderers,
    }));
}

// Build files.
export function render(context: RenderContext): Promise<any>{
    const {
        projdir,
        options,
    } = context;
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

    return findProject(options).then(makeContext).then(render);
}
