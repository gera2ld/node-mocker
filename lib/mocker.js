const fs = require('fs');
const util = require('util');
const Transform = require('stream').Transform;
const HttpProxy = require('http-proxy');
const ensureDir = require('./ensureDir');

const config = {
  dir: null,
  mode: false,  // 'save' | 'mock' | false
  /*backends: {
    awesome_backend: {
      prefix: '/awesome',
      host: 'http://awesome.backend.com',
    },
  },*/
};
const proxy = HttpProxy.createProxyServer();
proxy.on('end', function (req, res, proxyRes) {
  config.mode === 'save' && res.dump();
});

Mocker.setConfig = function (_config) {
  Object.assign(config, _config);
  if (!config.backends) config.mode = false;
  config.dir && ensureDir(config.dir);
};
Mocker.setConfig();

function Mocker(ctx) {
  if (!(this instanceof Mocker)) return new Mocker(ctx);
  Transform.call(this);
  this.ctx = ctx;
  this.path = ctx.request.url;
  this.buffers = [];
  this.headers = [];
}

util.inherits(Mocker, Transform);

Mocker.prototype._transform = function (chunk, encoding, callback) {
  this.buffers.push(chunk);
  callback(null, chunk);
};
Mocker.prototype.setHeader = function (key, val) {
  if (!key.startsWith('x-') && !~[
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
Mocker.prototype.getFilename = function () {
  return `${config.dir}/${encodeURIComponent(this.path)}.${this.ctx.request.method}`;
};
Mocker.prototype.dump = function () {
  const status = this.ctx.status;
  if (status < 200 || status > 300) return;
  const buffer = Buffer.concat(this.buffers);
  const data = buffer.toString();
  fs.writeFile(this.getFilename(), JSON.stringify({
    status: status,
    headers: this.headers,
    data: data,
  }), 'utf8');
};
Mocker.prototype.mock = function () {
  const mocker = this;
  return function (cb) {
    (config.mode === 'mock' ? new Promise((resolve, reject) => {
      fs.readFile(mocker.getFilename(), 'utf8', (err, data) => err ? reject(err) : resolve(data));
    }) : Promise.reject()).then(data => {
      const obj = JSON.parse(data);
      const ctx = mocker.ctx;
      ctx.status = obj.status;
      ctx.headers = obj.headers;
      ctx.body = obj.data;
      cb();
    }, err => {
      mocker.send()(cb);
    });
  };
};
Mocker.prototype.send = function () {
  const mocker = this;
  const ctx = this.ctx;
  const backend = this.getBackend();
  return backend ? function (cb) {
    ctx.request.path = backend.prefix + ctx.request.path;
    proxy.web(ctx.req, mocker, {
      target: backend.host,
      changeOrigin: true,
    }, (e) => {
      if (e && e.code === 'ETIMEDOUT') {
        ctx.status = 504;
        cb();
      } else {
        console.log(e);
        cb(e);
      }
    });
  } : function (cb) {
    ctx.status = 404;
    cb();
  };
};
Mocker.prototype.getBackend = function () {
  const cookie = this.ctx.request.headers.cookie || '';
  const matches = cookie.match(/(^|[;\s*])server=([^;]*)/);
  const key = matches && matches[2];
  return key && config.backends[key] || config.backends[''];
};

module.exports = Mocker;
