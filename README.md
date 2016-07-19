Mocker
===

![NPM](https://img.shields.io/npm/v/node-mocker.svg)
![License](https://img.shields.io/npm/l/node-mocker.svg)
![Downloads](https://img.shields.io/npm/dt/node-mocker.svg)

A proxy-pass server to mock backend data automatically.

Usage
---
``` javascript
const koa = require('koa');
const mocker = require('node-mocker');

const app = koa();
app.use(mocker({
  dir: 'mock-data',
  mode: false, // false | {save: false, mock: false}
  backends: [{
    prefix: '/api',
    backend_prefix: '/awesome',
    host: 'http://awesome.backend.com',
  }],
}));
```

### Modes

`config.mode` is either `false` or an object with attributes below:

* `mock`: Boolean

  Try to load responses from cache, and send requests when no cache data is found.

* `save`: Boolean

  Fetch from remote and save the successful responses to cache directory (`config.dir`).

### Backends

Backends should be an array of objects with attributes below:

* `prefix`: Required

  The prefix to match URLs that should be by-passed to proxy.

* `host`: Required

  The target host of proxy.

* `backend_prefix`: Optional

  If other than `null`, the `prefix` in `request.url` will be replaced to `backend_prefix`.
