# HHM Utils

Standalone administrative utilities for **HHM (Hampel Hospital Management)**. The initial utility cleans MongoDB test data using a configurable **collection/dependency registry**, independently of the `hhm-test` Playwright repository.

## Requirements

- Node.js 20.12 or later
- npm
- Access to a **dedicated test MongoDB database**

## Installation

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

Configure `.env` with the **same variable names used by the HHM backend**:

```dotenv
PORT=
MONGO_HOST=
MONGO_PORT=
MONGO_DATABASE=HHM
MONGO_USER=
MONGO_PASSWORD=
```

`PORT` is retained for compatibility but is not used by this command-line utility. Supply both `MONGO_USER` and `MONGO_PASSWORD` when authentication is enabled; otherwise leave both blank. The MongoDB URI uses `authSource=MONGO_DATABASE`, so the user must be authenticated in that database.

**Do not commit `.env` or real credentials.**

## Commands

| Command | Behavior |
| --- | --- |
| `npm run cleanup` | Preview matches without deleting (default) |
| `npm run cleanup -- --dry-run` | Explicit preview without deleting |
| `npm run cleanup -- --execute --confirm` | Delete matching test data |
| `npm run typecheck` | Type-check the project |
| `npm run build` | Compile TypeScript |

`--execute` requires `--confirm`. `--confirm` alone and combining `--execute` with `--dry-run` are rejected. Unknown arguments are rejected.

## Cleanup strategy

The utility follows the original collection-based strategy from `hhm-test`:

1. Find documents in the `people` collection whose `name` **starts with `QA-API `** (including the trailing space).
2. Collect their MongoDB `_id` values.
3. For each entry in `COLLECTIONS`, find owned records using the configured `ownerFields`.
4. Recursively find and process dependent collections via their `foreignKey` fields, deleting **children before parents**.
5. Finally delete the matching people.
6. Print a per-collection report with `matched` and `deleted` counts.

Current registry (`src/cleanup/collections.ts`):

```ts
export const COLLECTIONS = {
  visits: {
    name: 'visits',
    ownerFields: ['patientId'],
    dependents: [
      { name: 'visit_movements', foreignKey: 'visitId' },
    ],
  },
} as const satisfies Record<string, CleanableCollection>;
```

This means the tool finds visits where `patientId` references a matching test person, deletes corresponding `visit_movements` by `visitId`, deletes the visits, and finally deletes the people.

To support another module, register its owning collection, owner field(s), and any dependent collections in `src/cleanup/collections.ts`. Do not add unverified collection or field names.

## Safety and limitations

- **Always preview first** with `--dry-run` and review the counts before running deletion.
- Use only an isolated test database. A database whose name contains `prod` is blocked, but this name check **does not guarantee** that a connection is safe.
- The `QA-API ` name prefix is the current test-data identification rule. Any legitimate person using that prefix could be deleted along with associated records.
- The tool does **not** identify data by `testRunId`, delete all documents in a collection, or clean unrelated data.
- The cleanup is **not transactional**. If a deletion fails partway through, some records may already have been deleted; review the report and rerun after fixing the issue.
- `dry-run` reports what matches at query time; concurrent changes can affect the subsequent execution.
- Only registered collections and their configured dependencies are covered. Verify relationships before extending the registry.

## Project structure

```text
hhm-utils/
├── src/
│   ├── config/
│   │   └── env.ts              # MongoDB connection settings
│   ├── cleanup/
│   │   ├── collections.ts      # Collection/dependency registry
│   │   └── database.ts         # MongoDB queries and deletion logic
│   └── main.ts                 # CLI entry point and report
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

The utility is intentionally independent of Express and Playwright: it runs directly from the terminal and connects to MongoDB using the backend-compatible environment settings.
