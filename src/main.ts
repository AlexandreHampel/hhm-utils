import { MONGO_URI, DATABASE_NAME } from './config/env';
import { DatabaseClient } from './cleanup/database';
import { COLLECTIONS } from './cleanup/collections';
const PREFIX = 'QA-API';
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--dry-run', '--execute', '--confirm'].includes(arg))) throw new Error('Unknown argument');
  const execute = args.includes('--execute');
  if (execute && (!args.includes('--confirm') || args.includes('--dry-run'))) throw new Error('Use --execute --confirm to delete');
  if (!execute && args.includes('--confirm')) throw new Error('--confirm requires --execute');
  if (/prod/i.test(DATABASE_NAME)) throw new Error('Refusing to run on a production-named database');
  const db = await DatabaseClient.connect(MONGO_URI);
  try {
    const ids = await db.findTestPeople(PREFIX);
    console.log(`Mode: ${execute ? 'DELETE' : 'DRY RUN'}; test people: ${ids.length}; prefix: ${PREFIX}`);
    const report = [];
    for (const collection of Object.values(COLLECTIONS)) await db.purge(collection, ids, execute, report);
    await db.deletePeople(ids, execute, report);
    console.table(report);
  } finally { await db.close(); }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
