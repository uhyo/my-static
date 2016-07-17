// main builder

import {
    BuildOptions,
    ProjectSettings,
    FoundProject,
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
    startServer,
} from './server';
import {
    loadData,
    getMTime,
} from './load-data';

import * as log from './log';

const path = require('path');

const findUp = require('find-up');
const watch = require('watch');
const mld = require('my-load-data');

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
// sanitize settings.
export function sanitize({projdir, options, settings}: FoundProject): Promise<FoundProject>{
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
        settings.target = [path.join(settings.rootDir, '**', '*')];
    }
    log.verbose('sanitize', 'rootDir: %s', settings.rootDir);
    log.verbose('sanitize', 'target: %s', settings.target.join(', '));
    if (settings.outDir){
        settings.outDir = path.resolve(projdir, settings.outDir);
    }
    if (!settings.outDir){
        log.error('outDir is not provided');
        return Promise.reject(new Error('outDir is not provided'));
    }
    log.verbose('sanitize', 'outDir: %s', settings.outDir);
    return Promise.resolve({
        projdir,
        options,
        settings,
    });
}
// read data.
export function makeContext({projdir, options, settings}: FoundProject): Promise<RenderContext>{
    // make context.
    const ctx = new RenderContext(projdir, settings);
    return Promise.all([ctx.loadData(), ctx.readDependency()]).then(()=> ctx.loadExtensions()).then(()=> ctx);
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
    return renderGlob(context, target).then(()=>{
        log.info('Build done.');
    });
}

// Watch.
export function watchToRender(context: RenderContext): any{
    watchProject(context).then(monitor=>{
        log.info('Watch started.');
        const {
            settings: {
                rootDir,
                data,
            },
        } = context;
        // Rendering flag.
        let rendering = false;
        monitor.on('updated', f=>{
            if (rendering === false){
                rendering = true;
                // ビルド対象ファイルがアップデートしたのでそれだけ更新
                log.info('Target file is updated. Rerendering...');
                log.verbose('watchToRender', 'Updated file: %s', f);
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
        monitor.on('data-updated', f=>{
            if (rendering === false){
                rendering = true;
                log.info('Dependency directory is updated. Rerendering...');
                log.verbose('watchToRender', 'Updated file: %s', f);
                context.loadData().then(()=>render(context)).then(()=>{
                    log.info('Rendering done.');
                }).catch(e=>log.error(e)).then(()=>{
                    rendering = false;
                });
            }
        });
        monitor.on('dep-updated', f=>{
            if (rendering === false){
                rendering = true;
                log.info('Dependency directory is updated. Rerendering...');
                context.readDependency().then(()=>render(context)).then(()=>{
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

    // Find Project.
    return findProject(options).then(sanitize).then((fp: FoundProject)=>{
        const {
            projdir,
            options,
            settings,
        } = fp;
        // naxt work?
        const ps = [];
        if (options.build || options.watch){
            // load context and...
            const p1 = makeContext(fp).then(context=>{
                // build and/or watch
                const p2 = options.build ? render(context) : Promise.resolve();
                const p3 = options.watch ? p2.then(watchToRender(context)) : p2;
                return p3;
            });
            ps.push(p1);
        }
        if (options.server){
            // enable server
            ps.push(startServer(fp));
        }
        return Promise.all(ps);
    });
}
