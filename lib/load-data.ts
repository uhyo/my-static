/// <reference path='../typings/bundle.d.ts' />
// load data.

import {
    ProjectSettings,
} from './conf';
const path = require('path');
const fs = require('fs');
const mld = require('my-load-data');

// load data and treat cache.
export function loadData(datadir: string, cachefile?: string): Promise<any>{
    const cachep = cachefile ? mld.fromFile(cachefile) : Promise.resolve(null);
    return cachep.then(cache=> mld.fromDirectory(datadir, {
        mtime: true,
        cache,
    })).then(obj=>{
        if (cachefile){
            return new Promise((resolve, reject)=>{
                // save cache.
                // TODO: what if cache file is not json?
                fs.writeFile(cachefile, JSON.stringify(obj), err=>{
                    if (err != null){
                        reject(err);
                    }else{
                        resolve(obj);
                    }
                });
            });
        }else{
            return obj;
        }
    });
}
