///<reference path="../typings/bundle.d.ts" />
// watch utility.
import {
    EventEmitter,
} from 'events';
const path = require('path');

const watch = require('watch');
const minimatch = require('minimatch');

import {
    RenderContext,
} from './render';

export function watchProject(ctx: RenderContext): Promise<EventEmitter>{
    const {
        projdir,
        settings,
    } = ctx;
    const {
        target,
        data,
        dependency,
    } = settings;
    return new Promise((resolve, reject)=>{
        const e = new EventEmitter();
        // いくつかの場所をwatch
        let cnt = 0;
        let allcnt = 0;
        const f = (monitor)=>{
            monitor.on('created', (f, stat)=>{
                e.emit('updated', f, stat);
            });
            monitor.on('removed', (f, stat)=>{
                e.emit('removed', f, stat);
            });
            monitor.on('changed', (f, curr, prev)=>{
                e.emit('updated', f, curr, prev);
            });

            if (++cnt >= allcnt){
                resolve(e);
            }
        };
        const fd = (monitor)=>{
            // データ用
            monitor.on('created', (f, stat)=>{
                e.emit('data-updated', f);
            });
            monitor.on('removed', (f, stat)=>{
                e.emit('data-updated', f);
            });
            monitor.on('changed', (f, curr, prev)=>{
                e.emit('data-updated', f);
            });

            if (++cnt >= allcnt){
                resolve(e);
            }
        };

        // build対象ファイルをwatch
        const rootDir = path.resolve(projdir, settings.rootDir);
        watch.createMonitor(rootDir, {
            ignoreDotFiles: true,
            filter: (file: string)=>{
                return target.some(p=> minimatch(file, p));
            },
        }, f);
        allcnt++;

        // データディレクトリをwatch
        if (data){
            watch.createMonitor(data, {
                ignoreDotFiles: true,
            }, fd);
            allcnt++;
        }

        // dependency
        if (dependency){
            const dependency_a = Array.isArray(dependency) ? dependency : dependency ? [dependency] : [];
            const dependency_aa = dependency_a.map(p=>path.resolve(projdir, p));
            for (let d of dependency_aa){
                watch.createMonitor(d, {
                    ignoreDotFiles: true,
                }, fd);
                allcnt++;
            }
        }
    });
}
