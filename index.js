var { DatabaseSync } = require('node:sqlite')
var crypto = require('node:crypto')

function sysdb(file) {
  var db = new DatabaseSync(file)

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `)

  function norm(v) {
    if (v instanceof Date) return v.getTime()
    if (typeof v === 'string') {
      var t = Date.parse(v)
      return isNaN(t) ? v : t
    }
    return v
  }

  function matches(doc, query) {
    for (var k in query) {
      var condition = query[k]
      var value = doc[k]

      if (
        typeof condition === 'object' &&
        condition !== null &&
        !Array.isArray(condition) &&
        !(condition instanceof RegExp)
      ) {
        var v = norm(value)

        for (var op in condition) {
          var target = condition[op]

          if (op === '$regex') {
            if (typeof value !== 'string' || !target.test(value)) return false
            continue
          }

          var t = norm(target)

          if (op === '$gt' && !(v > t)) return false
          if (op === '$lt' && !(v < t)) return false
          if (op === '$gte' && !(v >= t)) return false
          if (op === '$lte' && !(v <= t)) return false
          if (op === '$ne' && v === t) return false
          if (op === '$in' && !target.includes(v)) return false
          if (op === '$nin' && target.includes(v)) return false
        }
      } else {
        if (value !== condition) return false
      }
    }
    return true
  }

  function allDocs() {
    return db
      .prepare('SELECT json FROM records')
      .all()
      .map((r) => JSON.parse(r.json))
  }

  return {
    get(query, options) {
      var limit = (options && options.limit) || Infinity
      var skip = (options && options.skip) || 0
      var sort = options && options.sort

      var results = []
      var rows = allDocs()

      for (var i = 0; i < rows.length; i++)
        if (matches(rows[i], query)) results.push(rows[i])

      if (sort) {
        var keys = Object.keys(sort)
        results.sort(function (a, b) {
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            var d = sort[k]
            if (a[k] === b[k]) continue
            return d === -1 ? (a[k] < b[k] ? 1 : -1) : a[k] > b[k] ? 1 : -1
          }
          return 0
        })
      }

      return results.slice(skip, skip + limit)
    },

    async set(query, values) {
      var id

      if (values === undefined) {
        values = query
        values.id = values.id || crypto.randomUUID()
        id = values.id

        db.prepare('INSERT INTO records (id, json) VALUES (?, ?)').run(
          values.id,
          JSON.stringify(values)
        )
      } else if (values === null) {
        var rows = allDocs()
        var del = db.prepare('DELETE FROM records WHERE id = ?')

        for (var i = 0; i < rows.length; i++)
          if (matches(rows[i], query)) del.run(rows[i].id)
      } else {
        var rows = allDocs()
        var upd = db.prepare('UPDATE records SET json = ? WHERE id = ?')

        for (var i = 0; i < rows.length; i++) {
          if (matches(rows[i], query)) {
            Object.assign(rows[i], values)
            upd.run(JSON.stringify(rows[i]), rows[i].id)
          }
        }
      }

      return id
    }
  }
}

module.exports = sysdb
