// main builder

import {
    BuildOptions,
    ProjectSettings,
    defaultBuildOptions,
    overwriteSettings,
} from './conf';
import {
    RenderContext,
    renderGlob,
    renderFiles,
} from './render';
import {
    watchProject,
} from './watch';
import {
    loadData,
    getMTime,
} from './load-data';

import * as log from './log';

const path = require('path');

const findUp = require('find-up');
const watch = require('watch');
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
    if ('string' === typeof settings.target){
        // 文字列も許したいから無理やりキャスト
        settings.target = [settings.target as any as string];
    }
    if (Array.isArray(settings.target)){
        // 相対パスだと困るから
        settings.target = settings.target.map(p=> path.resolve(projdir, p));
    }else{
        // デフォルトは全部
        settings.target = [path.join(settings.rootDir, '*')];
    }
    log.verbose('makeContext', 'rootDir: %s', settings.rootDir);
    log.verbose('makeContext', 'target: %s', settings.target.join(', '));
    if (settings.outDir){
        settings.outDir = path.resolve(projdir, settings.outDir);
    }
    if (!settings.outDir){
        log.error('outDir is not provided');
        return Promise.reject(new Error('outDir is not provided'));
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
        target,
    } = settings;
    // rootDirが相対パスかもしれないので
    return renderGlob(context, target);
}

// Watch.
export function watchToRender(context: RenderContext): any{
    watchProject(context).then(monitor=>{
        log.info('Watch started.');
        const {
            settings: {
                rootDir,
            },
        } = context;
        // Rendering flag.
        let rendering = false;
        monitor.on('updated', (f, stat)=>{
            if (rendering === false){
                rendering = true;
                // ビルド対象ファイルがアップデートしたのでそれだけ更新
                log.info('Target file is updated. Rerendering...');
                renderFiles(context, [f]).then(()=>{
                    log.info('Rendering done.');
                }).catch(e=>log.error(e)).then(()=>{
                    rendering = false;
                });
            }
        });
        monitor.on('removed', (f, stat)=>{
            // TODO
            log.verbose('watchToRender', 'Target file is removed');
        });
        monitor.on('data-updated', (f, curr, prev)=>{
            if (rendering === false){
                rendering = true;
                log.info('Dependency directory is updated. Rerendering...');
                render(context).then(()=>{
                    log.info('Rendering done.');
                }).catch(e=>log.error(e)).then(()=>{
                    rendering = false;
                });
            }
        });
    }).catch(e=>log.error(e));
}

// Start building.
export function build(options: BuildOptions = {}): Promise<any>{
    defaultBuildOptions(options);

    const action = options.watch ? (context=>render(context).then(()=>watchToRender(context))) : render;
    return findProject(options).then(makeContext).then(action);
}
