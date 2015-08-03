const http = require('http')
const expect = require('chai').expect
const toxy = require('..')
const supertest = require('supertest')

suite('toxy', function () {
  test('static members', function () {
    expect(toxy.rules).to.be.an('object')
    expect(toxy.poisons).to.be.an('object')
    expect(toxy.Directive).to.be.a('function')
    expect(toxy.VERSION).to.be.a('string')
  })

  test('use poison', function (done) {
    var proxy = toxy()
    var called = false

    proxy.poison(function delay(req, res, next) {
      called = true
      setTimeout(next, 5)
    })

    expect(proxy.isPoisonEnabled('delay')).to.be.true
    proxy.disable('delay')
    expect(proxy.isPoisonEnabled('delay')).to.be.false
    proxy.enable('delay')
    expect(proxy.isPoisonEnabled('delay')).to.be.true

    proxy._poisons.run(null, null, function () {
      expect(called).to.be.true
      done()
    })
  })

  test('use rule', function (done) {
    var proxy = toxy()
    var called = false

    proxy.rule(function delay(req, res, next) {
      called = true
      setTimeout(next, 5)
    })

    expect(proxy.isRuleEnabled('delay')).to.be.true
    proxy.disableRule('delay')
    expect(proxy.isRuleEnabled('delay')).to.be.false
    proxy.enableRule('delay')
    expect(proxy.isRuleEnabled('delay')).to.be.true

    proxy._rules.run(null, null, function () {
      expect(called).to.be.true
      done()
    })
  })

  test('e2e', function (done) {
    var proxy = toxy()
    var server = createServer(9001, 200)
    var timeout = 100

    proxy.poison(toxy.poisons.latency(timeout))

    proxy.rule(function method(req, res, next) {
      next(req.method === 'GET' ? null : true)
    })

    proxy.forward('http://localhost:9001')
    proxy.get('/foo')
    proxy.listen(9000)

    var init = Date.now()
    supertest('http://localhost:9000')
      .get('/foo')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({ hello: 'world' })
      .end(assert)

    function assert(err) {
      expect(Date.now() - init).to.be.at.least(timeout - 1)
      done(err)
    }
  })
})

function createServer(port, code, assert) {
  var server = http.createServer(function (req, res) {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.write(JSON.stringify({ 'hello': 'world' }))

    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      req.body = body
      end()
    })

    function end() {
      if (assert) assert(req, res)
      res.end()
    }
  })

  server.listen(port)
  return server
}