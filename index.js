var crypto = require('crypto')

module.exports = function unitdb() {
  var data = []

  function genId() {
    return crypto.randomUUID()
  }

  function isDate(v) {
    return v instanceof Date
  }

  function valEq(a, b) {
    if (isDate(a) && isDate(b)) return a.getTime() === b.getTime()
    return a === b
  }

  function cmp(a, b) {
    if (isDate(a) && isDate(b)) return a.getTime() - b.getTime()
    if (typeof a !== typeof b) return 0
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }

  function matchOp(val, op, cond) {
    if (op === '$gt') return val > cond
    if (op === '$gte') return val >= cond
    if (op === '$lt') return val < cond
    if (op === '$lte') return val <= cond
    if (op === '$ne') return !valEq(val, cond)
    if (op === '$in')
      return cond.some(function (c) {
        return valEq(val, c)
      })
    if (op === '$nin')
      return !cond.some(function (c) {
        return valEq(val, c)
      })
    if (op === '$regex') {
      if (typeof val !== 'string') return false
      var re
      try {
        re = cond instanceof RegExp ? cond : new RegExp(cond)
      } catch (e) {
        return false
      }
      return re.test(val)
    }
    return false
  }

  function matchDoc(doc, query) {
    for (var k in query) {
      if (k === '__proto__') continue
      var qv = query[k]
      var dv = doc[k]

      if (qv && typeof qv === 'object' && !Array.isArray(qv) && !isDate(qv)) {
        for (var op in qv) {
          if (!matchOp(dv, op, qv[op])) return false
        }
      } else {
        if (!valEq(dv, qv)) return false
      }
    }
    return true
  }

  function get(query, opts) {
    if (!query) query = {}
    if (!opts) opts = {}

    var res = data.filter(function (d) {
      return matchDoc(d, query)
    })

    if (opts.sort) {
      var keys = Object.keys(opts.sort)
      res.sort(function (a, b) {
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i]
          var dir = opts.sort[k]
          var c = cmp(a[k], b[k])
          if (c !== 0) return c * dir
        }
        return 0
      })
    }

    var s = opts.skip || 0
    var l = opts.limit == null ? res.length : opts.limit
    return res.slice(s, s + l)
  }

  function insertOne(obj) {
    if (!obj.id) obj.id = genId()
    data.push(obj)
    return obj.id
  }

  function set(q, v) {
    if (Array.isArray(q)) {
      var out = []
      for (var i = 0; i < q.length; i++) {
        insertOne(q[i])
        out.push(q[i])
      }
      return out
    }

    if (v === undefined) {
      insertOne(q)
      return q.id
    }

    var idx = data.findIndex(function (d) {
      return matchDoc(d, q)
    })
    if (idx === -1) return null

    if (v === null) {
      data = data.slice(0, idx).concat(data.slice(idx + 1))
      return null
    }

    Object.assign(data[idx], v)
    return data[idx].id
  }

  return { get: get, set: set }
}
