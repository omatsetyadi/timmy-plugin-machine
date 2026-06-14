# timmy-plugin-machine

A [Timmy](https://github.com/omatsetyadi/timmy) plugin exposing cross-platform OS
operations as tools. It's a thin adapter over
[`@agent-tool-calls/machine`](https://www.npmjs.com/package/@agent-tool-calls/machine),
assigning each operation a risk tier per the
[`timmy-sdk`](https://www.npmjs.com/package/timmy-sdk) `TimmyPlugin` contract.

## Tools

| tool            | risk      | description                              |
| --------------- | --------- | ---------------------------------------- |
| `openApp`       | `safe`    | open an application by name              |
| `playMedia`     | `safe`    | play media by URI (e.g. a Spotify URI)   |
| `listDirectory` | `safe`    | list entries in a directory             |
| `deleteFile`    | `confirm` | delete a file (asks for confirmation)    |
| `killProcess`   | `confirm` | kill a process by pid (asks first)       |

## Install

```sh
timmy plugin install github:omatsetyadi/timmy-plugin-machine
```

This shallow-clones the repo, runs `npm install` + `npm run build` (resolving
`timmy-sdk` + `@agent-tool-calls/machine` from npm and bundling them into a
self-contained `dist/index.js`), and installs it into `~/.timmy/plugins/`.

## Build from source

```sh
npm install && npm run build   # → dist/index.js (self-contained CJS bundle)
npm test
```

## License

MIT
