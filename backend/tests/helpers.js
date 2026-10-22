/**
 * Test bootstrap.
 *
 * Sets the environment before any module reads it, then stubs the Supabase
 * client so the suite runs offline with no database. The stub implements the
 * slice of the query-builder chain our controllers actually use.
 */
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-to-pass-validation';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.TELEGRAM_BOT_TOKEN = '123456:TESTBOTTOKEN';
process.env.TELEGRAM_BOT_USERNAME = 'bis_noc_test_bot';

const Module = require('module');
const path = require('path');

const supabasePath = path.join(__dirname, '..', 'config', 'supabase.js');

/**
 * Mutable table store: { tableName: [rows] }.
 *
 * `maxRows` mirrors Supabase's API cap (1000 rows per request by default):
 * a plain select silently returns at most that many rows, exactly like
 * production, so code that forgets to page is caught here.
 */
const SUPABASE_MAX_ROWS = 1000;
/**
 * `errors` makes one table behave like it is missing/broken — a fixed error
 * object, or a function ({mode}) => error|null for per-operation failures.
 * `overrides` replaces one operation's whole result, e.g. a lost race where
 * an UPDATE legitimately matches no rows: {'telegram_link_tokens:update': () => ({data: null, error: null})}.
 */
const db = { tables: {}, maxRows: SUPABASE_MAX_ROWS, errors: {}, overrides: {} };

const reset = (tables = {}, { maxRows = SUPABASE_MAX_ROWS, errors = {}, overrides = {} } = {}) => {
    db.tables = tables;
    db.maxRows = maxRows;
    db.errors = errors;
    db.overrides = overrides;
};

/** PostgREST's answer when a table is missing from its schema cache. */
const missingTableError = (table) => ({
    code: 'PGRST205',
    message: `Could not find the table 'public.${table}' in the schema cache`,
});

const rowsOf = (table) => (db.tables[table] ||= []);

const matches = (row, filters) =>
    filters.every(({ op, column, value }) => {
        const actual = row[column];
        switch (op) {
            // .not(column, op, value) — e.g. .not('class_id', 'is', null)
            case 'not': return !matches(row, [{ op: value.op, column, value: value.value }]);
            case 'eq': return String(actual) === String(value);
            case 'neq': return String(actual) !== String(value);
            case 'is': return value === null ? actual === null || actual === undefined : actual === value;
            case 'lt': return actual < value;
            case 'gt': return actual > value;
            case 'gte': return actual >= value;
            case 'lte': return actual <= value;
            case 'in': return value.includes(actual);
            case 'ilike': {
                // PostgREST ilike with no wildcards = case-insensitive equality.
                const pattern = String(value).replace(/%/g, '').toLowerCase();
                return String(actual).toLowerCase() === pattern;
            }
            default: return true;
        }
    });

/**
 * Parses PostgREST embed syntax out of a select string, e.g.
 *   "id, name, teacher:users(id, name), students(count)"
 * yielding [{ alias:'teacher', table:'users', fk:'teacher_id', count:false },
 *           { alias:'students', table:'students', fk:null, count:true }]
 *
 * Resolving these in the stub means tests assert on the same shapes the real
 * client returns, rather than on raw columns.
 */
const parseEmbeds = (select) => {
    if (!select || typeof select !== 'string') return [];

    const embeds = [];
    const re = /(?:(\w+):)?(\w+)(?:!(\w+))?\(([^()]*)\)/g;
    let match;

    while ((match = re.exec(select)) !== null) {
        const [, alias, table, fkHint, inner] = match;
        const name = alias || table;

        if (inner.trim() === 'count') {
            embeds.push({ alias: name, table, count: true });
            continue;
        }

        embeds.push({
            alias: name,
            table,
            // `alias:users!created_by(...)` names the FK explicitly; otherwise
            // the convention is <alias>_id.
            fk: fkHint || `${name}_id`,
            count: false,
        });
    }

    return embeds;
};

/** Attaches embedded relations to a row, mirroring PostgREST's response shape. */
const resolveEmbeds = (row, embeds, parentTable) => {
    if (embeds.length === 0) return row;

    const out = { ...row };

    for (const embed of embeds) {
        if (embed.count) {
            // Reverse relation count, e.g. classes -> students(count).
            const fk = `${parentTable.replace(/e?s$/, '')}_id`;
            const matches = rowsOf(embed.table).filter((r) => r[fk] === row.id);
            out[embed.alias] = [{ count: matches.length }];
            continue;
        }

        const fkValue = row[embed.fk];
        out[embed.alias] = fkValue
            ? rowsOf(embed.table).find((r) => r.id === fkValue) ?? null
            : null;
    }

    return out;
};

/** Minimal thenable query builder mirroring supabase-js semantics. */
function createQuery(table, { mode = 'select', payload = null, count = null } = {}) {
    const filters = [];
    let single = false;
    let maybe = false;
    let head = false;
    let selectString = null;
    let rangeFrom = null;
    let rangeTo = null;

    const builder = {
        select(cols, opts = {}) {
            if (typeof cols === 'string') selectString = cols;
            if (opts.count) count = opts.count;
            if (opts.head) head = true;
            return builder;
        },
        order() { return builder; },
        limit() { return builder; },
        range(from, to) { rangeFrom = from; rangeTo = to; return builder; },
        or() { return builder; },
        single() { single = true; return builder; },
        maybeSingle() { maybe = true; return builder; },
        then(resolve, reject) {
            return Promise.resolve(builder._run()).then(resolve, reject);
        },
        _run() {
            // Whole-operation override (e.g. a lost race: matched no rows).
            const override = db.overrides[`${table}:${mode}`];
            if (override) return override({ table, mode, payload, filters });

            // Simulated database failure (e.g. a migration that has not run),
            // either constant or per operation.
            const failure = db.errors[table];
            if (failure) {
                const error = typeof failure === 'function' ? failure({ mode }) : failure;
                if (error) return { data: null, error };
            }

            const all = rowsOf(table);
            let result;

            if (mode === 'insert') {
                const incoming = Array.isArray(payload) ? payload : [payload];
                const created = incoming.map((r) => ({
                    id: r.id || `generated-${all.length + 1}`,
                    ...r,
                }));
                all.push(...created);
                result = created;
            } else if (mode === 'update') {
                const target = all.filter((r) => matches(r, filters));
                target.forEach((r) => Object.assign(r, payload));
                result = target;
            } else if (mode === 'delete') {
                const target = all.filter((r) => matches(r, filters));
                db.tables[table] = all.filter((r) => !matches(r, filters));
                result = target;
            } else {
                result = all.filter((r) => matches(r, filters));
            }

            if (head) return { data: null, count: result.length, error: null };

            const embeds = parseEmbeds(selectString);
            const hydrate = (r) => resolveEmbeds(r, embeds, table);

            if (single) {
                return result.length
                    ? { data: hydrate(result[0]), error: null }
                    : { data: null, error: { code: 'PGRST116', message: 'No rows' } };
            }
            if (maybe) return { data: result[0] ? hydrate(result[0]) : null, error: null };

            // Like PostgREST: the count covers every match, the rows are the
            // requested range, capped at max_rows.
            const total = result.length;
            let page = result;
            if (mode === 'select') {
                if (rangeFrom !== null) page = page.slice(rangeFrom, rangeTo + 1);
                page = page.slice(0, db.maxRows);
            }
            return {
                data: page.map(hydrate),
                count: count ? total : undefined,
                error: null,
            };
        },
    };

    for (const op of ['eq', 'neq', 'is', 'lt', 'gt', 'gte', 'lte', 'in', 'ilike']) {
        builder[op] = (column, value) => {
            filters.push({ op, column, value });
            return builder;
        };
    }
    builder.not = (column, op, value) => {
        filters.push({ op: 'not', column, value: { op, value } });
        return builder;
    };

    return builder;
}

const supabaseStub = {
    from(table) {
        return {
            select: (cols, opts) => createQuery(table).select(cols, opts),
            insert: (payload) => createQuery(table, { mode: 'insert', payload }),
            update: (payload) => createQuery(table, { mode: 'update', payload }),
            upsert: (payload) => createQuery(table, { mode: 'insert', payload }),
            delete: () => createQuery(table, { mode: 'delete' }),
        };
    },
    rpc: async (name, args) => (supabaseStub._rpc[name] ? supabaseStub._rpc[name](args) : { data: null, error: null }),
    _rpc: {},
};

// Intercept require('../config/supabase') everywhere.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (parent && request.includes('config/supabase')) {
        const resolved = Module._resolveFilename(request, parent, isMain);
        if (resolved === supabasePath) return supabaseStub;
    }
    return originalLoad.apply(this, arguments);
};

module.exports = { reset, db, supabaseStub, rowsOf, missingTableError, SUPABASE_MAX_ROWS };
