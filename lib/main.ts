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
    getMTime,
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
        return Promise.resolve(new RenderContext(projdir, {}, null, settings));
    }
    // cache?
    const {
        cache,
        dependency,
    } = settings;
    const cachedir = 'string' === typeof cache ? path.resolve(projdir, cache) : null;

    const datadir = path.resolve(projdir, settings.data);
    const dependency_a = Array.isArray(dependency) ? dependency : dependency ? [dependency] : [];
    const dependency_aa = dependency_a.map(p=>path.resolve(projdir, p));
    return Promise.all([getMTime(dependency_aa), loadData(datadir, cachedir)]).then(([mtime, data])=>{
        // dataの最終更新時間
        const datamtime = data ? data['$mtime'] || null : null;
        const basemtime = Math.max(mtime, datamtime);
        return new RenderContext(projdir, data, basemtime, settings);
    });
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
