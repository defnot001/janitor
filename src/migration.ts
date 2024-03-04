import { Client } from 'pg';
import { projectPaths } from './config';
import * as fs from 'fs/promises';
import * as path from 'path';

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

const migrationsDir = path.join(projectPaths.sources, 'database', 'migrations');

await pgClient.connect();

async function runMigration(filePath: string) {
  try {
    const query = await fs.readFile(filePath, { encoding: 'utf-8' });
    const split = query.split(';');

    for (const q of split) {
      if (q.trim() === '') continue;
      await pgClient.query(q);
    }

    console.log(`Migration executed: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`Error executing migration: ${path.basename(filePath)}`, err);
    throw err;
  }
}

async function executeMigrations() {
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith('.sql'));

    for (const sqlFile of sqlFiles) {
      const sqlFilePath = path.join(migrationsDir, sqlFile);
      await runMigration(sqlFilePath);
    }
  } catch (err) {
    console.error('Error reading migrations directory', err);
    throw err;
  }
}

await executeMigrations()
  .then(() => {
    console.log('All migrations executed successfully!');
    pgClient.end();
  })
  .catch((err) => {
    console.error('Error executing migrations', err);
    pgClient.end();
  });
