# my-static
My static website generator for me.

## Installation
```sh
$ npm install -g my-static
```

## Usage
Prepare your project including template files, data files, and `myst.json`.

Sample project: (TODO)

Then run at the project directory:
```sh
$ myst
```

### myst.json
Minimal `myst.json` has following fields. For paths, relative and absolute paths are accepted. Relative paths are treated as being relative to `myst.json`.
```js
{
    "outDir": "./out",      // output directory (required)
    "rootDir": "./src",     // directory that contains template files.
    "data": "./data",       // directory that contains data files.
    "dependency": ["./templates"]      // dependencies other than src and data.
}
```

For more information, see (TODO).


## License
MIT