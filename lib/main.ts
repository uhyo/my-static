// main builder

import {
    BuildOptions,
    ProjectSettings,
    defaultBuildOptions,
    overwriteSettings,
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
    options: BuildOptions;
    settings: ProjectSettings;
}
// Find project.
export function findProject(options: BuildOptions): Promise<FoundProject>{
    const {cwd} = options;
    return findUp(options.project, {
        cwd,
    }).then(projpath=>{
        if (projpath == null){
            throw new Error(`Cannot find ${options.project} from ${cwd}`);
        }
        const projdir = path.dirname(projpath);
        return mld.fromFile(projpath).then(settings=>({
            projdir,
            options,
            settings,
        }));
    });
}
// read data.
export function makeContext({projdir, options, settings}: FoundProject): Promise<RenderContext>{
    settings = overwriteSettings(options, settings);
    if (settings.rootDir){
        settings.rootDir = path.resolve(projdir, settings.rootDir);
    }else{
        settings.rootDir = projdir;
    }
    if (settings.outDir){
        settings.outDir = path.resolve(projdir, settings.outDir);
    }
    // data directory.
    if ('string' !== typeof settings.data){
        return Promise.resolve(new RenderContext(projdir, {}, settings));
    }

    const datadir = path.resolve(projdir, settings.data);
    return loadData(datadir).then(data=>new RenderContext(projdir, data, settings));
}

// Build files.
export function render(context: RenderContext): Promise<any>{
    const {
        projdir,
        settings,
    } = context;
    const {
        rootDir,
        outDir,
    } = settings;
    if (!outDir){
        return Promise.reject(new Error('outDir is not provided'));
    }
    // rootDirが相対パスかもしれないので
    const r = path.resolve(projdir, rootDir);
    return renderDirectory(context, r, outDir);
}

// Start building.
export function build(options: BuildOptions = {}): Promise<any>{
    defaultBuildOptions(options);
    return findProject(options).then(makeContext).then(render);
}
