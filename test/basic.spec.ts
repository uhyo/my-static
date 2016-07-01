/// <reference path='../typings/bundle.d.ts' />

import {
    findProject,
} from '../lib/main';

import {
    RenderContext,
    renderFileToString,
} from '../lib/render';

import {
    loadData,
} from '../lib/load-data';


const pkgDir = require('pkg-dir');
const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const mountfs = require('mountfs');
mountfs.patchInPlace();

// test files.
const testDir = path.join(pkgDir.sync(__dirname), 'test');

describe('Load Project ', ()=>{
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
            },
        });
        fs.mount(mnt, mock);
    });
    afterEach(()=>{
        fs.unmount(mnt);
    });

    it('project file', done=>{
        const proj1Dir = path.join(mnt, 'proj1');
        findProject({
            cwd: proj1Dir,
            project: 'myst.json',
        }).then(({projdir, settings})=>{
            expect(projdir).toBe(proj1Dir);
            expect(settings).toEqual({
                data: 'data/',
            });
            done();
        }).catch(done.fail);
    });
    it('data directory', done=>{
        const datadir = path.join(mnt, 'proj1', 'data');
        loadData(datadir).then(obj=>{
            expect(obj).toEqual({
                foo: {
                    foobar: '吉野家',
                    foonum: 10,
                },
                bar: {
                    welcome: 'to my bar',
                },
            });
            done();
        }).catch(done.fail);
    });
});

describe('Render File', ()=>{
    // fs mock
    const mnt = path.join(__dirname, 'mockfs');
    beforeEach(()=>{
        const mock = mockFs.fs({
            '/proj1': {
                'index.jade': 'p(data-foo=foo) pow!',
                'foo.ejs': '<p>cow!<%= foo %></p>',
                'bar.dust': '<p>wow! {foo}</p>',
            },
        });
        fs.mount(mnt, mock);
    });
    afterEach(()=>{
        fs.unmount(mnt);
    });
    const ctx: RenderContext = {
        projdir: path.join(mnt, 'proj1'),
        data: {
            foo: 3,
        },
        settings: {
            rootDir: null,
            outDir: null,
            outExt: null,
            data: null,
        },
        renderers: {},
    };
    it('jade', done=>{
        renderFileToString(ctx, path.join(ctx.projdir, 'index.jade')).then(html=>{
            expect(html).toBe(`<p data-foo='3'>pow!</p>`);
            done();
        }).catch(done.fail);
    });
    it('ejs', done=>{
        renderFileToString(ctx, path.join(ctx.projdir, 'foo.ejs')).then(html=>{
            expect(html).toBe('<p>cow!3</p>');
            done();
        }).catch(done.fail);
    });
    it('dustjs', done=>{
        renderFileToString(ctx, path.join(ctx.projdir, 'bar.dust')).then(html=>{
            expect(html).toBe('<p>wow! 3</p>');
            done();
        }).catch(done.fail);
    });
});
