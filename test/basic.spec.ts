/// <reference path='../typings/bundle.d.ts' />

import {
    findProject,
} from '../lib/main';

const pkgDir = require('pkg-dir');
const path = require('path');

// test files.
const testDir = path.join(pkgDir.sync(__dirname), 'test');

describe('Load Project ', ()=>{
    it('default filename', done=>{
        findProject({
            cwd: path.join(testDir, 'proj1'),
        }).then(({projdir, projobj})=>{
            expect(projdir).toBe(path.join(testDir, 'proj1'));
            expect(projobj).toEqual({
                data: 'data/',
            });
            done();
        }).catch(done.fail);
    });
    it('custom filename', done=>{
        findProject({
            cwd: path.join(testDir, 'proj1'),
            project: 'custom-myst.json',
        }).then(({projdir, projobj})=>{
            expect(projdir).toBe(path.join(testDir, 'proj1'));
            expect(projobj).toEqual({
                data: 'data2',
            });
            done();
        }).catch(done.fail);
    });
});
