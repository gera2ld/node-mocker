const fs = require('fs');
const util = require('util');
const Transform = require('stream').Transform;
const HttpProxy = require('http-proxy');
const ensureDir = require('ensure-dir');

module.exports = function (options) {
  const config = {
    dir: null,
    mode: false,
    proxy: HttpProxy.createProxyServer(),
  };
  config.proxy.on('end', function (req, res, proxyRes) {
    config.mode && config.mode.save && res.dump();
  });
  Object.assign(config, options);
  if (config.backends) {
    if (Array.isArray(config.backends)) {
      config.backends = {'': config.backends};
    }
  } else config.mode = false;
  config.dir && ensureDir(config.dir);

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
    this.originalPath = ctx.url;
    this.path = this.normalize(this.originalPath);
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

Mocker.prototype.normalize = function (url) {
  url = url.split('?');
  var path = url[0];
  var qs = (url[1] || '').split('&').map(part => part.split('='));
  if (qs.length) {
    qs.sort();
    path += '?' + qs.map(pair => pair[0] + '=' + (pair[1] || '')).join('&');
  }
  return path;
};

Mocker.prototype.transformPath = function (ctx) {
  return encodeURIComponent(ctx.path);
};

Mocker.prototype.getFilename = function () {
  return new Promise((resolve, reject) => {
    const transformPath = this.config.transformPath || this.transformPath;
    const path = transformPath(this.ctx);
    if (path == null || path === false) return reject();
    resolve(`${this.config.dir}/${path}.${this.ctx.method}`);
  });
};

Mocker.prototype.dump = function () {
  const status = this.ctx.status;
  if (status < 200 || status > 300) return;
  const buffer = Buffer.concat(this.buffers);
  const data = buffer.toString();
  this.getFilename().then(filename => {
    fs.writeFile(filename, JSON.stringify({
      status: status,
      headers: this.headers,
      data: data,
    }), 'utf8');
  });
};

Mocker.prototype.load = function* (next) {
  const backends = this.getBackends();
  const backend = backends && backends.find && backends.find(backend => {
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
      this.getFilename().then(filename => {
        fs.readFile(filename, 'utf8', (err, data) => err ? reject(err) : resolve(data));
      }, reject);
    } else reject();
  }).then(data => {
    const obj = JSON.parse(data);
    const ctx = this.ctx;
    ctx.status = obj.status;
    ctx.headers = obj.headers;
    ctx.body = obj.data;
  });
};

Mocker.prototype.send = function (backend) {
  var path = this.ctx.path;
  if (backend.backend_prefix != null) {
    path = backend.backend_prefix + path.slice(backend.prefix.length);
  }
  this.ctx.path = path;
  return new Promise((resolve, reject) => {
    this.config.proxy.web(this.ctx.req, this, {
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

Mocker.prototype.getBackends = function () {
  const cookie = this.ctx.headers.cookie || '';
  const matches = cookie.match(/(^|[;\s*])server=([^;]*)/);
  const key = matches && matches[2];
  return key && this.config.backends[key] || this.config.backends[''];
};
