const koa = require('koa')
const mocker = require('..')

const app = koa()

app.use(mocker({
  backends: [{
    prefix: '',
    host: 'http://gerald.top',
  }]
}))

const PORT = 4080
app.listen(PORT, e => {
  e ? console.log(e) : console.log(`Listening at port ${PORT}...`)
});
