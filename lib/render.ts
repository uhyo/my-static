/// <reference path='../typings/bundle.d.ts' />
// render directory.
//
import {
    ProjectSettings,
} from './conf';

import * as log from './log';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const resolve = require('resolve');

export interface ExpressFriendlyRenderFunction{
    (path: string, options: any, callback: any): void;
}
export interface RenderFunction{
    (path: string, outDir: string, options?: any): Promise<any>;
}
/*
export interface RenderContext{
    projdir: string;
    data: any;
    settings: ProjectSettings;
    renderers: {
        [ext: string]: ExpressFriendlyRenderFunction;
    };
}
*/
export class RenderContext{
    public projdir: string;
    public data: any;
    public settings: ProjectSettings;
    private renderers: {
        [ext: string]: RenderFunction;
    };
    private basemtime: number;
    constructor(projdir: string, data: any, basemtime: number, settings: ProjectSettings){
        this.projdir = projdir;
        this.data = data;
        this.settings = settings;
        this.renderers = {};
        this.basemtime = basemtime;
    }
    // 拡張子に対応するrendererを読み込む
    public getRenderer(filepath: string): RenderFunction {
        const {
            renderers,
        } = this;
        const ext = path.extname(filepath);
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
            default:
                return null;
        }

    }
    // require modules from local project is possible
    public localRequire(name: string): any{
        try {
            const lc = resolve.sync(name, {
                basedir: this.projdir,
            });
            if (lc){
                const result = require(lc);
                log.verbose('localRequire', 'Required %s from %s', name, lc);
                return result;
            }
        }finally {
            try {
                const result = require(name);
                log.verbose('localRequire', 'Required bundled %s', name);
                return result;
            }catch (e){
                log.warning('localRequire', 'Failed to require %s', name);
                return null;
            }
        }
    }
    // htmlファイル用に拡張子を付け替える
    public getTargetFile(file: string, outDir: string): string{
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        return path.join(outDir, base + this.settings.outExt);
    }
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
            const h = (i: number)=>{
                const f = files[i];
                if (f == null){
                    log.verbose('renderDirectory', 'Finished rendering directory %s', dir);
                    return Promise.resolve();
                }
                // ディレクトリの中のファイル名
                const p = path.join(dir, f);
                return renderFile(context, p, outDir).then(()=> h(i+1));
            };
            resolve(h(0));
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
        return (file: string, outDir: string, options?: any)=> new Promise((resolve, reject)=>{
            // ファイルの更新日時チェック
            fs.stat(file, (err, st)=>{
                if (err != null){
                    reject(err);
                    return;
                }
                const mtime = st.mtime.getTime();
                const saveFile = ctx.getTargetFile(file, outDir);
                // htmlファイルのなまえ
                resolve(ctx.needsRender(saveFile, mtime).then(b=>{
                    if (!b){
                        log.verbose('expressRenderer', 'skipped %s', file);
                        return;
                    }else{
                        return new Promise((resolve, reject)=>{
                            func(file, options, (err, html)=>{
                                if (err != null){
                                    reject(err);
                                    return;
                                }
                                resolve(mkdirpsave(ctx, saveFile, html));
                            });
                        });
                    }
                }));
            });
        });
    }
    // dustjsのrendererを作る
    export function makeDustjsRenderer(ctx: RenderContext): RenderFunction {
        const dust = ctx.localRequire('dustjs-linkedin');
        ctx.localRequire('dustjs-helpers');
        return (file: string, outDir: string, options?: any)=>{
            return new Promise((resolve, reject)=>{
                fs.stat(file, (err, st)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    const mtime = st.mtime.getTime();
                    const saveFile = ctx.getTargetFile(file, outDir);

                    resolve(ctx.needsRender(saveFile, mtime).then(b=>{
                        if (!b){
                            log.verbose('dustjsRenderer', 'skipped %s', file);
                            return;
                        }else{
                            return new Promise((resolve, reject)=>{
                                fs.readFile(file, (err, buf)=>{
                                    if (err != null){
                                        reject(err);
                                        return;
                                    }
                                    // onload hook
                                    dust.onLoad = (templatepath: string, callback: (err: any, content: string)=>void)=>{
                                        fs.readFile(path.resolve(path.dirname(file), templatepath), 'utf8', callback);
                                    };
                                    const t = dust.compile(buf.toString(), path);
                                    dust.loadSource(t);
                                    dust.render(file, options, (err, html)=>{
                                        if (err != null){
                                            reject(err);
                                            return;
                                        }
                                        resolve(mkdirpsave(ctx, saveFile, html));
                                    });
                                });
                            });
                        }
                    }));
                });
            });
        };
    }
    // 静的ファイルのrendererを作る
    export function makeStaticRenderer(ctx: RenderContext): RenderFunction {
        return (file: string, outDir: string)=>{
            return new Promise((resolve, reject)=>{
                const base = path.basename(file);
                const target = path.join(outDir, base);

                fs.stat(file, (err, st)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    const mtime = st.mtime.getTime();

                    resolve(ctx.needsRender(target, mtime).then(b=>{
                        if (!b){
                            log.verbose('staticRenderer', 'skipped %s', file);
                            return;
                        }else{
                             return new Promise((resolve, reject)=>{
                                 fs.readFile(file, (err, buf)=>{
                                     if (err != null){
                                         reject(err);
                                         return;
                                     }
                                     resolve(mkdirpsave(ctx, target, buf.toString()));
                                 });
                             });
                        }
                    }));
                });
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
