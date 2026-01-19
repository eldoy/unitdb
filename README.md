## UnitDB

A lightweight, **in-memory JSON database** for Node.js designed for speed and simplicity. Intended for **single-process environments only**. Clustered or multi-process usage is not supported.

`unitdb` keeps all data in memory and does not persist data.

---

### Features

* **Mongo-style Queries:** `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$in`, `$nin`, `$regex`
* **In-memory Authority:** All reads operate on in-memory data
* **Date Support:** Automatic normalization and comparison of `Date` values
* **Pagination:** Built-in `limit` and `skip`
* **Minimal API:** Only `get()` and `set()`

---

### Installation

```sh
npm i unitdb
```

---

### Usage

```js
var unitdb = require('unitdb')

// Single database / collection
var db = unitdb('./unitdb.json')

var users = db.get({ type: 'user' })

// Multiple logical tables
var db = {
  users: unitdb('./users.json'),
  projects: unitdb('./projects.json'),
}

var users = db.users.get({})
var projects = db.projects.get({})
```

---

### Usage Examples

#### 1. Inserting Data

Passing a single object inserts a new document. A UUID `id` is generated automatically if missing.

```js
db.set({
  name: 'Project Alpha',
  status: 'pending',
  priority: 1,
  createdAt: new Date()
})
```

---

#### 2. Querying with Operators

```js
// Find high priority tasks
var tasks = db.get({
  priority: { $gte: 5 },
  status: { $ne: 'archived' }
})

// Regex and array operators
var results = db.get({
  name: { $regex: /^Project/i },
  tags: { $in: ['urgent', 'active'] }
})
```

---

#### 3. Updating Data

```js
// Update all pending tasks
db.set({ status: 'pending' }, { status: 'active' })

// Update by ID
db.set({ id: 'some-uuid' }, { progress: 100 })
```

---

#### 4. Deleting Data

```js
// Delete a single record
db.set({ id: 'some-uuid' }, null)

// Delete all completed tasks
db.set({ status: 'completed' }, null)

// Clear entire database
db.set({}, null)
```

---

#### 5. Pagination

```js
var page = db.get({ type: 'log' }, {
  limit: 10,
  skip: 10
})
```

---

### Persistence Model

* Data is stored **in memory**
* Writes are **debounced** (5 ms) and snapshotted to disk
* Persistence is **eventual**
* On process exit before snapshot, recent writes may be lost

There is no explicit flush or commit operation.

---

### API Reference

| Method                  | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `get(query, [options])` | Returns matching documents. Supports `{ limit, skip, sort }`. |
| `set(query, [values])`  | Insert, update, or delete documents.                          |

---

### Limitations

* Single process only
* No multi-process safety
* No transactional guarantees
* No live reload of external file changes

For multi-process, persistence or crash-durable use cases, use **`sysdb`** instead.

---

### License

ISC.

---

### Acknowledgements

Created by [Vidar Eldøy](https://eldoy.com)
