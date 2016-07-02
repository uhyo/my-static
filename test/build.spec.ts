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
    const mtime = new Date();
    const tim = mtime.getTime();
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
            '/proj2': {
                'myst.json': `{
    "data": "${path.resolve(mnt, 'proj2', 'data')}",
    "rootDir": "contents/",
    "outDir": "../out"
}`,
                'data': {
                    'foo.yaml': `
foobar: すき家
foonum: 10`,
                    'bar.json': '{"welcome": "to my bar"}',
                },
                'contents': {
                    'index.jade': 'p welcome #{bar.welcome}',
                    'foo.ejs': '<p><%= foo.foobar %>に行きたい</p>',
                },
            },
            '/proj3': {
                'myst.json': `{
    "outDir": "../out-proj3"
}`,
                'index.jade': mockFs.file({
                    content: 'p pow!',
                    mtime,
                }),
                'foo.dust': mockFs.file({
                    content: '<p>ぬ\u3099',
                    mtime,
                }),
            },
            '/out': {
            },
            '/out-proj3': {
                'foo.html': mockFs.file({
                    content: 'I AM FOO',
                    mtime: new Date(tim + 3600000),
                }),
            },
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
    it('specify rootDir, outDir', done=>{
        const projDir = path.join(mnt, 'proj2');
        const outDir = path.join(mnt, 'out');
        build({
            cwd: projDir,
        }).then(()=>{
            // extraneous file?
            expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
            // check file
            expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>welcome to my bar</p>');
            expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>すき家に行きたい</p>');
            done();
        }).catch(done.fail);
    });
    it('from other cwd', done=>{
        const projDir = path.join(mnt, 'proj2');
        const outDir = path.join(mnt, 'out');
        build({
            cwd: path.join(projDir, 'contents'),
        }).then(()=>{
            // extraneous file?
            expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
            // check file
            expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>welcome to my bar</p>');
            expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>すき家に行きたい</p>');
            done();
        }).catch(done.fail);
    });
    it('override rootDir from option', done=>{
        const projDir = path.join(mnt, 'proj2');
        const outDir = path.join(mnt, 'out');
        build({
            cwd: path.join(projDir, 'contents'),
            rootDir: path.join(mnt, 'proj1'),
        }).then(()=>{
            // extraneous file?
            expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
            // check file
            expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
            expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>すき家にようこそ！</p>');
            done();
        }).catch(done.fail);
    });
    it('check mtime to save', done=>{
        const projDir = path.join(mnt, 'proj3');
        const outDir = path.join(mnt, 'out-proj3');
        build({
            cwd: projDir,
        }).then(()=>{
            expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
            expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
            expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('I AM FOO');
            done();
        }).catch(done.fail);
    });
});

