/// <reference path='../typings/bundle.d.ts' />

import {
    build,
} from '../lib/main';

const pkgDir = require('pkg-dir');
const fs = require('fs');
const path = require('path');

// test files.
const testDir = path.join(pkgDir.sync(__dirname), 'test');
const tmpDir = path.join(testDir, 'tmp');

describe('Build Project ', ()=>{
    it('basic project', done=>{
        build({
            cwd: path.join(testDir, 'proj1'),
            outDir: path.join(tmpDir, 'proj1'),
        }).then(()=>{
            // check file
            expect(fs.readFileSync(path.join(tmpDir, 'proj1', 'index.html'), 'utf8')).toBe('<p>pow!</p>');
            done();
        }).catch(done.fail);
    });
});

