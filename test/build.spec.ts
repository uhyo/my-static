/// <reference path='../typings/bundle.d.ts' />

import {
    build,
} from '../lib/main';

const fs = require('fs');
const path = require('path');

// test files.
const mockFs = require('mock-fs');
const mountfs = require('mountfs');

mountfs.patchInPlace();

describe('Build Project ', ()=>{
    // fs mock
    const mnt = path.join(__dirname, 'mockfs');
    beforeEach(()=>{
        const mock = mockFs.fs({
            '/proj1': {
                'myst.json': `{
    "data": "data/"
}`,
                'data': {
                    'foo.yaml': `
foobar: 吉野家
foonum: 10`,
                    'bar.json': '{"welcome": "to my bar"}',
                },
                'index.jade': 'p pow!',
                'foo.ejs': '<p><%= foo.foobar %>にようこそ！</p>',
            },
            '/out': {},
        });
        fs.mount(mnt, mock);
    });
    afterEach(()=>{
        fs.unmount(mnt);
    });
    it('basic project', done=>{
        const projDir = path.join(mnt, 'proj1');
        const outDir = path.join(mnt, 'out');
        build({
            cwd: projDir,
            outDir,
        }).then(()=>{
            // check file
            expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
            expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>吉野家にようこそ！</p>');
            // extraneous file?
            expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
            done();
        }).catch(done.fail);
    });
});

