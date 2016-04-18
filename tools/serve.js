const koa = require('koa');
const mocker = require('..');

const app = koa();

app.use(mocker({
  dir: 'mock',
  mode: {
    mock: true,
    save: true,
  },
  backends: [{
    prefix: '',
    host: 'https://www.baidu.com',
  }],
  transformPath,
}));

const PORT = 4080;
app.listen(PORT, err => {
  console.log(err || `Listening at port ${PORT}...`);
});

function transformPath(ctx) {
  return encodeURIComponent(ctx.path);
}
