import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const directory = fileURLToPath(new NodeURL('../../migrations/', import.meta.url));
const migration = readFileSync(`${directory}/0007_registration_and_email_integrity.sql`, 'utf8');
let db: DatabaseSync;
beforeEach(() => {
    db = new DatabaseSync(':memory:');
    for (const file of readdirSync(directory).filter(f => f.endsWith('.sql') && f < '0007').sort()) {
        db.exec(readFileSync(`${directory}/${file}`, 'utf8'));
    }
});
afterEach(() => db.close());
const addUser = (username: string, email: string | null) => db.prepare(
    "INSERT INTO User(username,email,password,updatedAt) VALUES (?,?,'synthetic-hash',CURRENT_TIMESTAMP)",
).run(username, email);

it('upgrades populated tables while preserving nullable user phones and required binding phones', () => {
    const user = addUser('existing-user', 'existing@example.com');
    db.prepare("INSERT INTO HypergryphAccount(phone,userId,token,updatedAt) VALUES ('13800000000',?,'synthetic-token',CURRENT_TIMESTAMP)")
        .run(user.lastInsertRowid);
    db.exec(migration);
    expect(db.prepare('SELECT email,phone FROM User').get()).toMatchObject({ email: 'existing@example.com', phone: null });
    expect(db.prepare('SELECT phone,userId FROM HypergryphAccount').get()).toMatchObject({ phone: '13800000000', userId: Number(user.lastInsertRowid) });
    expect(() => addUser('duplicate', 'existing@example.com')).toThrow(/UNIQUE/);
    addUser('no-email-one', null);
    const second = addUser('no-email-two', null);
    expect(() => db.prepare("INSERT INTO HypergryphAccount(phone,userId,token,updatedAt) VALUES (NULL,?,'synthetic-token',CURRENT_TIMESTAMP)")
        .run(second.lastInsertRowid)).toThrow(/NOT NULL/);
    expect(db.prepare('SELECT COUNT(*) AS count FROM User WHERE email IS NULL').get()?.count).toBe(2);
    expect(db.prepare('SELECT COUNT(*) AS count FROM RegistrationChallenge').get()?.count).toBe(0);
});

it('fails on historical duplicate email rows without discarding either account', () => {
    addUser('first', 'shared@example.com');
    addUser('second', 'shared@example.com');
    expect(() => db.exec(migration)).toThrow(/UNIQUE/);
    expect(db.prepare('SELECT username FROM User ORDER BY id').all()).toEqual([{ username: 'first' }, { username: 'second' }]);
});
