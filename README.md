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

app = koa();
app.use(mocker({
  dir: 'mock-data',
  mode: false, // false | {save: false, mock: false}
  backends: {
    '': [{
      prefix: '/api',
      backend_prefix: '/awesome',
      host: 'http://awesome.backend.com',
    }],
    local: [{
      prefix: '/api',
      host: 'http://localhost',
    }]
  },
}));
```

### Modes

`config.mode` is either `false` or an object with attributes below:

* `mock`: Boolean

  Try to load responses from cache, and send requests when no cache data is found.

* `save`: Boolean

  Fetch from remote and save the successful responses to cache directory (`config.dir`).

### Backends

Serveral groups of backends can be referenced to `config.backends`, at least one (`config.backends['']`) should be provided, which will work as the default backend.

A group of backends should be an array of objects with attributes below:

* `prefix`: Required

  The prefix to match URLs that should be by-passed to proxy.

* `backend_prefix`: Optional

  If other than `null`, the `prefix` in `request.url` will be replaced to `backend_prefix`.

* `host`: Required

  The target host of proxy.

If a cookie named `server` is sent, Mocker will try to find the corresponding backend with value of `server` as the name.

For example:

``` javascript
// Front end
document.cookie = 'server=foo';

// Node server
const config = {
  ...
  backends: {
    '': [{
      prefix: '',
      backend_prefix: '/api',
      host: 'http://backend.default'
    }],
    foo: [{
      prefix: '',
      host: 'http://backend.foo'
    }]
  }
};
```

With a cookie of `server=foo`, all requests will go to `http://backend.foo`.
