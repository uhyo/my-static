/// <reference path='../typings/bundle.d.ts' />

import {
    findProject,
} from '../lib/main';

const pkgDir = require('pkg-dir');
const path = require('path');

// test files.
const testDir = path.join(pkgDir.sync(__dirname), 'test');

describe('Load Project ', ()=>{
    it('basic', done=>{
        findProject({
            cwd: path.join(testDir, 'proj1'),
            project: 'myst.json',
        }).then(({projdir, projobj})=>{
            expect(projdir).toBe(path.join(testDir, 'proj1'));
            expect(projobj).toEqual({
                data: 'data/',
            });
            done();
        }).catch(done.fail);
    });
});
