var unitdb = require('../../index.js')
var db

beforeEach(function () {
  db = unitdb()
})

test('get() basic and numeric operators', function ({ t }) {
  db.set({ name: 'a', val: 10 })
  db.set({ name: 'a', val: 20 })

  t.equal(db.get({ name: 'a' }).length, 2)
  t.equal(db.get({ val: { $gt: 15 } }).length, 1)
  t.equal(db.get({ val: { $lte: 10 } }).length, 1)
})

test('get() with multi-key sorting', function ({ t }) {
  db.set({ name: 'Charlie', age: 30 })
  db.set({ name: 'Alice', age: 25 })
  db.set({ name: 'Bob', age: 25 })

  var res = db.get({}, { sort: { age: 1, name: 1 } })
  t.equal(res[0].name, 'Alice')
  t.equal(res[1].name, 'Bob')
  t.equal(res[2].name, 'Charlie')

  var resDesc = db.get({}, { sort: { age: -1 } })
  t.equal(resDesc[0].name, 'Charlie')
})

test('set() create, update, remove', function ({ t }) {
  var id = db.set({ type: 'job', name: 'a' })
  t.ok(id)

  db.set({ id: id }, { name: 'b' })
  t.equal(db.get({ name: 'b' })[0].id, id)

  db.set({ id: id }, null)
  t.equal(db.get({ id: id }).length, 0)
})

test('set() create multiple documents', function ({ t }) {
  var docs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]

  var res = db.set(docs)

  t.equal(Array.isArray(res), true)
  t.equal(res.length, 3)

  t.ok(res[0].id)
  t.ok(res[1].id)
  t.ok(res[2].id)

  t.equal(db.get({}).length, 3)
  t.equal(db.get({ name: 'a' }).length, 1)
  t.equal(db.get({ name: 'b' }).length, 1)
  t.equal(db.get({ name: 'c' }).length, 1)
})

test('pagination (limit and skip) with sort', function ({ t }) {
  db.set({ n: 1 })
  db.set({ n: 2 })
  db.set({ n: 3 })
  db.set({ n: 4 })
  db.set({ n: 5 })

  var res = db.get({}, { sort: { n: -1 }, skip: 2, limit: 2 })
  t.equal(res.length, 2)
  t.equal(res[0].n, 3)
  t.equal(res[1].n, 2)
})

test('get() array and regex operators', function ({ t }) {
  db.set({ tag: 'a', name: 'Apple' })
  db.set({ tag: 'b', name: 'Banana' })

  t.equal(db.get({ tag: { $in: ['a', 'c'] } }).length, 1)
  t.equal(db.get({ tag: { $nin: ['a'] } }).length, 1)
  t.equal(db.get({ name: { $regex: /^Ap/ } }).length, 1)
})

test('date handling with range operators', function ({ t }) {
  var myDate = new Date('2025-05-05T00:00:00Z')
  db.set({ id: 'dt', time: myDate })

  t.equal(db.get({ time: { $gt: new Date('2025-01-01T00:00:00Z') } }).length, 1)
})

test('date equality uses value comparison', function ({ t }) {
  var d1 = new Date('2025-01-01T00:00:00Z')
  var d2 = new Date('2025-01-01T00:00:00Z')

  db.set({ when: d1 })

  t.equal(db.get({ when: d2 }).length, 1)
})

test('date $in / $nin use value comparison', function ({ t }) {
  var d1 = new Date('2025-01-01T00:00:00Z')
  var d2 = new Date('2025-01-01T00:00:00Z')

  db.set({ when: d1 })

  t.equal(db.get({ when: { $in: [d2] } }).length, 1)
  t.equal(db.get({ when: { $nin: [d2] } }).length, 0)
})

test('missing keys and nulls', function ({ t }) {
  db.set({ name: 'a', meta: null })

  t.equal(db.get({ nonExistent: 'foo' }).length, 0)
  t.equal(db.get({ meta: null }).length, 1)
  t.equal(db.get({ meta: { $ne: 'something' } }).length, 1)
})

test('regex safety with numbers', function ({ t }) {
  db.set({ name: 123 })

  t.doesNotThrow(function () {
    var res = db.get({ name: { $regex: /abc/ } })
    t.equal(res.length, 0)
  })
})

test('$regex string target is compiled and matched', function ({ t }) {
  db.set({ name: 'abc' })
  db.set({ name: 'def' })

  var res = db.get({ name: { $regex: 'ab' } })

  t.equal(res.length, 1)
  t.equal(res[0].name, 'abc')
})

test('$regex invalid pattern matches nothing', function ({ t }) {
  db.set({ name: 'abc' })

  var res = db.get({ name: { $regex: '(' } })

  t.equal(res.length, 0)
})

test('delete reassigns data array and invalidates old references', function ({
  t
}) {
  db.set({ a: 1 })
  db.set({ a: 2 })

  var snapshot = db.get({})
  db.set({ a: 1 }, null)

  t.equal(snapshot.length, 2)
  t.equal(db.get({}).length, 1)
})

test('insert mutates caller object by adding id', function ({ t }) {
  var obj = { a: 1 }
  t.equal(obj.id, undefined)

  db.set(obj)

  t.ok(obj.id)
})

test('query iterates inherited properties', function ({ t }) {
  var q = Object.create({ a: 1 })
  db.set({ a: 1 })

  t.equal(db.get(q).length, 1)
})

test('prototype pollution via query keys', function ({ t }) {
  db.set({ safe: true })

  db.get({ __proto__: { polluted: true } })

  t.equal({}.polluted, undefined)
})

test('sorting mixed types is unstable', function ({ t }) {
  db.set({ v: 10 })
  db.set({ v: '2' })

  var res = db.get({}, { sort: { v: 1 } })
  t.equal(res.length, 2)
})

test('returned documents are mutable references', function ({ t }) {
  db.set({ a: 1 })

  var res = db.get({})
  res[0].a = 99

  t.equal(db.get({ a: 99 }).length, 1)
})
