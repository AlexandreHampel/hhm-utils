
import { MONGO_URI, DATABASE_NAME } from './config/env';
import { DatabaseClient } from './cleanup/database';
import { COLLECTIONS } from './cleanup/collections';

const PREFIXES = {
  api: 'QA-API',
  ui: 'QA-UI',
} as const;

type Scope = keyof typeof PREFIXES;

interface CleanupReport {
  collection: string;
  matched: number;
  deleted: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  const scopeArg = args.find(arg => arg.startsWith('--scope='));
  const scope = (scopeArg?.split('=')[1] ?? 'api') as Scope;

  if (!(scope in PREFIXES)) {
    throw new Error('Use --scope=api or --scope=ui');
  }

  const prefix = PREFIXES[scope];

  if (
    args.some(
      arg =>
        ![
          '--dry-run',
          '--execute',
          '--confirm',
          '--scope=api',
          '--scope=ui',
        ].includes(arg),
    )
  ) {
    throw new Error('Unknown argument');
  }

  if (
    execute &&
    (!args.includes('--confirm') || args.includes('--dry-run'))
  ) {
    throw new Error('Use --execute --confirm to delete');
  }

  if (!execute && args.includes('--confirm')) {
    throw new Error('--confirm requires --execute');
  }

  if (/prod/i.test(DATABASE_NAME)) {
    throw new Error(
      'Refusing to run on a production-named database',
    );
  }

  const db = await DatabaseClient.connect(MONGO_URI);

  try {
    const ids = await db.findTestPeople(prefix);
    const report: CleanupReport[] = [];

    console.log(
      `Mode: ${execute ? 'DELETE' : 'DRY RUN'}; ` +
      `test people: ${ids.length}; ` +
      `scope: ${scope}; prefix: ${prefix}`,
    );

    for (const collection of Object.values(COLLECTIONS)) {
      await db.purge(collection, ids, execute, report);
    }

    await db.deletePeople(ids, execute, report);

    console.table(report);
  } finally {
    await db.close();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
