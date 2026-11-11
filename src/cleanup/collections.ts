import type { CleanableCollection } from './database';
/** Register collections and their dependent collections here. */
export const COLLECTIONS = {
  visits: {
    name: 'visits',
    ownerFields: ['patientId'],
    dependents: [{ name: 'visit_movements', foreignKey: 'visitId' }],
  },
} as const satisfies Record<string, CleanableCollection>;
