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
        [ext: string]: ExpressFriendlyRenderFunction;
    };
    constructor(projdir: string, data: any, settings: ProjectSettings){
        this.projdir = projdir;
        this.data = data;
        this.settings = settings;
        this.renderers = {};
    }
    public getRenderer(ext: string): ExpressFriendlyRenderFunction {
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
                return (renderers[ext] = this.localRequire('jade').__express);
            case '.ejs':
                return (renderers[ext] = this.localRequire('ejs').__express);
            case '.dust':
                return (renderers[ext] = makeDustjsRenderer(this));
            default:
                return null;
        }

        // dustjsのrendererを作る
        function makeDustjsRenderer(ctx: RenderContext): ExpressFriendlyRenderFunction {
            const dust = ctx.localRequire('dustjs-linkedin');
            ctx.localRequire('dustjs-helpers');
            return (path: string, options: any, callback: any)=>{
                fs.readFile(path, (err, buf)=>{
                    if (err != null){
                        callback(err, null);
                        return;
                    }
                    const t = dust.compile(buf.toString(), path);
                    dust.loadSource(t);
                    dust.render(path, options, callback);
                });
            };
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
                resolve(renderFileToString(context, f).then(html=>new Promise((resolve, reject)=>{
                    if (html == null){
                        // これはrenderしないファイルだ
                        resolve();
                        return;
                    }
                    // ファイルに保存
                    mkdirp(outDir, err=>{
                        if (err != null){
                            reject(err);
                        }else{
                            const {
                                settings: {
                                    outExt,
                                },
                            } = context;
                            const ext = path.extname(f);
                            const targetFile = path.join(outDir, path.basename(f, ext) + outExt);
                            fs.writeFile(targetFile, html, err=>{
                                if (err != null){
                                    reject(err);
                                }else{
                                    resolve();
                                }
                            });
                        }
                    });
                })).catch(reject));
            }
        });
    });
}

// fileをstringにrender
// renderできないファイルはnullを返す
export function renderFileToString(ctx: RenderContext, file: string): Promise<string>{
    return new Promise((resolve, reject)=>{
        const ext = path.extname(file);
        const func = ctx.getRenderer(ext);
        if (func == null){
            // funcがないなら何もしない
            resolve(null);
            return;
        }
        func(file, ctx.data, (err, html)=>{
            if (err != null){
                reject(err);
            }else{
                resolve(html);
            }
        });
    });
}
