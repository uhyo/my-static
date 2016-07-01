/// <reference path='../typings/bundle.d.ts' />
// default config

const DEFAULT_PROJECT_FILE = 'myst.json';
const DEFAULT_OUT_EXT = '.html';

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

// myst.jsonの中身
export interface ProjectSettings{
    outDir: string;
    outExt: string;
    // dataディレクトリがある場所
    data: string;
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
