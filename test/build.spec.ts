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

describe('Build Project', ()=>{
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
                'myst-cache.json': `{
    "data": "data/",
    "outDir": "../out",
    "cache": ".myst.cache.json"
}`,
                '.myst.cache.json': JSON.stringify({
                    foo: {
                        foobar: '私の家',
                        $mtime: tim+7200000,
                    },
                    bar: {
                        welcome: 'to my house',
                        $mtime: tim,
                    },
                    $mtime: tim+7200000,
                }),
                'myst-cache2.json': `{
    "data": "data/",
    "outDir": "../out",
    "cache": ".myst.cache2.json"
}`,
                '.myst.cache2.json': JSON.stringify({
                    foo: {
                        foobar: '日本',
                        $mtime: tim-3600000,
                    },
                    bar: {
                        welcome: 'to Japan',
                        $mtime: tim-3600000,
                    },
                    $mtime: tim-3600000,
                }),
                'data': {
                    'foo.yaml': mockFs.file({
                        content: `
foobar: 吉野家
foonum: 10`,
                        mtime,
                    }),
                    'bar.json': mockFs.file({
                        content: '{"welcome": "to my bar"}',
                        mtime,
                    }),
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
                'myst2.json': `{
    "data": "data/",
    "outDir": "../out-proj3"
}`,
                'data': {
                    'foo.json': mockFs.file({
                        content: '{"foo":"bar"}',
                        mtime: new Date(tim + 7200000),
                    }),
                },
                'index.jade': mockFs.file({
                    content: 'p pow!',
                    mtime,
                }),
                'foo.dust': mockFs.file({
                    content: '<p>ぬ\u3099</p>',
                    mtime,
                }),
                'a.js': mockFs.file({
                    content: 'while(1){}',
                    mtime,
                }),
            },
            '/proj4': {
                'myst.json': `{
    "data": "./data/",
    "outDir": "../out-proj4",
    "rootDir": "./contents",
    "dependency": "./layout"
}`,
                'myst2.json': `{
    "data": "./data/",
    "outDir": "../out-proj4",
    "rootDir": "./contents",
    "dependency": ["./layout", "dummy"]
}`,
                'data': {
                    'foo.json': mockFs.file({
                        content: '{"foo":"bar"}',
                        mtime: new Date(tim - 7200000),
                    }),
                },
                'layout': {
                    'main.jade': mockFs.file({
                        content: `div
  block content
`,
                        mtime: new Date(tim + 100000),
                    }),
                },
                'dummy': {
                    'very_new_file.txt': mockFs.file({
                        content: 'pow!',
                        mtime: new Date(tim + 10000000),
                    }),
                },
                'contents': {
                    'index.jade': mockFs.file({
                        content: `extends ../layout/main.jade
block content
  p this is from fs!`,
                        mtime: new Date(tim - 3600000),
                    }),
                    'foo.jade': mockFs.file({
                        content: `p this file is old!`,
                        mtime:new Date(tim - 7200000),
                    }),
                },
            },
            '/out': {
            },
            '/out-proj3': {
                'foo.html': mockFs.file({
                    content: 'I AM FOO',
                    mtime: new Date(tim + 3600000),
                }),
                'a.js': mockFs.file({
                    content: 'alert(0)',
                    mtime: new Date(tim - 3600000),
                }),
            },
            '/out-proj4': {
                'index.html': mockFs.file({
                    content: '<p>this file is unchanged</p>',
                    mtime,
                }),
                'foo.html': mockFs.file({
                    content: '<p>this file is brand new</p>',
                    mtime: new Date(tim + 200000),
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
    describe('mtime', ()=>{
        it('check mtime to save', done=>{
            const projDir = path.join(mnt, 'proj3');
            const outDir = path.join(mnt, 'out-proj3');
            build({
                cwd: projDir,
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html', 'a.js'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('I AM FOO');
                expect(fs.readFileSync(path.join(outDir, 'a.js'), 'utf8')).toBe('while(1){}');
                done();
            }).catch(done.fail);
        });
        it('check mtime of data', done=>{
            const projDir = path.join(mnt, 'proj3');
            const outDir = path.join(mnt, 'out-proj3');
            build({
                cwd: projDir,
                project: 'myst2.json',
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html', 'a.js'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>ぬ\u3099</p>');
                expect(fs.readFileSync(path.join(outDir, 'a.js'), 'utf8')).toBe('while(1){}');
                done();
            }).catch(done.fail);
        });
    });
    describe('caches', ()=>{
        it('use cache', done=>{
            const projDir = path.join(mnt, 'proj1');
            const outDir = path.join(mnt, 'out');
            build({
                cwd: projDir,
                project: 'myst-cache.json',
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
                // cache is used
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>私の家にようこそ！</p>');
                done();
            }).catch(done.fail);
        });
        it('write cache', done=>{
            const projDir = path.join(mnt, 'proj1');
            const outDir = path.join(mnt, 'out');
            build({
                cwd: projDir,
                project: 'myst-cache2.json',
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe('<p>pow!</p>');
                // cache is not used
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe('<p>吉野家にようこそ！</p>');
                // write back cache
                expect(JSON.parse(fs.readFileSync(path.join(projDir, '.myst.cache2.json'), 'utf8'))).toEqual({
                    foo: {
                        foobar: '吉野家',
                        foonum: 10,
                        $mtime: tim,
                    },
                    bar: {
                        welcome: 'to my bar',
                        $mtime: tim,
                    },
                    $mtime: tim,
                });
                done();
            }).catch(done.fail);
        });
    });
    describe('dependency', ()=>{
        it('see dependency', done=>{
            const projDir = path.join(mnt, 'proj4');
            const outDir = path.join(mnt, 'out-proj4');
            build({
                cwd: projDir,
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe(`<div><p>this is from fs!</p></div>`);
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe(`<p>this file is brand new</p>`);
                done();
            }).catch(done.fail);
        });
        it('see dependencies', done=>{
            const projDir = path.join(mnt, 'proj4');
            const outDir = path.join(mnt, 'out-proj4');
            build({
                cwd: projDir,
                project: 'myst2.json',
            }).then(()=>{
                expect(fs.readdirSync(outDir).sort()).toEqual(['index.html', 'foo.html'].sort());
                expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')).toBe(`<div><p>this is from fs!</p></div>`);
                expect(fs.readFileSync(path.join(outDir, 'foo.html'), 'utf8')).toBe(`<p>this file is old!</p>`);
                done();
            }).catch(done.fail);
        });
    });
});

