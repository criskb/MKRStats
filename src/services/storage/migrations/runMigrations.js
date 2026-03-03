import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadMigrationSql(engine) {
  const migrationDir = path.join(__dirname, engine);
  const files = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const chunks = await Promise.all(files.map((name) => readFile(path.join(migrationDir, name), 'utf8')));
  return chunks.join('\n\n');
}

export async function runSqliteMigrations(db) {
  const sql = await loadMigrationSql('sqlite');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      db.exec(`${statement};`);
    } catch (error) {
      if (String(error.message).includes('duplicate column name')) {
        continue;
      }
      throw error;
    }
  }
}

export async function runPostgresMigrations(pool) {
  const sql = await loadMigrationSql('postgres');
  await pool.query(sql);
}
