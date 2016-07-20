///<reference path="../typings/bundle.d.ts" />
// watch utility.
import {
    EventEmitter,
} from 'events';
const path = require('path');

const gaze = require('gaze');
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
        const f = (watcher)=>{
            watcher.on('added', f=>{
                e.emit('updated', f);
            });
            watcher.on('deleted', f=>{
                e.emit('removed', f);
            });
            watcher.on('changed', f=>{
                e.emit('updated', f);
            });

            if (++cnt >= allcnt){
                resolve(e);
            }
        };
        const fd = (watcher)=>{
            // データ用
            watcher.on('added', f=>{
                e.emit('data-updated', f);
            });
            watcher.on('deleted', f=>{
                e.emit('data-updated', f);
            });
            watcher.on('changed', f=>{
                e.emit('data-updated', f);
            });

            if (++cnt >= allcnt){
                resolve(e);
            }
        };
        const fdp = (watcher)=>{
            // dependency用
            watcher.on('added', f=>{
                e.emit('dep-updated', f);
            });
            watcher.on('deleted', f=>{
                e.emit('dep-updated', f);
            });
            watcher.on('changed', f=>{
                e.emit('dep-updated', f);
            });

            if (++cnt >= allcnt){
                resolve(e);
            }
        };

        // build対象ファイルをwatch
        const rootDir = path.resolve(projdir, settings.rootDir);
        const targetRel = target ? target.map(pat=> path.relative(rootDir, pat)) : [];
        gaze(targetRel, {
            cwd: rootDir,
        }, (err, watcher)=>{
            if (err){
                allcnt = Infinity;
                reject(err);
                return;
            }
            f(watcher);
        });
        allcnt++;

        // データディレクトリをwatch
        if (data){
            gaze('**/*', {
                cwd: data,
            }, (err, watcher)=>{
                if (err){
                    allcnt = Infinity;
                    reject(err);
                    return;
                }
                fd(watcher);
            });
            allcnt++;
        }

        // dependency
        if (dependency){
            const dependency_a = Array.isArray(dependency) ? dependency : dependency ? [dependency] : [];
            const dependency_aa = dependency_a.map(p=>path.join(p, '**/*'));
            gaze(dependency_aa, {
                cwd: projdir,
            }, (err, watcher)=>{
                if (err){
                    allcnt = Infinity;
                    reject(err);
                    return;
                }
                fdp(watcher);
            });
            allcnt++;
        }
    });
}
