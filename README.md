Mocker
===

A proxy-pass server to mock backend data automatically.

Usage
---
``` javascript
const Mocker = require('node-mocker');

Mocker.setConfig({
  dir: 'mock-data/',
  mode: 'save',
  backends: {
    '': {
      prefix: '/backend',
      host: 'http://default.backend.com',
    },
  },
});

app = koa();
app.use(function* (next) {
  const mocker = new Mocker(this);
  yield mocker.mock();
});
```
