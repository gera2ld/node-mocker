Mocker
===

![NPM](https://img.shields.io/npm/v/node-mocker.svg)
![License](https://img.shields.io/npm/l/node-mocker.svg)
![Downloads](https://img.shields.io/npm/dt/node-mocker.svg)

A proxy-pass server to mock backend data automatically.

Usage
---
``` javascript
const Mocker = require('node-mocker');
const config = {
  dir: 'mock-data/',
  mode: 'save',
  backends: {
    '': {
      prefix: '/backend',
      host: 'http://default.backend.com',
    },
  },
};

Mocker.setConfig(config);

app = koa();
app.use(function* (next) {
  const mocker = new Mocker(this);
  yield mocker.mock();
});
```

### Modes

There are three modes: `'save'`, `'mock'` and `false`.

* 'save'

  Fetch all requests from remote and save the successful responses to cache directory (`config.dir`).

* 'mock'

  Try to load responses from cache, and send requests when no cache data is found.

* false

  Just work as a proxy-pass server.

### Backends

Serveral backends can be referenced to `config.backends`, at least one (`config.backends['']`) should be provided, which will work as the default backend.

If a cookie named `server` is sent, Mocker will try to find the corresponding backend with value of `server` as the name.

For example:

``` javascript
// Front end
document.cookie = 'server=foo';

// Node server
const config = {
  ...
  backends: {
    '': {
      prefix: '',
      host: 'http://backend.default'
    },
    foo: {
      prefix: '',
      host: 'http://backend.foo'
    }
  }
};
```

With a cookie of `server=foo`, all requests will go to `http://backend.foo`.
