/**
 *
 * Provides: findById, findOne, find, create, insertMany, updateOne,
 *           updateMany, deleteOne, deleteMany, countDocuments, aggregate,
 *           save-style upsert, and lean().
 *
 * All query methods automatically inject the current tenant scope when
 * AsyncLocalStorage contains a tenantId.
 */

const { getTenantId } = require("../middleware/tenantScope");
const { getDB } = require("../config/db");
const crypto = require("crypto");

// UUID validation — prevents PostgreSQL 22P02 "invalid input syntax for type uuid"
// from bubbling as 500. Old Mongo ObjectIds (24 hex chars) and any other
// non-UUID strings are treated as "not found" so callers can return 401/404.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (v) => typeof v === "string" && UUID_RE.test(v);
const isInvalidUUIDForColumn = (col, val) =>
  col === "id" && typeof val === "string" && !isUUID(val);

// Mongoose-style sort specifiers ("-createdAt", "name", "a,-b") → object map
// so a string sort never decays into per-character numeric keys.
function normalizeSort(sort) {
  if (typeof sort !== "string") return sort || null;
  const out = {};
  for (const term of sort.split(",")) {
    const t = term.trim();
    if (!t) continue;
    const desc = t.charAt(0) === "-";
    const key = desc ? t.slice(1) : t;
    if (key) out[key] = desc ? "desc" : "asc";
  }
  return Object.keys(out).length ? out : null;
}

class PostgresRepository {
  /**
   * @param {import('knex').Knex|null} db  — Knex instance (null = lazy via getDB)
   * @param {string} tableName          — PostgreSQL table name
   * @param {object} opts
   * @param {string} opts.tenantField   — 'tenant_id' | 'company_id' | null
   * @param {string} opts.idColumn      — primary key column (default 'id')
   * @param {string[]} opts.jsonColumns  — columns to JSON.parse on read
   */
  constructor(db, tableName, opts = {}) {
    this._dbRef = db;
    this.table = tableName;
    this.tenantField = opts.tenantField || null;
    this.idColumn = opts.idColumn || "id";
    this.jsonColumns = opts.jsonColumns || [];
    this.instanceMethods = opts.instanceMethods || {};
    this.hooks = opts.hooks || {};
    this.fieldAliases = opts.fieldAliases || {};
  }

  get db() {
    const d = this._dbRef || getDB();
    if (!d)
      throw new Error("Database not initialized. Call connectDB() first.");
    return d;
  }

  set db(val) {
    this._dbRef = val;
  }

  // ── helpers ──────────────────────────────────────────────────────

  _q() {
    return this.db(this.table);
  }

  _scope(q) {
    if (!this.tenantField) return q;
    const tid = getTenantId();
    if (tid) q = q.where(this.tenantField, tid);
    return q;
  }

  _rowToDoc(row) {
    if (!row) return null;
    const doc = { ...row };
    for (const col of this.jsonColumns) {
      if (doc[col] && typeof doc[col] === "string") {
        try {
          doc[col] = JSON.parse(doc[col]);
        } catch (_) {
          /* keep */
        }
      }
    }
    // Add camelCase aliases for snake_case columns
    for (const key of Object.keys(doc)) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (camel !== key && !(camel in doc)) {
        doc[camel] = doc[key];
      }
    }
    // e.g. company_id → companyId (done above), but code expects "company" (not "companyId")
    const refAliases = {
      company_id: "company",
      organization_id: "organization",
      ticket_id: "ticket",
      role_id: "role",
      agent_id: "agent",
      dept_id: "dept",
      team_id: "team",
      user_id: "user",
      sla_id: "sla",
      topic_id: "topic",
      manager_id: "manager",
      leader_id: "leader",
      recipient_id: "recipient",
      plan_id: "plan",
    };
    for (const [dbCol, alias] of Object.entries(refAliases)) {
      if (dbCol in doc && !(alias in doc)) {
        doc[alias] = doc[dbCol];
      }
    }
    for (const [alias, dbCol] of Object.entries(this.fieldAliases)) {
      if (dbCol in doc && !(alias in doc)) doc[alias] = doc[dbCol];
    }
    doc._id = doc.id;
    // Attach generic save() that persists modified fields
    const self = this;
    doc.save = async function () {
      const updates = {};
      for (const [k, v] of Object.entries(doc)) {
        if (typeof v === "function" || k.startsWith("_")) continue;
        // fieldAliases win so camelCase FK refs map to their _id columns
        // (assignmentGroup → assignment_group_id), falling back to snake_case.
        const snake = self.fieldAliases[k] || self._camelToSnake(k);
        // camelCase values override snake_case (user code writes camelCase)
        if (snake !== k) {
          updates[snake] = v;
        } else if (!(snake in updates)) {
          updates[k] = v;
        }
      }
      delete updates.id;
      updates.updated_at = new Date().toISOString();
      let row = self._toRow(updates);
      if (self.hooks.preSave)
        row = (await self.hooks.preSave(row, true)) || row;
      const [result] = await self
        ._scope(self._q())
        .where(self.idColumn, doc.id)
        .update(row)
        .returning("*");
      Object.assign(doc, self._rowToDoc(result));
      return doc;
    };
    doc.deleteOne = async function () {
      await self._scope(self._q()).where(self.idColumn, doc.id).del();
    };
    // Mongoose-compatible snapshot of the document (camelCase aliases included)
    doc.toObject = function () {
      return { ...doc };
    };
    doc.toJSON = doc.toObject;
    // Attach instance methods bound to the doc
    for (const [k, fn] of Object.entries(this.instanceMethods)) {
      doc[k] = fn.bind(doc);
    }
    return doc;
  }

  _docs(rows) {
    return rows.map((r) => this._rowToDoc(r));
  }

  _toRow(data) {
    const row = {};
    const fkAliases = {
      plan: "plan_id",
      recipient: "recipient_id",
      recipientId: "recipient_id",
      planId: "plan_id",
      parent: "parent_id",
      assignedTo: "assigned_to",
      createdBy: "created_by",
      openedBy: "opened_by",
      requestedFor: "requested_for",
      lockedBy: "locked_by",
      closedBy: "closed_by",
      resolvedBy: "resolved_by",
      slaId: "sla_id",
    };
    const entries = Object.entries(data).filter(
      ([key, value]) =>
        key !== "_id" && key !== "__v" && typeof value !== "function",
    );
    for (const [key, value] of entries) {
      const column =
        this.fieldAliases[key] || fkAliases[key] || this._camelToSnake(key);
      if (column === key || !(column in row)) row[column] = value;
    }
    for (const [key, value] of entries) {
      const column =
        this.fieldAliases[key] || fkAliases[key] || this._camelToSnake(key);
      if (column !== key) row[column] = value;
    }
    if (data._id && !row.id) row.id = data._id;
    // Populated relationships are documents in API code but UUIDs in SQL.
    for (const [column, value] of Object.entries(row)) {
      if ((column.endsWith("_id") || column.endsWith("_by")) && value && typeof value === "object") {
        row[column] = value.id || value._id;
      }
    }
    // Stringify objects/arrays for JSONB columns
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && typeof v === "object" && !Buffer.isBuffer(v)) {
        row[k] = JSON.stringify(v);
      }
    }
    return row;
  }

  _camelToSnake(str) {
    return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }

  _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  _idValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value.id || value._id || value
      : value;
  }

  // ── CRUD ────────────────────────────────────────────────────────

  _buildQuery(filter = {}) {
    return this._applyFilter(this._scope(this._q()), filter);
  }

  _applyFilter(q, filter = {}) {
    const colAlias = {
      company: "company_id",
      organization: "organization_id",
      ticket: "ticket_id",
      agent: "agent_id",
      dept: "dept_id",
      team: "team_id",
      user: "user_id",
      role: "role_id",
      sla: "sla_id",
      topic: "topic_id",
      manager: "manager_id",
      leader: "leader_id",
      recipient: "recipient_id",
      recipientId: "recipient_id",
      plan: "plan_id",
      planId: "plan_id",
    };
    for (let [k, v] of Object.entries(filter)) {
      if (k === "$and" && Array.isArray(v)) {
        for (const condition of v)
          q = q.where((group) => this._applyFilter(group, condition));
        continue;
      }
      if (k === "$or" && Array.isArray(v)) {
        q = q.where((group) => {
          for (const condition of v)
            group.orWhere((branch) => this._applyFilter(branch, condition));
        });
        continue;
      }
      if (k === "departments.department") {
        q = q.whereRaw("?? @> ?::jsonb", [
          "departments",
          JSON.stringify([{ department: this._idValue(v) }]),
        ]);
        continue;
      }
      // Handle dot-notation paths for JSONB columns (e.g. "instanceMemberships.instance")
      if (k.includes(".")) {
        const parts = k.split(".");
        const col = this.fieldAliases[parts[0]] || this._camelToSnake(parts[0]);
        const lastPart = parts[parts.length - 1];
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          if (v.$ne !== undefined) {
            // NOT contains element — works for empty arrays too
            const probe = { [lastPart]: this._idValue(v.$ne) };
            q = q.whereRaw(`NOT (?? @> ?::jsonb)`, [
              col,
              JSON.stringify([probe]),
            ]);
          } else {
            q = q.whereRaw(`?? @> ?::jsonb`, [
              col,
              JSON.stringify([{ [lastPart]: this._idValue(v) }]),
            ]);
          }
        } else {
          q = q.whereRaw(`?? @> ?::jsonb`, [
            col,
            JSON.stringify([{ [lastPart]: this._idValue(v) }]),
          ]);
        }
        continue;
      }
      k =
        this.fieldAliases[k] ||
        colAlias[k] ||
        (k === "_id" ? this.idColumn : this._camelToSnake(k));
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        if (v.id || v._id) {
          q = q.where(k, v.id || v._id);
          continue;
        }
        if (v.$elemMatch) {
          q = q.whereRaw("?? @> ?::jsonb", [k, JSON.stringify([v.$elemMatch])]);
          continue;
        }
        if (v.$ne !== undefined)
          q = v.$ne === null ? q.whereNotNull(k) : q.where(k, "!=", v.$ne);
        if (v.$gt !== undefined) q = q.where(k, ">", v.$gt);
        if (v.$gte !== undefined) q = q.where(k, ">=", v.$gte);
        if (v.$lt !== undefined) q = q.where(k, "<", v.$lt);
        if (v.$lte !== undefined) q = q.where(k, "<=", v.$lte);
        if (v.$in !== undefined) q = q.whereIn(k, v.$in);
        if (v.$nin !== undefined) q = q.whereNotIn(k, v.$nin);
        if (v.$regex !== undefined) {
          const flags = v.$options || "";
          q = q.whereRaw(`?? ${flags.includes("i") ? "~*" : "~"} ?`, [
            k,
            v.$regex,
          ]);
        }
      } else if (Array.isArray(v)) {
        q = q.whereRaw(`?? @> ?::jsonb`, [k, JSON.stringify(v)]);
      } else {
        q = q.where(k, this._idValue(v));
      }
    }
    return q;
  }

  _normalizeCols(cols) {
    const fkColAlias = {
      plan: "plan_id",
      recipient: "recipient_id",
      recipientId: "recipient_id",
      planId: "plan_id",
    };
    const explicit = [];
    const forceInclude = [];
    for (const c of cols.flat()) {
      if (typeof c !== "string") {
        explicit.push(c);
        continue;
      }
      const parts = c.split(/\s+/).filter(Boolean);
      for (let p of parts) {
        if (p.startsWith("+")) {
          const raw = p.slice(1);
          const col =
            this.fieldAliases[raw] ||
            fkColAlias[raw] ||
            this._camelToSnake(raw);
          forceInclude.push(col);
        } else {
          if (p === "_id") p = "id";
          const col =
            this.fieldAliases[p] ||
            fkColAlias[p] ||
            this._camelToSnake(p);
          explicit.push(col);
        }
      }
    }
    return { explicit, forceInclude };
  }

  findById(id, projections) {
    const self = this;
    id = this._idValue(id);
    let _cols = null;
    const q = {
      select(...cols) {
        _cols = self._normalizeCols(cols);
        return q;
      },
      lean() {
        return q;
      },
      populate(path, model, select) {
        q._populates = q._populates || [];
        q._populates.push({ path, model, select });
        return q;
      },
      sort() {
        return q;
      },
      exec() {
        return Promise.resolve(q);
      },
      async then(resolve, reject) {
        try {
          if (isInvalidUUIDForColumn(self.idColumn, id)) {
            resolve(null);
            return;
          }
          let query = self._scope(self._q()).where(self.idColumn, id);
          if (_cols && _cols.explicit.length) {
            query = query.select(..._cols.explicit);
          } else if (_cols && _cols.forceInclude.length) {
            query = query.select("*", ..._cols.forceInclude);
          }
          const row = await query.first();
          const doc = self._rowToDoc(row);
          resolve(
            q._populates?.length ? await self.populate(doc, q._populates) : doc,
          );
        } catch (e) {
          if (e && e.code === "22P02") {
            // invalid input syntax for type uuid — treat as not found
            resolve(null);
            return;
          }
          reject ? reject(e) : resolve(Promise.reject(e));
        }
      },
    };
    return q;
  }

  findOne(filter = {}) {
    const self = this;
    let _cols = null;
    const q = {
      select(...cols) {
        _cols = self._normalizeCols(cols);
        return q;
      },
      lean() {
        return q;
      },
      populate(path, model, select) {
        q._populates = q._populates || [];
        q._populates.push({ path, model, select });
        return q;
      },
      sort() {
        return q;
      },
      exec() {
        return Promise.resolve(q);
      },
      async then(resolve, reject) {
        try {
          let query = self._buildQuery(filter);
          if (_cols && _cols.explicit.length) {
            query = query.select(..._cols.explicit);
          } else if (_cols && _cols.forceInclude.length) {
            query = query.select("*", ..._cols.forceInclude);
          }
          const row = await query.first();
          const doc = self._rowToDoc(row);
          resolve(
            q._populates?.length ? await self.populate(doc, q._populates) : doc,
          );
        } catch (e) {
          if (e && e.code === "22P02") {
            resolve(null);
            return;
          }
          reject ? reject(e) : resolve(Promise.reject(e));
        }
      },
    };
    return q;
  }

  find(filter = {}, options = {}) {
    const self = this;
    const state = {
      sort: options.sort,
      limit: options.limit,
      skip: options.skip,
      projections: options.projections,
    };
    const populates = [];
    const query = {
      sort(value) {
        state.sort = value;
        return query;
      },
      limit(value) {
        state.limit = value;
        return query;
      },
      skip(value) {
        state.skip = value;
        return query;
      },
      select(...cols) {
        state.projections = self._normalizeCols(cols).explicit;
        return query;
      },
      lean() {
        return query;
      },
      populate(path, select) {
        populates.push({ path, select });
        return query;
      },
      async exec() {
        try {
          let q = self._buildQuery(filter);
          const sortSpec = normalizeSort(state.sort);
          if (sortSpec) {
            for (const [k, v] of Object.entries(sortSpec)) {
              q = q.orderBy(
                self.fieldAliases[k] || self._camelToSnake(k),
                v === 1 || v === "asc" ? "asc" : "desc",
              );
            }
          }
          if (state.limit != null) q = q.limit(state.limit);
          if (state.skip != null) q = q.offset(state.skip);
          if (state.projections?.length) q = q.select(state.projections);
          const docs = self._docs(await q);
          return populates.length ? self.populate(docs, populates) : docs;
        } catch (e) {
          if (e && e.code === "22P02") return [];
          throw e;
        }
      },
      then(resolve, reject) {
        return query.exec().then(resolve, reject);
      },
    };
    return query;
  }

  async populate(input, specs) {
    if (!input) return input;
    const docs = Array.isArray(input) ? input : [input];
    const requests = Array.isArray(specs) ? specs : [specs];
    const tables = {
      user: "users",
      createdBy: "users",
      openedBy: "users",
      collaborators: "users",
      actorId: "users",
      agent: "agents",
      assignedTo: "agents",
      lockedBy: "agents",
      manager: "agents",
      company: "companies",
      dept: "departments",
      team: "teams",
      topic: "help_topics",
      sla: "sla_plans",
      ticket: "tickets",
      organization: "organizations",
      role: "roles",
      parent: "organization_units",
      instanceCompany: "instance_companies",
      organizationUnit: "organization_units",
      plan: "plans",
    };
    for (const request of requests) {
      const spec = typeof request === "string" ? { path: request } : request;
      const path = spec.path;
      const table = tables[path];
      if (!table) continue;
      const ids = [
        ...new Set(
          docs
            .flatMap((doc) => {
              const value =
                doc?.[path] ?? doc?.[`${this._camelToSnake(path)}_id`];
              return Array.isArray(value) ? value : [value];
            })
            .filter((value) => typeof value === "string"),
        ),
      ];
      if (!ids.length) continue;
      const rows = await this.db(table).whereIn("id", ids);
      const allowed =
        typeof spec.select === "string"
          ? spec.select.split(/\s+/).filter(Boolean)
          : null;
      const related = new Map(
        rows.map((row) => {
          const safe = allowed
            ? Object.fromEntries(
                Object.entries(row).filter(
                  ([key]) =>
                    key === "id" ||
                    allowed.includes(key) ||
                    allowed.includes(this._snakeToCamel(key)),
                ),
              )
            : Object.fromEntries(
                Object.entries(row).filter(
                  ([key]) =>
                    ![
                      "password",
                      "two_factor_secret",
                      "reset_token",
                      "confirmation_token",
                    ].includes(key),
                ),
              );
          return [row.id, this._rowToDoc(safe)];
        }),
      );
      for (const doc of docs) {
        const value = doc?.[path] ?? doc?.[`${this._camelToSnake(path)}_id`];
        if (Array.isArray(value))
          doc[path] = value.map((id) => related.get(id)).filter(Boolean);
        else if (typeof value === "string" && related.has(value))
          doc[path] = related.get(value);
      }
    }
    return input;
  }

  async findWithPopulate(filter = {}, populates = [], options = {}) {
    const docs = await this.find(filter, options);
    if (populates.length === 0) return docs;

    // Resolve populates — each populate is { path, model, select }
    for (const pop of populates) {
      const foreignTable = pop.model?.table || pop.path;
      const foreignKey = pop.foreignKey || `${pop.path}_id`;
      const ids = [...new Set(docs.map((d) => d[foreignKey]).filter(Boolean))];
      if (ids.length === 0) continue;

      let related = await this.db(foreignTable).whereIn("id", ids);
      if (pop.select && Array.isArray(pop.select)) {
        related = related.select(["id", ...pop.select]);
      }
      const map = new Map(related.map((r) => [r.id, r]));

      for (const doc of docs) {
        const ref = doc[foreignKey];
        if (ref) doc[pop.path] = this._rowToDoc(map.get(ref)) || ref;
      }
    }
    return docs;
  }

  async create(data) {
    if (Array.isArray(data)) return this.insertMany(data);
    let row = this._toRow(data);
    if (!row.id) row.id = this._generateId();
    const now = new Date().toISOString();
    row.created_at = row.created_at || now;
    row.updated_at = row.updated_at || now;
    if (this.hooks.preSave) row = (await this.hooks.preSave(row, false)) || row;
    const [result] = await this._scope(this._q()).insert(row).returning("*");
    return this._rowToDoc(result);
  }

  async insertMany(items) {
    if (!items.length) return [];
    let rows = items.map((d) => {
      const r = this._toRow(d);
      if (!r.id) r.id = this._generateId();
      return r;
    });
    const now = new Date().toISOString();
    rows.forEach((r) => {
      r.created_at = r.created_at || now;
      r.updated_at = r.updated_at || now;
    });
    if (this.hooks.preSave) {
      for (let i = 0; i < rows.length; i++)
        rows[i] = (await this.hooks.preSave(rows[i], false)) || rows[i];
    }
    const results = await this._scope(this._q()).insert(rows).returning("*");
    return this._docs(results);
  }

  async save(data) {
    const id = data.id || data._id || data[this.idColumn];
    if (id) {
      const existing = await this.findById(id);
      if (existing) return this.updateById(id, data);
    }
    return this.create(data);
  }

  async updateById(id, updates) {
    let row = this._toRow(updates);
    row.updated_at = new Date().toISOString();
    delete row.id;
    delete row.created_at;
    if (this.hooks.preSave) row = (await this.hooks.preSave(row, true)) || row;

    const [result] = await this._scope(this._q())
      .where(this.idColumn, id)
      .update(row)
      .returning("*");
    return this._rowToDoc(result);
  }

  async updateOne(filter, update) {
    let q = this._buildQuery(filter);
    const db = this.db;
    const updates = {};
    updates.updated_at = new Date().toISOString();

    // Handle $set operator
    if (update.$set) {
      Object.assign(updates, this._toRow(update.$set));
      delete updates.id;
    }

    // Handle $push operator (append to JSONB array)
    if (update.$push) {
      for (const [key, value] of Object.entries(update.$push)) {
        const col = this.fieldAliases[key] || this._camelToSnake(key);
        updates[col] = db.raw("COALESCE(??, '[]'::jsonb) || ?::jsonb", [
          col,
          JSON.stringify([value]),
        ]);
      }
    }

    if (this.hooks.preSave && update.$set) {
      const row = await this.hooks.preSave({ ...updates }, true);
      if (row) Object.assign(updates, row);
    }

    const [result] = await q.update(updates).returning("*");
    return {
      modifiedCount: result ? 1 : 0,
      result: result ? [this._rowToDoc(result)] : [],
    };
  }

  async updateMany(filter, update) {
    const q = this._buildQuery(filter);
    const row = this._toRow(update.$set || update);
    row.updated_at = new Date().toISOString();
    delete row.id;

    const count = await q.update(row);
    return { modifiedCount: count };
  }

  async findByIdAndUpdate(id, update, opts = {}) {
    const updateData = update.$set || update;
    if (opts.upsert) {
      const existing = await this.findById(id);
      if (existing) return this.updateById(id, updateData);
      return this.create({ ...updateData, id });
    }
    if (opts.new !== false) {
      return this.updateById(id, updateData);
    }
    await this.updateById(id, updateData);
    return this.findById(id);
  }

  async findOneAndUpdate(filter, update, opts = {}) {
    const inc = update.$inc || null;
    const set = update.$set || (inc ? {} : update);
    const setOnInsert = update.$setOnInsert || null;
    const existing = await this.findOne(filter);
    if (!existing) {
      if (opts.upsert)
        return this.create({ ...filter, ...(setOnInsert || {}), ...set, ...(inc || {}) });
      return null;
    }
    if (inc) {
      const increments = {};
      for (const [k, v] of Object.entries(inc)) {
        increments[this.fieldAliases[k] || this._camelToSnake(k)] = Number(v) || 1;
      }
      let q = this._scope(this._q())
        .where(this.idColumn, existing.id)
        .increment(increments);
      if (opts.new !== false) {
        const rows = await q.returning("*");
        return this._rowToDoc(rows[0]);
      }
      delete existing["save"];
      return existing;
    }
    // A $setOnInsert-only update is an upsert helper: there is nothing to apply
    // to the row that already exists.
    if (setOnInsert && !set) return existing;
    if (opts.new !== false) {
      return this.updateById(existing.id, set);
    }
    await this.updateById(existing.id, set);
    return existing;
  }

  async findOneAndDelete(filter) {
    const existing = await this.findOne(filter);
    if (!existing) return null;
    await this._scope(this._q()).where(this.idColumn, existing.id).del();
    return existing;
  }

  async findByIdAndDelete(id) {
    if (isInvalidUUIDForColumn(this.idColumn, id)) return null;
    const doc = await this.findById(id);
    if (!doc) return null;
    try {
      await this._scope(this._q()).where(this.idColumn, id).del();
    } catch (e) {
      if (e && e.code === "22P02") return null;
      throw e;
    }
    return doc;
  }

  async findByIdAndRemove(id) {
    return this.findByIdAndDelete(id);
  }

  async deleteOne(filter) {
    const q = this._buildQuery(filter);
    const count = await q.del();
    return { deletedCount: count };
  }

  async deleteMany(filter) {
    const q = this._buildQuery(filter);
    const count = await q.del();
    return { deletedCount: count };
  }

  async countDocuments(filter = {}) {
    const q = this._buildQuery(filter).count("* as count");
    const [{ count }] = await q;
    return parseInt(count, 10);
  }

  async distinct(field, filter = {}) {
    const column = this.fieldAliases[field] || this._camelToSnake(field);
    const rows = await this._buildQuery(filter).distinct(column);
    return rows.map((row) => row[column]);
  }

  async exists(filter) {
    const doc = await this.findOne(filter);
    return doc ? { _id: doc.id || doc._id } : null;
  }

  // ── Aggregation ─────────────────────────────────────────────────

  async aggregate(pipeline) {
    let q = this._scope(this._q());

    // Simple pipeline support for common patterns
    for (const stage of pipeline) {
      if (stage.$match) {
        for (const [k, v] of Object.entries(stage.$match)) {
          if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            if (v.$ne !== undefined) q = q.where(k, "!=", v.$ne);
            if (v.$in !== undefined) q = q.whereIn(k, v.$in);
            if (v.$gte !== undefined) q = q.where(k, ">=", v.$gte);
            if (v.$lte !== undefined) q = q.where(k, "<=", v.$lte);
          } else {
            q = q.where(k, v);
          }
        }
      }
      if (stage.$group) {
        // Basic group support
        const groupKey = Object.keys(stage.$group).find((k) => k !== "_id");
        if (groupKey) {
          q = q.select(
            stage.$group._id ? `${stage.$group._id} as _id` : "*",
            this.db.raw(
              `${stage.$group[groupKey].$sum ? "SUM" : "COUNT"}(?) as count`,
              [groupKey],
            ),
          );
        }
      }
      if (stage.$sort) {
        for (const [k, v] of Object.entries(stage.$sort)) {
          q = q.orderBy(k, v === 1 ? "asc" : "desc");
        }
      }
      if (stage.$limit) q = q.limit(stage.$limit);
      if (stage.$skip) q = q.offset(stage.$skip);
      if (stage.$unwind) {
        // Unsupported in pure SQL without lateral join — skip
      }
    }

    const rows = await q;
    return this._docs(rows);
  }

  // ── Utility ─────────────────────────────────────────────────────

  _generateId() {
    return crypto.randomUUID();
  }

  lean() {
    return this;
  }

  // Legacy `select()` for chaining
  select(...cols) {
    this._selectedColumns = cols.flat();
    return this;
  }
}

module.exports = PostgresRepository;
