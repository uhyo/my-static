import {
    findProject,
} from '../lib/main';

import {
    RenderContext,
    renderFile,
    renderUtil,
} from '../lib/render';

import {
    loadData,
} from '../lib/load-data';

import * as log from '../lib/log';

log.setLogLevel(log.LogLevel.none);


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
                // TODO: TypeScript version is very old. Needs thorough rewrite.
            } as any);
            done();
        }).catch(done.fail);
    });
    it('data directory', done=>{
        const datadir = path.join(mnt, 'proj1', 'data');
        const foomtime = fs.statSync(path.join(datadir, 'foo.yaml')).mtime.getTime();
        const barmtime = fs.statSync(path.join(datadir, 'bar.json')).mtime.getTime();
        loadData(datadir).then(obj=>{
            expect(obj).toEqual({
                foo: {
                    foobar: '吉野家',
                    foonum: 10,
                    $mtime: foomtime,
                },
                bar: {
                    welcome: 'to my bar',
                    $mtime: barmtime,
                },
                $mtime: Math.max(foomtime, barmtime),
            });
            done();
        }).catch(done.fail);
    });
});

describe('Render File', ()=>{
    // fs mock
    const mnt = path.join(__dirname, 'mockfs');

    // prepare context
    const projdir = path.join(mnt, 'proj1');
    // outDir (fake)
    const outDir = path.join(mnt, 'out');
    const data = {
        foo: 3,
    };
    const settings = {
        force: false,
        rootDir: projdir,
        outDir,
        outExt: '.html',
    };
    let ctx;
    const mtime = new Date();
    const tim = mtime.getTime();

    beforeEach(()=>{
        ctx = new RenderContext(projdir, settings);
        ctx.data = data;
        const mock = mockFs.fs({
            '/proj1': {
                'index.jade': mockFs.file({
                    content: 'p(data-foo=foo) pow!',
                    mtime,
                }),
                'foo.ejs': mockFs.file({
                    content: '<p>cow!<%= foo %></p>',
                    mtime,
                }),
                'bar.dust': mockFs.file({
                    content: '<p>wow! {foo}</p>',
                    mtime,
                }),
                '吉野家.html': mockFs.file({
                    content: '<table><tr><td>row!</td></tr></table>',
                    mtime,
                }),
                'a.js': mockFs.file({
                    content: 'alert(1);',
                    mtime,
                }),
                'a.css': mockFs.file({
                    content: 'body {color: red;}',
                    mtime,
                }),
                'something.orz': mockFs.file({
                    content: 'This is ORZ file!',
                    mtime,
                }),
            },
        });
        fs.mount(mnt, mock);

        // spy on ctx.saveFile
        spyOn(ctx, 'saveFile').and.callFake(()=>Promise.resolve());
    });
    afterEach(()=>{
        fs.unmount(mnt);
    });
    it('jade', done=>{
        renderFile(ctx, path.join(ctx.projdir, 'index.jade'), outDir).then(()=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'index.html'), '<p data-foo=\'3\'>pow!</p>');
            done();
        }).catch(done.fail);
    });
    it('ejs', done=>{
        renderFile(ctx, path.join(ctx.projdir, 'foo.ejs'), outDir).then(html=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'foo.html'), '<p>cow!3</p>');
            done();
        }).catch(done.fail);
    });
    it('dustjs', done=>{
        renderFile(ctx, path.join(ctx.projdir, 'bar.dust'), outDir).then(html=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'bar.html'), '<p>wow! 3</p>');
            done();
        }).catch(done.fail);
    });
    it('html', done=>{
        renderFile(ctx, path.join(ctx.projdir, '吉野家.html'), outDir).then(html=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, '吉野家.html'), new Buffer('<table><tr><td>row!</td></tr></table>'));
            done();
        }).catch(done.fail);
    });
    it('js', done=>{
        renderFile(ctx, path.join(ctx.projdir, 'a.js'), outDir).then(html=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'a.js'), new Buffer('alert(1);'));
            done();
        }).catch(done.fail);
    });
    it('css', done=>{
        renderFile(ctx, path.join(ctx.projdir, 'a.css'), outDir).then(html=>{
            expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'a.css'), new Buffer('body {color: red;}'));
            done();
        }).catch(done.fail);
    });
    describe('hooks', ()=>{
        it('post-render hook', done=>{
            ctx.addPostRenderHook((context, content, target, original)=>{
                return target + content;
            });
            ctx.addPostRenderHook((context, content, target, original)=>{
                return content + original;
            });
            renderFile(ctx, path.join(ctx.projdir, 'index.jade'), outDir).then(()=>{
                expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'index.html'), path.join(outDir, 'index.html') + '<p data-foo=\'3\'>pow!</p>' + path.join(ctx.projdir, 'index.jade'));
                done();
            }).catch(done.fail);
        });
        it('pre-render hook', done=>{
            ctx.addPreRenderHook((content, filename, data)=>{
                return {
                    data: Object.assign({}, data, {
                        foo: '吉野家',
                    }),
                };
            });
            renderFile(ctx, path.join(ctx.projdir, 'foo.ejs'), outDir).then(()=>{
                expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'foo.html'), '<p>cow!吉野家</p>');
                done();
            }).catch(done.fail);
        });
        it('unknown extension hook', done=>{
            let flag: string | null = null;
            ctx.addUnknownExtensionHook((context, ext)=>{
                flag = ext;
                return renderUtil.makeStaticRenderer(context);
            });
            renderFile(ctx, path.join(ctx.projdir, 'something.orz'), outDir).then(()=>{
                expect(flag).toBe('.orz');
                expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'something.orz'), new Buffer('This is ORZ file!'));
                done();
            }).catch(done.fail);
        });
        it('load data hook', done=>{
            let flags: Array<string> = [];
            ctx.addLoadFileHook((context, file)=>{
                flags.push(file);
                return '<p>cow! {foo}</p>';
            });
            renderFile(ctx, path.join(ctx.projdir, 'bar.dust'), outDir).then(()=>{
                expect(flags).toEqual([
                    path.join(ctx.projdir, 'bar.dust'),
                ]);
                expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'bar.html'), '<p>cow! 3</p>');
                done();
            }).catch(done.fail);
        });
        it('post load data hook', done=>{
            let flags: Array<string> = [];
            ctx.addPostLoadFileHook((context, file, data)=>{
                flags.push(file);
                return null;
            });
            ctx.addPostLoadFileHook((context, file, data)=>{
                flags.push(data as string);
                return '^o^';
            });
            renderFile(ctx, path.join(ctx.projdir, 'bar.dust'), outDir).then(()=>{
                expect(flags).toEqual([
                    path.join(ctx.projdir, 'bar.dust'),
                    '<p>wow! {foo}</p>',
                ]);
                expect(ctx.saveFile).toHaveBeenCalledWith(path.join(outDir, 'bar.html'), '^o^');
                done();
            }).catch(done.fail);
        });
    });
});
