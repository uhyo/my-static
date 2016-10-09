/// <reference path='../typings/bundle.d.ts' />
// render directory.

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

export interface TemplateRenderFunction{
    (templateString: string, options: any, callback?: any): string;
}
export interface RenderFunction{
    (path: string, outDir: string, options?: any): Promise<null | any>;
}

// Hooks
interface PostLoadDataHook{
    (ctx: RenderContext): void;
}
interface PreRenderHook{
    (ctx: RenderContext, filename: string, data: any): {
        data?: any;
    } | null;
}
interface PostRenderHook{
    (ctx: RenderContext, content: string, target: string, original: string): any;
}
interface UnknownExtensionHook{
    (ctx: RenderContext, ext: string): RenderFunction | null;
}
interface LoadFileHook{
    (ctx: RenderContext, filename: string, binary: boolean): Promise<string | Buffer> | string | Buffer | null;
}
interface PostLoadFileHook{
    (ctx: RenderContext, filename: string, content: string | Buffer): Promise<string | Buffer> | string | Buffer | null;
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
    private postLoadDataHooks: Array<PostLoadDataHook> = [];
    private preRenderHooks: Array<PreRenderHook> = [];
    private postRenderHooks: Array<PostRenderHook> = [];
    private unknownExtensionHooks: Array<UnknownExtensionHook> = [];
    private loadFileHooks: Array<LoadFileHook> = [];
    private postLoadFileHooks: Array<PostLoadFileHook> = [];

    constructor(projdir: string, settings: ProjectSettings){
        this.projdir = projdir;
        this.settings = settings;
    }
    // 拡張子に対応するrendererを読み込む
    public getRenderer(filepath: string): RenderFunction | null{
        const {
            renderers,
            settings,
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
                return (renderers[ext] = renderUtil.makeSimpleRenderer(this, this.localRequire('jade').render, true));
            case '.ejs':
                return (renderers[ext] = renderUtil.makeSimpleRenderer(this, this.localRequire('ejs').render, false));
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

            default: {
                // Unknown Extension is found.
                for (let h of this.unknownExtensionHooks){
                    const f = h(this, ext);
                    if (f != null){
                        return (renderers[ext] = f);
                    }
                }
                return null;
            }
        }
    }
    public addRenderer(ext: string, func: RenderFunction): void{
        const {
            renderers,
        } = this;

        renderers[ext] = func;
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

            // apply PostLoadDataHooks.
            for (let f of this.postLoadDataHooks){
                f(this);
            }
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
    // load extensions
    public loadExtensions(): Promise<any>{
        const {
            projdir,
            settings,
        } = this;
        const {
            extension,
        } = settings;

        const exts: Array<string> = Array.isArray(extension) ? extension : 'string'===typeof extension ? [extension] : [];

        if (exts.length > 0){
            log.verbose('loadExtensions', 'Loading extensions');
        }
        let h: (i: number)=>Promise<any>;
        h = (i: number)=>{
            const jsp = exts[i];
            if (jsp == null){
                log.verbose('loadExtensions', 'Loaded extensions');
                return Promise.resolve();
            }
            const absp = path.resolve(projdir, jsp);
            try {
                const obj = require(absp);
                if ('function' !== typeof obj){
                    log.error('Extension must be a function: %s', absp);
                    return Promise.reject(new Error('Extension must be a function'));
                }
                return Promise.resolve(obj(this)).then(()=> h!(i+1));
            }catch (e){
                log.error('Error loading %s:', absp);
                log.error('[ %s ]', e);
                return Promise.reject(e);
            }
        };
        return h(0);
    }
    // ====================
    // add hooks
    public addPostLoadDataHook(func: PostLoadDataHook): void{
        this.postLoadDataHooks.push(func);
    }
    public addPreRenderHook(func: PreRenderHook): void{
        this.preRenderHooks.push(func);
    }
    public addPostRenderHook(func: PostRenderHook): void{
        this.postRenderHooks.push(func);
    }
    public addUnknownExtensionHook(func: UnknownExtensionHook): void{
        this.unknownExtensionHooks.push(func);
    }
    public addLoadFileHook(func: LoadFileHook): void{
        this.loadFileHooks.push(func);
    }
    public addPostLoadFileHook(func: PostLoadFileHook): void{
        this.postLoadFileHooks.push(func);
    }
    // ====================
    // htmlファイル用に拡張子を付け替える
    public getTargetFile(file: string, outDir: string, outExt: string = this.settings.outExt): string{
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        return path.join(outDir, base + outExt);
    }
    // ファイルをrenderする用にdataを作る
    public makeData(file: string, outDir: string): any{
        let result = Object.assign({
            FILENAME: file,
        }, this.data);
        // apply hooks
        for (let f of this.preRenderHooks){
            const obj = f(this, file, result);
            if (obj != null){
                if (obj.data != null){
                    result = obj.data;
                }
            }
        }
        return result;
    }
    // renderするべきファイルを読み込む
    public loadRenderedFile(file: string, binary: boolean = false): Promise<string | Buffer>{
        // 読み込んでくれるHookを探す
        let loadp: Promise<string | Buffer> | null = null;
        for (let f of this.loadFileHooks){
            const p = f(this, file, binary);
            if (p != null){
                loadp = Promise.resolve(p);
                break;
            }
        }
        if (loadp == null){
            // 該当Hookがなかったので自分で読み込み
            loadp = new Promise((resolve, reject)=>{
                fs.readFile(file, {
                    encoding: binary ? null : 'utf8',
                }, (err, data)=>{
                    if (err != null){
                        reject(err);
                    }else{
                        resolve(data);
                    }
                });
            });
        }
        return loadp.then(data=>{
            // データにhooksをかます
            let p: Promise<string | Buffer> = Promise.resolve(data);
            for (let f of this.postLoadFileHooks){
                p = p.then(data=>{
                    const p2 = f(this, file, data);
                    if (p2 == null){
                        return data;
                    }else{
                        return p2;
                    }
                });
            }
            return p;
        });
    }
    // do stuff around rendering
    public render(original: string, target: string, renderer: ()=>(null | string | Promise<null | string>)): Promise<any>{
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
    public saveFile(file: string, content: any): Promise<any>{
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
        let h: (i: number)=>(content: string)=>Promise<string>;
        h = (i: number)=>{
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
    return globby(pattern, {
        nodir: true,
    }).then(files=>renderFiles(context, files));
}
// ファイルから書き込み対象フォルダも探す
export function renderFiles(context: RenderContext, files: Array<string>): Promise<any>{
    const {
        settings: {
            rootDir,
            outDir,
        },
    } = context;
    const files2: Array<{
        file: string;
        outDir: string;
    }> = [];
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
    let h: (i: number)=>Promise<any>;
    h = (i: number)=>{
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
                const data = context.makeData(f, outDir);
                resolve(r(f, outDir, data));
            }
        });
    });
}

// renderers
export namespace renderUtil{
    // expressのあれに対応したrendererを作る
    export function makeExpressRenderer(ctx: RenderContext, func: TemplateRenderFunction): RenderFunction{
        return (file: string, outDir: string, options?: any)=>{
            const target = ctx.getTargetFile(file, outDir);
            // まずファイルを読み込む
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
    // jadeとか
    export function makeSimpleRenderer(ctx: RenderContext, func: TemplateRenderFunction, needCallback: boolean): RenderFunction{
        return (file: string, outDir: string, options?: any)=>{
            const target = ctx.getTargetFile(file, outDir);
            // まずファイルを読み込む
            return ctx.render(file, target, ()=>{
                return ctx.loadRenderedFile(file, false).then(data=>{
                    return new Promise((resolve, reject)=>{
                        const o = Object.assign({
                            filename: file,
                        }, options);
                        if (needCallback){
                            func(data as string, o, (err, html)=>{
                                if (err != null){
                                    reject(err);
                                }else{
                                    resolve(html);
                                }
                            });
                        }else{
                            resolve(func(data as string, o));
                        }
                    });
                });
            });
        };
    }
    // export function makeJadeRender(ctx: RenderContext, func: 
    // dustjsのrendererを作る
    export function makeDustjsRenderer(ctx: RenderContext): RenderFunction {
        const dust = ctx.localRequire('dustjs-linkedin');
        dust.config.whitespace = true;
        dust.config.cache = false;
        ctx.localRequire('dustjs-helpers');

        const {
            projdir,
            settings,
        } = ctx;

        const result: RenderFunction = (file: string, outDir: string, options?: any)=>{
            const target = ctx.getTargetFile(file, outDir);
            return ctx.render(file, target, ()=> new Promise((resolve, reject)=>{
                // onload hook
                dust.onLoad = (templatepath: string, callback: (err: any, content: string | null)=>void)=>{
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
                    const abp = path.resolve(path.dirname(file), tp);
                    ctx.loadRenderedFile(abp, false)
                    .then(data=> callback(null, data as string))
                    .catch(err=> callback(err, null));
                };
                dust.render(file, options, (err, html)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    resolve(html);
                });
            }));
        };

        // dustをくっつける (for extension)
        (result as any).dust = dust;
        return result;
    }
    // 静的ファイルのrendererを作る
    export function makeStaticRenderer(ctx: RenderContext): RenderFunction {
        return (file: string, outDir: string)=>{
            const base = path.basename(file);
            const target = path.join(outDir, base);

            return ctx.render(file, target, ()=>ctx.loadRenderedFile(file, true));
        };
    }
    // sass
    export function makeSassRenderer(ctx: RenderContext): RenderFunction {
        return (file: string, outDir: string)=>{
            const target = ctx.getTargetFile(file, outDir, '.css');
            return ctx.render(file, target, ()=>{
                return ctx.loadRenderedFile(file, false).then(data=> new Promise<string | null>((resolve, reject)=>{
                    const sass = ctx.localRequire('node-sass');
                    if (sass == null){
                        log.verbose('sassRenderer', 'skipped %s : node-sass does not exist', file);
                        resolve(null);
                        return;
                    }
                    sass.render({
                        file,
                        data,
                    }, (err, result)=>{
                        if (err != null){
                            log.error('Error rendering %s: [ %s ]', file, err);
                            reject(err);
                            return;
                        }
                        resolve(result.css);
                    });
                }));
            });
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
