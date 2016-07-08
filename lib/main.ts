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

import * as log from './log';

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
    const {
        cwd,
        project,
    } = options;
    log.verbose('findProject', 'cwd: %s', cwd);
    log.verbose('findProject', 'project file: %s', project);

    return findUp(project, {
        cwd,
    }).then(projpath=>{
        if (projpath == null){
            log.error('Cannot find %s from %s', project, cwd);
            throw new Error(`Cannot find ${options.project} from ${cwd}`);
        }
        log.info('Using project file %s', projpath);
        const projdir = path.dirname(projpath);
        return mld.fromFile(projpath).then(settings=>({
            projdir,
            options,
            settings,
        })).catch(e=>{
            log.error('Error loading %s: [ %s ]', projpath, e);
            throw e;
        });
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
    log.verbose('makeContext', 'rootDir: %s', settings.rootDir);
    if (settings.outDir){
        settings.outDir = path.resolve(projdir, settings.outDir);
    }
    log.verbose('makeContext', 'outDir: %s', settings.outDir);
    // data directory.
    if ('string' !== typeof settings.data){
        log.verbose('makeContext', 'data directory is not specified.');
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
    log.verbose('makeContext', 'datadir: %s', datadir);

    return Promise.all([getMTime(dependency_aa), loadData(datadir, cachedir)]).then(([mtime, data])=>{
        // dataの最終更新時間
        const datamtime = data ? data['$mtime'] || null : null;
        const basemtime = Math.max(mtime, datamtime);
        log.verbose('makeContext', 'Last modified time of datadir: %s', new Date(datamtime));
        log.verbose('makeContext', 'Last modified time of other dependencies: %s', new Date(mtime));
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
        log.error('outDir is not provided');
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
