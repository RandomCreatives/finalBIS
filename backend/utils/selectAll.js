const supabase = require('../config/supabase');

/**
 * Read every row a query matches.
 *
 * Supabase's REST API returns at most `max_rows` rows per request (1000 by
 * default) and silently drops the rest — no error, no warning. Reports that
 * read raw rows (attendance above all: one row per pupil per school day) must
 * page past that cap, or they quietly stop updating once the data outgrows it.
 *
 * Pages are ordered so they never overlap, and the first page asks for an
 * exact count, so the loop stops as soon as everything is in — whatever cap
 * the project is configured with.
 *
 * @param {string} table
 * @param {string} columns PostgREST select string.
 * @param {(query) => query} [filter] Applies .eq/.in/... to each page's query.
 * @param {object} [options]
 * @param {Array<[string, boolean]>} [options.order] [column, ascending] pairs;
 *        the last should be unique (default: id ascending).
 * @param {number} [options.pageSize]
 * @returns {Promise<object[]>}
 */
const MAX_PAGES = 500;

async function selectAll(table, columns, filter = (query) => query, { order = [['id', true]], pageSize = 1000 } = {}) {
    const rows = [];
    let total = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        let query = supabase.from(table).select(columns, page === 0 ? { count: 'exact' } : {});
        query = filter(query);
        for (const [column, ascending] of order) query = query.order(column, { ascending });

        const { data, count, error } = await query.range(rows.length, rows.length + pageSize - 1);
        if (error) throw error;

        if (page === 0 && typeof count === 'number') total = count;
        const batch = data || [];
        rows.push(...batch);

        if (batch.length === 0) return rows;
        if (total !== null ? rows.length >= total : batch.length < pageSize) return rows;
    }

    throw new Error(`selectAll(${table}): more than ${MAX_PAGES} pages — narrow the query`);
}

module.exports = { selectAll };
