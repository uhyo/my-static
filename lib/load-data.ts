/// <reference path='../typings/bundle.d.ts' />
// load data.

import {
    ProjectSettings,
} from './conf';
const path = require('path');
const mld = require('my-load-data');

export function loadData(datadir: string): Promise<any>{
    return mld.fromDirectory(datadir);
}
