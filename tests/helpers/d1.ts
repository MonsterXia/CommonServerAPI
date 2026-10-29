import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';

// Real SQL and serialized transactions, with the D1 surface used by the app/Prisma.
export function createTestDatabase() {
    const sqlite = new DatabaseSync(':memory:');
    const directory = fileURLToPath(new NodeURL('../../migrations/', import.meta.url));
    for (const file of readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
        sqlite.exec(readFileSync(`${directory}/${file}`, 'utf8'));
    }
    function prepare(sql: string) {
        let args: SQLInputValue[] = [];
        const execute = () => {
            const statement = sqlite.prepare(sql);
            const results = statement.all(...args);
            const meta = sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get()!;
            return { success: true, results, meta };
        };
        return {
            bind(...values: SQLInputValue[]) { args = values; return this; },
            async first<T>() { return (sqlite.prepare(sql).get(...args) ?? null) as T | null; },
            async run() { return execute(); },
            async all() { return execute(); },
            async raw({ columnNames = false } = {}) {
                const statement = sqlite.prepare(sql);
                const names = statement.columns().map(c => c.name);
                const rows = statement.all(...args).map(row => names.map(name => row[name]));
                return columnNames ? [names, ...rows] : rows;
            },
            execute,
        };
    }
    const db = {
        prepare,
        async batch(statements: ReturnType<typeof prepare>[]) {
            sqlite.exec('BEGIN');
            try {
                // Do not yield between statements: another request cannot enter this transaction.
                const results = statements.map(statement => statement.execute());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
        },
    } as unknown as D1Database;
    return { sqlite, db };
}
