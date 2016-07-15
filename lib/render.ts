/// <reference path='../typings/bundle.d.ts' />
// render directory.
//
import {
    ProjectSettings,
} from './conf';
import {
    loadData,
    getMTime,
} from './load-data';

import * as log from './log';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const resolve = require('resolve');
const globby = require('globby');

export interface ExpressFriendlyRenderFunction{
    (path: string, options: any, callback: any): void;
}
export interface RenderFunction{
    (path: string, outDir: string, options?: any): Promise<any>;
}

// Hooks
interface PostRenderHook{
    (ctx: RenderContext, content: string, target: string, original: string): any;
}

export class RenderContext{
    public projdir: string;
    public data: any;
    public settings: ProjectSettings;
    private basemtime: number = -Infinity;
    private renderers: {
        [ext: string]: RenderFunction;
    } = {};
    // hooks
    private postRenderHooks: Array<PostRenderHook> = [];

    constructor(projdir: string, settings: ProjectSettings){
        this.projdir = projdir;
        this.settings = settings;
    }
    // 拡張子に対応するrendererを読み込む
    public getRenderer(filepath: string): RenderFunction {
        const {
            renderers,
        } = this;
        const ext = path.extname(filepath).toLowerCase();
        // from renderer cache
        const f = renderers[ext];
        if (f !=null){
            return f;
        }
        // built-in renderers
        switch (ext){
            // Template Engines
            case '.jade':
                return (renderers[ext] = renderUtil.makeExpressRenderer(this, this.localRequire('jade').__express));
            case '.ejs':
                return (renderers[ext] = renderUtil.makeExpressRenderer(this, this.localRequire('ejs').__express));
            case '.dust':
                return (renderers[ext] = renderUtil.makeDustjsRenderer(this));

            // Static Files
            case '.html':
            case '.htm':
            case '.css':
            case '.js':
                return (renderers[ext] = renderUtil.makeStaticRenderer(this));

            // Others
            case '.sass':
            case '.scss':
                return (renderers[ext] = renderUtil.makeSassRenderer(this));

            default:
                return null;
        }

    }
    // require modules from local project is possible
    public localRequire(name: string): any{
        let result = null;
        try {
            const lc = resolve.sync(name, {
                basedir: this.projdir,
            });
            if (lc){
                result = require(lc);
                log.verbose('localRequire', 'Required %s from %s', name, lc);
            }
        }finally {
            if (result == null){
                try {
                    result = require(name);
                    log.verbose('localRequire', 'Required bundled %s', name);
                }catch (e){
                    log.warning('Failed to require %s', name);
                }
            }
            return result;
        }
    }
    // load data into context
    public loadData(): Promise<any>{
        const {
            projdir,
            settings,
        } = this;
        const {
            force,
        } = settings;

        if ('string' !== typeof settings.data){
            log.verbose('makeContext', 'data directory is not specified.');
            this.data = {};
            return Promise.resolve();
        }
        const datadir = path.resolve(projdir, settings.data);
        const cachefile = !force && ('string' === typeof settings.cache) ? path.resolve(projdir, settings.cache) : null;

        log.verbose('loadData', 'datadir: %s', datadir);
        if (cachefile != null && this.data == null){
            log.verbose('loadData', 'cachefile: %s', datadir);
        }
        return loadData(datadir, cachefile, this.data).then(data=>{
            const datamtime = data ? data['$mtime'] || null : null;
            if (datamtime != null && isFinite(datamtime)){
                log.verbose('loadData', 'Last modified time of datadir: %s', new Date(datamtime));
                this.basemtime = Math.max(datamtime, this.basemtime);
            }
            this.data = data || {};
        });
    }
    // read mtime of dependencies.
    public readDependency(): Promise<any>{
        const {
            projdir,
            settings,
        } = this;
        const {
            dependency,
        } = settings;
        const dependency_a = Array.isArray(dependency) ? dependency : dependency ? [dependency] : [];
        const dependency_aa = dependency_a.map(p=>path.resolve(projdir, p));
        return getMTime(dependency_aa).then(mtime=>{
            if (mtime != null && isFinite(mtime)){
                log.verbose('loadData', 'Last modified time of other dependencies: %s', new Date(mtime));
                this.basemtime = Math.max(mtime, this.basemtime);
            }
        });
    }
    // ====================
    // add hooks
    public addPostRenderHook(func: PostRenderHook): void{
        this.postRenderHooks.push(func);
    }
    // ====================
    // htmlファイル用に拡張子を付け替える
    public getTargetFile(file: string, outDir: string, outExt: string = this.settings.outExt): string{
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        return path.join(outDir, base + outExt);
    }
    // do stuff around rendering
    public render(original: string, target: string, renderer: ()=>(string | Promise<string>)): Promise<any>{
        return new Promise((resolve, reject)=>{
            const doRender = ()=>{
                // request a render.
                const p = Promise.resolve(renderer());
                const p2 = p.then(content=>new Promise((resolve, reject)=>{
                    if (content == null){
                        // ???
                        log.verbose('render', 'Skipped rendering %s: due to null content', target);
                        resolve();
                        return;
                    }
                    // apply postRenderHooks here.
                    this.applyPostRenderHooks(content, target, original).then(content=>{
                        // save to the target file.
                        const dir = path.dirname(target);
                        mkdirp(dir, err=>{
                            if (err != null){
                                reject(err);
                            }
                            resolve(this.saveFile(target, content));
                        });
                    });
                }));
                resolve(p2);
            };
            if (this.settings.force){
                // no need to check mtime
                doRender();
                return;
            }
            // stat original file and target file.
            fs.stat(original, (err, st)=>{
                if (err != null){
                    reject(err);
                    return;
                }
                const orig_mtime = st.mtime.getTime();
                const data_mtime = Math.max(orig_mtime, this.basemtime != null ? this.basemtime : -Infinity);
                fs.stat(target, (err, st)=>{
                    // for target file
                    if (err != null){
                        if (err.code !== 'ENOENT'){
                            reject(err);
                            return;
                        }
                    }
                    const target_mtime = st ? st.mtime.getTime() : -Infinity;
                    // mtimeを比較してrerenderするか決定
                    if (target_mtime >= data_mtime){
                        // No need to rerender
                        log.verbose('render', 'Skipped rendering %s: no need to rerender', original);
                        resolve();
                        return;
                    }
                    doRender();
                });
            });
        });
    }
    // ----- util for render.
    // このファイルはrerenderが必要か
    // target: 書き込み対象ファイル名
    // mtime: 元のファイルのmtime
    public needsRender(target: string, mtime?: number): Promise<boolean>{
        if (mtime == null){
            return Promise.resolve(true);
        }
        return new Promise((resolve, reject)=>{
            fs.stat(target, (err, st)=>{
                if (err != null){
                    if (err.code === 'ENOENT'){
                        // ファイルがないので書く必要がある
                        resolve(true);
                    }else{
                        reject(err);
                    }
                    return;
                }
                const m = st.mtime.getTime();
                resolve(m < mtime || (this.basemtime != null && m < this.basemtime));
            });
        });
    }
    // ファイルにかきこみ （変更がないファイルはアレしない）
    public saveFile(file: string, content: string): Promise<any>{
        return new Promise((resolve, reject)=>{
            fs.writeFile(file, content, err=>{
                if (err != null){
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    private applyPostRenderHooks(content: string, target: string, original: string): Promise<string>{
        const h = (i: number)=>{
            const hook = this.postRenderHooks[i];
            if (hook == null){
                return (content: string)=> Promise.resolve(content);
            }
            return (content: string)=>{
                // apply i-th hook
                const p = Promise.resolve(hook(this, content, target, original));
                return p.then(h(i+1));
            };
        };

        return h(0)(content);
    }
}

export function renderGlob(context: RenderContext, pattern: Array<string>): Promise<any>{
    const {
        settings: {
            rootDir,
            outDir,
        },
    } = context;
    return globby(pattern).then(files=>renderFiles(context, files));
}
// ファイルから書き込み対象フォルダも探す
export function renderFiles(context: RenderContext, files: Array<string>): Promise<any>{
    const {
        settings: {
            rootDir,
            outDir,
        },
    } = context;
    const files2 = [];
    for (let f of files){
        const r = path.relative(rootDir, f);
        if (r.split(path.sep, 1)[0] === '..'){
            // rootDirをでている
            log.error('Target file %s is out of the root directory %s', f, rootDir);
            return Promise.reject(new Error('Failed to render files'));
        }
        files2.push({
            file: f,
            outDir: path.join(outDir, path.dirname(r)),
        });
    }
    return renderFilesAt(context, files2);
}

function renderFilesAt(context: RenderContext, files: Array<{
    // files
    file: string;
    outDir: string;
}>): Promise<any>{
    // 複数ファイルをsequentialにrenderする
    const h = (i: number)=>{
        const f = files[i];
        if (f == null){
            return Promise.resolve();
        }
        const {
            file,
            outDir,
        } = f;
        return renderFile(context, file, outDir).then(()=> h(i+1));
    };
    return h(0);
}

export function renderDirectory(context: RenderContext, dir: string, outDir: string): Promise<any>{
    return new Promise((resolve, reject)=>{
        log.verbose('renderDirectory', 'Started rendering directory %s', dir);
        log.verbose('renderDirectory', 'Destination directory for this directory is: %s', outDir);
        fs.readdir(dir, (err, files)=>{
            if (err != null){
                reject(err);
                return;
            }
            const ps = files.map(f => ({
                file: path.join(dir, f),
                outDir,
            }));
            resolve(renderFilesAt(context, ps).then(()=>{
                log.verbose('renderDirectory', 'Finished rendering directory %s', dir);
            }));
        });
    });
}

// fileを1つrenderして保存
export function renderFile(context: RenderContext, f: string, outDir: string): Promise<any>{
    return new Promise((resolve, reject)=>{
        fs.stat(f, (err, st)=>{
            if (err != null){
                reject(err);
            }
            if (st.isDirectory()){
                // recursively process directories
                resolve(renderDirectory(context, f, path.join(outDir, path.basename(f))));
            }else{
                // This is a file! 
                const r = context.getRenderer(f);
                if (r == null){
                    // 対応するRendererがない
                    log.verbose('renderFile', 'skip: no renderer for %s', f);
                    resolve();
                    return;
                }
                log.verbose('renderFile', 'Rendering file %s', f);
                resolve(r(f, outDir, context.data));
            }
        });
    });
}

// renderers
namespace renderUtil{
    // expressのあれに対応したrendererを作る
    export function makeExpressRenderer(ctx: RenderContext, func: ExpressFriendlyRenderFunction): RenderFunction{
        return (file: string, outDir: string, options?: any)=>{
            const target = ctx.getTargetFile(file, outDir);
            return ctx.render(file, target, ()=>new Promise((resolve, reject)=>{
                func(file, options, (err, html)=>{
                    if (err != null){
                        reject(err);
                    }else{
                        resolve(html);
                    }
                });
            }));
        };
    }
    // dustjsのrendererを作る
    export function makeDustjsRenderer(ctx: RenderContext): RenderFunction {
        const dust = ctx.localRequire('dustjs-linkedin');
        ctx.localRequire('dustjs-helpers');

        const {
            projdir,
            settings,
        } = ctx;

        return (file: string, outDir: string, options?: any)=>{
            const target = ctx.getTargetFile(file, outDir);
            return ctx.render(file, target, ()=>new Promise((resolve, reject)=>{
                fs.readFile(file, (err, buf)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    // onload hook
                    dust.onLoad = (templatepath: string, callback: (err: any, content: string)=>void)=>{
                        // dust用の便利なあれ
                        const tp = templatepath.replace(/\$(\w+)(?!\w)/g, (al: string, name: string)=>{
                            switch (name.toLowerCase()){
                                case 'proj':
                                    return projdir;
                                case 'root':
                                    return settings.rootDir;
                                default:
                                    return al;
                            }
                        });
                        fs.readFile(path.resolve(path.dirname(file), tp), 'utf8', callback);
                    };
                    const t = dust.compile(buf.toString(), path);
                    dust.loadSource(t);
                    dust.render(file, options, (err, html)=>{
                        if (err != null){
                            reject(err);
                            return;
                        }
                        resolve(html);
                    });
                });
            }));
        };
    }
    // 静的ファイルのrendererを作る
    export function makeStaticRenderer(ctx: RenderContext): RenderFunction {
        return (file: string, outDir: string)=>{
            const base = path.basename(file);
            const target = path.join(outDir, base);

            return ctx.render(file, target, ()=>new Promise((resolve, reject)=>{
                fs.readFile(file, (err, buf)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    resolve(buf.toString());
                });
            }));
        };
    }
    // sass
    export function makeSassRenderer(ctx: RenderContext): RenderFunction {
        return (file: string, outDir: string)=>{
            const target = ctx.getTargetFile(file, outDir, '.css');
            return ctx.render(file, target, ()=>new Promise((resolve, reject)=>{
                const sass = ctx.localRequire('node-sass');
                if (sass == null){
                    log.verbose('sassRenderer', 'skipped %s : node-sass does not exist', file);
                    resolve(null);
                    return;
                }
                sass.render({
                    file,
                }, (err, result)=>{
                    if (err != null){
                        log.error('Error rendering %s: [ %s ]', file, err);
                        reject(err);
                        return;
                    }
                    resolve(result.css);
                });
            }));
        };
    }

    // ただファイルに保存
    function mkdirpsave(ctx: RenderContext, file: string, content: string): Promise<any>{
        // 拡張子を変える
        const dir = path.dirname(file);
        return new Promise((resolve, reject)=>{
            mkdirp(dir, err=>{
                if (err != null){
                    reject(err);
                }else{
                    resolve(ctx.saveFile(file, content));
                }
            });
        });
    }
}
