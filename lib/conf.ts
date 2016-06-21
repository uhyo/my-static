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
