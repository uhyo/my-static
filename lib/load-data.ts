/// <reference path='../typings/bundle.d.ts' />
// load data.

import {
    ProjectSettings,
} from './conf';
import * as log from './log';

const path = require('path');
const fs = require('fs');
const mld = require('my-load-data');

// load data and treat cache.
export function loadData(datadir: string, cachefile?: string): Promise<any>{
    log.verbose('loadData', 'loading data from %s', datadir);
    if (cachefile){
        log.verbose('loadData', 'loading cache from %s', cachefile);
    }

    const cachep = cachefile ? mld.fromFile(cachefile).catch(e=>{
        if (e.code === 'ENOENT'){
            // no cache yet
            log.verbose('loadData', 'could not load cache');
            return null;
        }else{
            log.error('Error while loading %s : [ %s ]', cachefile, e);
            throw e;
        }
    }): Promise.resolve(null);

    return cachep.then(cache=> mld.fromDirectory(datadir, {
        mtime: true,
        cache,
    }).then(obj=>{
        if (cachefile && (!cache || cache['$mtime'] < obj['$mtime'])){
            return new Promise((resolve, reject)=>{
                // save cache.
                // TODO: what if cache file is not json?
                fs.writeFile(cachefile, JSON.stringify(obj), err=>{
                    if (err != null){
                        reject(err);
                    }else{
                        log.verbose('loadData', 'wrote cache to %s', cachefile);
                        resolve(obj);
                    }
                });
            });
        }else{
            return obj;
        }
    })).catch(e=>{
        log.error('Error while loading data: [ %s ]', e);
        throw e;
    });
}

// mtime of file / directory.
export function getMTime(files: Array<string>): Promise<number>{
    return Promise.all(files.map(file=>new Promise((resolve, reject)=>{
        fs.stat(file, (err, st)=>{
            if (err != null){
                reject(err);
                return;
            }
            if (st.isDirectory()){
                fs.readdir(file, (err, files)=>{
                    if (err != null){
                        reject(err);
                        return;
                    }
                    resolve(getMTime(files.map(f=>path.join(file, f))));
                });
            }else{
                resolve(st.mtime.getTime());
            }
        });
    }))).then((mtimes: Array<number>)=>Math.max(...mtimes));

}
