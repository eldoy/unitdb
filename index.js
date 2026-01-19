var crypto = require('crypto')

module.exports = function memdb() {
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

  function normalize(v) {
    if (isDate(v)) return v.getTime()
    return v
  }

  function cmp(a, b) {
    if (a === undefined && b === undefined) return 0
    if (a === undefined) return 1
    if (b === undefined) return -1
    a = normalize(a)
    b = normalize(b)
    if (typeof a !== typeof b) return 0
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }

  function matchPredicate(doc, key, pred) {
    var has = Object.prototype.hasOwnProperty.call(doc, key)
    var val = doc[key]

    if (
      pred &&
      typeof pred === 'object' &&
      !Array.isArray(pred) &&
      !isDate(pred)
    ) {
      for (var op in pred) {
        var cond = pred[op]

        if (op === '$eq') {
          if (!has || !valEq(val, cond)) return false
        } else if (op === '$ne') {
          if (has && valEq(val, cond)) return false
        } else if (op === '$gt') {
          if (!has || normalize(val) <= normalize(cond)) return false
        } else if (op === '$gte') {
          if (!has || normalize(val) < normalize(cond)) return false
        } else if (op === '$lt') {
          if (!has || normalize(val) >= normalize(cond)) return false
        } else if (op === '$lte') {
          if (!has || normalize(val) > normalize(cond)) return false
        } else if (op === '$in') {
          if (!has) return false
          var ok = false
          for (var i = 0; i < cond.length; i++) {
            if (valEq(val, cond[i])) {
              ok = true
              break
            }
          }
          if (!ok) return false
        } else if (op === '$nin') {
          if (!has) return true
          for (var i2 = 0; i2 < cond.length; i2++) {
            if (valEq(val, cond[i2])) return false
          }
        } else if (op === '$regex') {
          if (typeof val !== 'string') return false
          var re
          try {
            re = cond instanceof RegExp ? cond : new RegExp(cond)
          } catch (e) {
            return false
          }
          if (!re.test(val)) return false
        } else if (op === '$exists') {
          if (cond === true && !has) return false
          if (cond === false && has) return false
        }
      }
      return true
    }

    return has && valEq(val, pred)
  }

  function matchQuery(doc, query) {
    for (var k in query) {
      if (k === '__proto__') continue
      if (k === '$and') {
        for (var i = 0; i < query[k].length; i++) {
          if (!matchQuery(doc, query[k][i])) return false
        }
        continue
      }
      if (k === '$or') {
        var ok = false
        for (var j = 0; j < query[k].length; j++) {
          if (matchQuery(doc, query[k][j])) {
            ok = true
            break
          }
        }
        if (!ok) return false
        continue
      }
      if (k === '$not') {
        if (matchQuery(doc, query[k])) return false
        continue
      }
      if (!matchPredicate(doc, k, query[k])) return false
    }
    return true
  }

  function applyProjection(doc, fields) {
    if (!fields) return doc
    var out = {}
    var include = null
    for (var k in fields) {
      include = fields[k]
      break
    }
    if (include) {
      for (var f in fields) {
        if (fields[f] && doc[f] !== undefined) out[f] = doc[f]
      }
      if (!fields.id) out.id = doc.id
    } else {
      for (var d in doc) {
        if (fields[d] !== false) out[d] = doc[d]
      }
    }
    return out
  }

  function get(query, opts, onBatch) {
    if (!query) query = {}
    if (!opts) opts = {}
    var limit = opts.limit == null ? 1000 : opts.limit
    var skip = opts.skip || 0

    if (opts.count) {
      var c = 0
      for (var i = 0; i < data.length; i++) {
        if (matchQuery(data[i], query)) c++
      }
      return { count: c }
    }

    var res = []
    for (var j = 0; j < data.length; j++) {
      if (matchQuery(data[j], query)) res.push(data[j])
    }

    if (opts.sort) {
      var keys = Object.keys(opts.sort)
      res.sort(function (a, b) {
        for (var i2 = 0; i2 < keys.length; i2++) {
          var k = keys[i2]
          var c2 = cmp(a[k], b[k])
          if (c2 !== 0) return c2 * opts.sort[k]
        }
        return 0
      })
    }

    res = res.slice(skip, skip + limit)

    if (onBatch) {
      var size = opts.batch || res.length
      for (var x = 0; x < res.length; x += size) {
        onBatch(res.slice(x, x + size))
      }
      return
    }

    if (opts.fields) {
      var proj = []
      for (var y = 0; y < res.length; y++) {
        proj.push(applyProjection(res[y], opts.fields))
      }
      return proj
    }

    return res
  }

  function set(q, v) {
    if (Array.isArray(q)) {
      for (var i = 0; i < q.length; i++) {
        if (!q[i].id) q[i].id = genId()
        data.push(q[i])
      }
      return q
    }

    if (v === undefined) {
      if (!q.id) q.id = genId()
      data.push(q)
      return q
    }

    var matched = []
    for (var j = 0; j < data.length; j++) {
      if (matchQuery(data[j], q)) matched.push(j)
    }

    if (v === null) {
      var n = matched.length
      if (n) {
        var keep = []
        for (var k = 0; k < data.length; k++) {
          if (matched.indexOf(k) === -1) keep.push(data[k])
        }
        data = keep
      }
      return { n: n }
    }

    for (var m = 0; m < matched.length; m++) {
      var d = data[matched[m]]
      for (var key in v) {
        if (v[key] === undefined) delete d[key]
        else d[key] = v[key]
      }
    }

    return { n: matched.length }
  }

  return { get: get, set: set }
}
