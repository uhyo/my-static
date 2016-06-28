/// <reference path='../typings/bundle.d.ts' />

import {
    findProject,
} from '../lib/main';

import {
    RenderContext,
    renderFileToString,
} from '../lib/render';

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
            },
        });
        fs.mount(mnt, mock);
    });
    afterEach(()=>{
        fs.unmount(mnt);
    });

    it('basic', done=>{
        const proj1Dir = path.join(mnt, 'proj1');
        findProject({
            cwd: proj1Dir,
            project: 'myst.json',
        }).then(({projdir, projobj})=>{
            expect(projdir).toBe(proj1Dir);
            expect(projobj).toEqual({
                data: 'data/',
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
        options: {},
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
