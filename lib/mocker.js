const fs = require('fs');
const util = require('util');
const Transform = require('stream').Transform;
const HttpProxy = require('http-proxy');
const ensureDir = require('ensure-dir');

function readFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}

function writeFile(filename, data, options) {
  options = options || 'utf8';
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, data, options, err => {
      err ? reject(err) : resolve();
    });
  });
}

function readObj(obj, parts) {
  if (typeof parts === 'string') parts = parts.split('.');
  const len = parts.length;
  var i = 0;
  while (obj && i < len) {
    var key = parts[i];
    obj = obj[key];
  }
  return obj;
}

module.exports = function (options) {
  const config = Object.assign({
    dir: 'mock',
    mode: false,
    mock: {},
    proxy: HttpProxy.createProxyServer(),
  }, options);
  config.proxy.on('end', function (req, res, proxyRes) {
    config.mode && config.mode.save && res.dump();
  });
  if (!config.backends) config.mode = false;
  if (config.dir) {
    ensureDir(config.dir)
    .then(() => readFile(`${config.dir}/mock.json`))
    .then(data => config.mock = JSON.parse(data));
  }

  return function* (next) {
    const mocker = new Mocker(this, config);
    yield* mocker.load(next);
  };
};

function Mocker(ctx, config) {
  if (!(this instanceof Mocker)) return new Mocker(ctx, config);
  Transform.call(this);
  this.ctx = ctx;
  this.config = config;
  if (config.mode) {
    if (config.mode.save) {
      this.buffers = [];
      this.headers = [];
    }
  }
}

util.inherits(Mocker, Transform);

Mocker.prototype._transform = function (chunk, encoding, callback) {
  this.buffers && this.buffers.push(chunk);
  callback(null, chunk);
};

Mocker.prototype.setHeader = function (key, val) {
  if (this.headers && !key.startsWith('x-') && !~[
    'date',
    'server',
    'transfer-encoding',
    'cache-control',
    'connection',
    'set-cookie',
    'content-length',
  ].indexOf(key)) this.headers.push([key, val]);
  return this.ctx.res.setHeader(key, val);
};

Mocker.prototype.writeHead = function (status) {
  this.pipe(this.ctx.res);
  return this.ctx.res.writeHead(status);
};

Mocker.prototype.dump = function () {
  const status = this.ctx.status;
  if (status < 200 || status > 300) return;
  const buffer = Buffer.concat(this.buffers);
  const data = buffer.toString('base64');
  const log = `
  Path: ${this.ctx.path}
  Status: ${status}
  Headers: ${JSON.stringify(this.headers)}
  Data: ${data}
  `;
  writeFile(`${this.config.dir}/log.txt`, log, {flag: 'a'});
};

Mocker.prototype.load = function* (next) {
  const backends = this.config.backends;
  const backend = backends && backends.find(backend => {
    const path = this.ctx.path;
    var prefix = backend.prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (path === backend.prefix || path.startsWith(prefix)) {
      return true;
    }
  });
  if (backend) {
    yield this.mock().catch(() => this.send(backend));
  } else {
    yield next;
  }
};

Mocker.prototype.mock = function () {
  return new Promise((resolve, reject) => {
    if (this.config.mode && this.config.mode.mock) {
      const data = readObj(this.config.mock, [this.ctx.path, this.ctx.method]);
      data == null ? reject() : resolve(data);
    } else reject();
  }).then(data => {
    const ctx = this.ctx;
    ctx.body = data;
  });
};

Mocker.prototype.send = function (backend) {
  const ctx = this.ctx;
  var path = ctx.path;
  if (backend.backend_prefix != null) {
    path = backend.backend_prefix + path.slice(backend.prefix.length);
  }
  ctx.path = path;
  return new Promise((resolve, reject) => {
    this.config.proxy.web(ctx.req, this, {
      target: backend.host,
      changeOrigin: true,
    }, (e) => {
      const status = {
        ECONNREFUSED: 503,
        ETIMEDOUT: 504,
      }[e.code];
      if (!status) {
        console.log(e);
        resolve(e);
      } else {
        ctx.status = status;
        resolve();
      }
    });
  });
};
