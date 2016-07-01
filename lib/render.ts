/// <reference path='../typings/bundle.d.ts' />
// render directory.
//
import {
    ProjectSettings,
} from './conf';

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
    constructor(projdir: string, data: any, settings: ProjectSettings){
        this.projdir = projdir;
        this.data = data;
        this.settings = settings;
        this.renderers = {};
    }
    // 拡張子に対応するrendererを読み込む
    public getRenderer(ext: string): RenderFunction {
        const {
            renderers,
        } = this;
        // from renderer cache
        const f = renderers[ext];
        if (f !=null){
            return f;
        }
        // built-in renderers
        switch (ext){
            case '.jade':
                return (renderers[ext] = renderUtil.makeExpressRenderer(this, this.localRequire('jade').__express));
            case '.ejs':
                return (renderers[ext] = renderUtil.makeExpressRenderer(this, this.localRequire('ejs').__express));
            case '.dust':
                return (renderers[ext] = renderUtil.makeDustjsRenderer(this));
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
                return require(lc);
            }
        }finally {
            try {
                return require(name);
            }catch (e){
                return null;
            }
        }
    }
    // ファイルにかきこみ
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
    // このファイルを更新すべきか
    public isRerenderRequired(file: string): Promise<boolean>{
        return new Promise((resolve, reject)=>{
            fs.stat(file, (err, st)=>{
                if (err != null){
                    if (err.code === 'ENOENT'){
                        // ファイルがないので書くべき
                        resolve(true);
                    }else{
                        reject(err);
                    }
                    return;
                }
                // ファイルの更新日時をチェック
                const m = st.mtime.getTime();
            });
        });
    }
}

export function renderDirectory(context: RenderContext, dir: string, outDir: string): Promise<any>{
    return new Promise((resolve, reject)=>{
        fs.readdir(dir, (err, files)=>{
            if (err != null){
                reject(err);
                return;
            }
            const h = (i: number)=>{
                const f = files[i];
                if (f == null){
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
                /* TODO: ext? */
                const ext = path.extname(f);
                const r = context.getRenderer(ext);
                if (r == null){
                    // 対応するRendererがない
                    resolve();
                    return;
                }
                resolve(r(f, outDir, context.data));
            }
        });
    });
}

// renderers
namespace renderUtil{
    // expressのあれに対応したrendererを作る
    export function makeExpressRenderer(ctx: RenderContext, func: ExpressFriendlyRenderFunction): RenderFunction{
        return (path: string, outDir: string, options?: any)=> new Promise((resolve, reject)=>{
            func(path, options, (err, html)=>{
                if (err != null){
                    reject(err);
                    return;
                }
                resolve(HTMLSaveAction(ctx, path, outDir, html));
            });
        });
    }
    // dustjsのrendererを作る
    export function makeDustjsRenderer(ctx: RenderContext): RenderFunction {
        const dust = ctx.localRequire('dustjs-linkedin');
        ctx.localRequire('dustjs-helpers');
        return (path: string, outDir: string, options?: any)=>{
            return new Promise((resolve, reject)=>{
                fs.readFile(path, (err, buf)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    const t = dust.compile(buf.toString(), path);
                    dust.loadSource(t);
                    dust.render(path, options, (err, html)=>{
                        if (err != null){
                            reject(err);
                            return;
                        }
                        resolve(HTMLSaveAction(ctx, path, outDir, html));
                    });
                });
            });
        };
    }

    // ただファイルに保存
    // path: もとのファイル名
    function HTMLSaveAction(ctx: RenderContext, file: string, outDir: string, html: string): Promise<any>{
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        // 拡張子を変える
        const saveFile = path.join(outDir, base + ctx.settings.outExt);
        return new Promise((resolve, reject)=>{
            mkdirp(outDir, err=>{
                if (err != null){
                    reject(err);
                }else{
                    resolve(ctx.saveFile(saveFile, html));
                }
            });
        });
    }
}
