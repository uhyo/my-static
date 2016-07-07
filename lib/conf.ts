/// <reference path='../typings/bundle.d.ts' />
// default config

const DEFAULT_PROJECT_FILE = 'myst.json';
const DEFAULT_OUT_EXT = '.html';

export interface BuildOptions{
    // cwd
    cwd?: string;
    // filename of myst.json
    project?: string;
    // root directory of page files
    rootDir?: string;
    // output directory
    outDir?: string;
    // extension of html files
    outExt?: string;
}

// myst.jsonの中身
export interface ProjectSettings{
    rootDir: string;
    outDir: string;
    outExt: string;
    // dataディレクトリがある場所
    data: string;
    // cacheファイルの場所
    cache: string;
}

// BuildOptionsにデフォルト設定を書き込む
export function defaultBuildOptions(options: BuildOptions): void{
    if (!options.cwd){
        options.cwd = process.cwd();
    }
    if (!options.project){
        options.project = DEFAULT_PROJECT_FILE;
    }
}
// BuildOptionsはProjectSettingsを上書きするかも
export function overwriteSettings(options: BuildOptions, settings: ProjectSettings): ProjectSettings{
    if (options.rootDir){
        settings.rootDir = options.rootDir;
    }
    if (options.outDir){
        settings.outDir = options.outDir;
    }
    if (options.outExt){
        settings.outExt = options.outExt;
    }else if (!settings.outExt){
        settings.outExt = DEFAULT_OUT_EXT;
    }
    return settings;
}
