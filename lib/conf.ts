/// <reference path='../typings/bundle.d.ts' />
// default config

export const PROJECT_FILE = 'myst.json';
export const OUT_EXT = '.html';

export interface BuildOptions{
    // cwd
    cwd?: string;
    // filename of myst.json
    project?: string;
    // output directory
    outDir?: string;
    // extension of html files
    outExt?: string;
}

export const defaultOptions: BuildOptions = {
    project: PROJECT_FILE,
    outExt: OUT_EXT,
};

// myst.jsonの中身
export interface ProjectSettings{
    // dataディレクトリがある場所
    data: string;
}
