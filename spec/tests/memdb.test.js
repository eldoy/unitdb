var memdb = require('../../index.js')
var db

beforeEach(function () {
  db = memdb()
})

/* =========================
 *  QUERY SEMANTICS
 * ========================= */

test('empty query matches all documents', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 2 })
  t.equal(db.get({}).length, 2)
})

test('$eq shorthand and explicit', function ({ t }) {
  db.set({ a: 1 })
  t.equal(db.get({ a: 1 }).length, 1)
  t.equal(db.get({ a: { $eq: 1 } }).length, 1)
})

test('$ne requires field to exist', function ({ t }) {
  db.set({ a: 1 })
  db.set({})
  t.equal(db.get({ a: { $ne: 1 } }).length, 1)
})

test('range operators require field existence', function ({ t }) {
  db.set({ a: 5 })
  db.set({})
  t.equal(db.get({ a: { $gt: 1 } }).length, 1)
})

test('$in and $nin semantics', function ({ t }) {
  db.set({ a: 1 })
  db.set({})
  t.equal(db.get({ a: { $in: [1] } }).length, 1)
  t.equal(db.get({ a: { $nin: [1] } }).length, 1)
})

test('$exists true and false', function ({ t }) {
  db.set({ a: null })
  db.set({})
  t.equal(db.get({ a: { $exists: true } }).length, 1)
  t.equal(db.get({ a: { $exists: false } }).length, 1)
})

test('$regex matches strings only and never throws', function ({ t }) {
  db.set({ a: 'abc' })
  db.set({ a: 123 })
  t.equal(db.get({ a: { $regex: 'ab' } }).length, 1)
  t.equal(db.get({ a: { $regex: '(' } }).length, 0)
})

/* =========================
 *  LOGICAL OPERATORS
 * ========================= */

test('$and combines subqueries', function ({ t }) {
  db.set({ a: 1, b: 2 })
  db.set({ a: 1, b: 3 })
  t.equal(db.get({ $and: [{ a: 1 }, { b: 2 }] }).length, 1)
})

test('$or matches any subquery', function ({ t }) {
  db.set({ a: 1 })
  db.set({ b: 2 })
  t.equal(db.get({ $or: [{ a: 1 }, { b: 2 }] }).length, 2)
})

test('$not negates subquery', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 2 })
  t.equal(db.get({ $not: { a: 1 } }).length, 1)
})

/* =========================
 *  SORT / PAGINATION
 * ========================= */

test('sort places missing fields last', function ({ t }) {
  db.set({ a: 1, b: 1 })
  db.set({ a: 1 })
  var res = db.get({}, { sort: { b: 1 } })
  t.equal(res[1].b, undefined)
})

test('default limit is applied', function ({ t }) {
  for (var i = 0; i < 1100; i++) db.set({ i: i })
  t.equal(db.get({}).length, 1000)
})

test('skip and limit are applied after filtering', function ({ t }) {
  for (var i = 0; i < 5; i++) db.set({ i: i })
  var res = db.get({}, { skip: 2, limit: 2 })
  t.equal(res.length, 2)
  t.equal(res[0].i, 2)
})

/* =========================
 *  PROJECTION
 * ========================= */

test('fields projection is inclusive and preserves id', function ({ t }) {
  db.set({ a: 1, b: 2 })
  var r = db.get({}, { fields: { a: true } })[0]
  t.equal(r.a, 1)
  t.equal(r.b, undefined)
  t.ok(r.id)
})

/* =========================
 *  COUNT
 * ========================= */

test('count returns count object and no documents', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 2 })
  var res = db.get({}, { count: true })
  t.equal(res.count, 2)
})

/* =========================
 *  STREAMING
 * ========================= */

test('streaming respects limit and batch size', function ({ t }) {
  for (var i = 0; i < 5; i++) db.set({ i: i })
  var seen = 0
  db.get({}, { batch: 2, limit: 3 }, function (docs) {
    seen += docs.length
  })
  t.equal(seen, 3)
})

/* =========================
 *  MUTATION SEMANTICS
 * ========================= */

test('insert mutates document with id and returns same object', function ({
  t
}) {
  var o = { a: 1 }
  var r = db.set(o)
  t.equal(r, o)
  t.ok(o.id)
})

test('bulk insert assigns ids', function ({ t }) {
  var docs = [{ a: 1 }, { a: 2 }]
  var res = db.set(docs)
  t.equal(res.length, 2)
  t.ok(res[0].id)
  t.ok(res[1].id)
})

test('update performs shallow merge and returns n', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 1 })
  var r = db.set({ a: 1 }, { b: 2 })
  t.equal(r.n, 2)
  t.equal(db.get({ b: 2 }).length, 2)
})

test('undefined in update removes field', function ({ t }) {
  db.set({ a: 1, b: 2 })
  db.set({ a: 1 }, { b: undefined })
  t.equal(db.get({ b: { $exists: true } }).length, 0)
})

test('delete removes all matches', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 1 })
  var r = db.set({ a: 1 }, null)
  t.equal(r.n, 2)
  t.equal(db.get({}).length, 0)
})

test('clear removes all documents', function ({ t }) {
  db.set({ a: 1 })
  db.set({ a: 2 })
  db.set({}, null)
  t.equal(db.get({}).length, 0)
})

/* =========================
 *  SAFETY / GUARANTEES
 * ========================= */

test('query does not allow prototype pollution', function ({ t }) {
  db.set({ a: 1 })
  db.get({ __proto__: { polluted: true } })
  t.equal({}.polluted, undefined)
})

test('returned documents are live references', function ({ t }) {
  db.set({ a: 1 })
  var r = db.get({})
  r[0].a = 9
  t.equal(db.get({ a: 9 }).length, 1)
})

/* =========================
 *  ESCAPE HATCH
 * ========================= */

test('data escape hatch is exposed', function ({ t }) {
  t.ok(db.data)
})
