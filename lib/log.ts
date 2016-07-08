///<reference path="../typings/bundle.d.ts" />

// Just logging features.
const colors = require('colors');

export const enum LogLevel{
    none,
    error,
    warning,
    info,
    verbose,
}
let logLevel: LogLevel = LogLevel.info;

export function setLogLevel(lv: LogLevel): void{
    logLevel = lv;
}

export function verbose(category: string, str: string, ...args: Array<any>): void{
    verboset(colors.gray(category+' ') + str, ...args);
}

export function verboset(str: string, ...args: Array<any>): void {
    if (logLevel >= LogLevel.verbose){
        console.log(colors.magenta('VERBOSE ') + str, ...args);
    }
}
export function info(str: string, ...args: Array<any>): void {
    if (logLevel >= LogLevel.info){
        console.log(colors.green('INFO ') + str, ...args);
    }
}
export function warning(str: string, ...args: Array<any>): void {
    if (logLevel >= LogLevel.warning){
        console.log(colors.yellow('WARNING ') + str, ...args);
    }
}
export function error(str: string, ...args: Array<any>): void {
    if (logLevel >= LogLevel.error){
        console.error(colors.bgRed('ERROR') + ' ' + str, ...args);
    }
}
