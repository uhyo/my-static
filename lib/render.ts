/// <reference path='../typings/bundle.d.ts' />
// render directory.
//
import {
    BuildOptions,
} from './conf';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const resolve = require('resolve');

export interface ExpressFriendlyRenderFunction{
    (path: string, options: any, callback: any): void;
}
export interface RenderContext{
    projdir: string;
    data: any;
    options: BuildOptions;
    renderers: {
        [ext: string]: ExpressFriendlyRenderFunction;
    };
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
                    // ファイルに保存
                    mkdirp(outDir, err=>{
                        if (err != null){
                            reject(err);
                        }else{
                            const {
                                options: {
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
export function renderFileToString(context: RenderContext, file: string): Promise<string>{
    return new Promise((resolve, reject)=>{
        const ext = path.extname(file);
        const func = getRenderer(context, ext);
        if (func == null){
            // funcがないなら何もしない
            resolve(null);
            return;
        }
        func(file, context.data, (err, html)=>{
            if (err != null){
                reject(err);
            }else{
                resolve(html);
            }
        });
    });
}


// renderer
function getRenderer({options, renderers, projdir}: RenderContext, ext: string): ExpressFriendlyRenderFunction{
    // get cache
    const f = renderers[ext];
    if (f != null){
        return f;
    }
    // built-in renderers
    switch (ext){
        case '.jade':
            return (renderers[ext] = localRequire('jade', projdir).__express);
        default:
            return null;
    }
}

// require modules from local is possible
function localRequire(name: string, projdir: string): any{
    try {
        const lc = resolve.sync(name, {
            basedir: projdir,
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
