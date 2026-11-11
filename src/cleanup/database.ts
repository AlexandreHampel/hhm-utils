import { Db, MongoClient, ObjectId, type Filter, type Document } from 'mongodb';

export interface DependentCollection { name: string; foreignKey: string; dependents?: readonly DependentCollection[] }
export interface CleanableCollection { name: string; ownerFields: readonly string[]; dependents?: readonly DependentCollection[] }
export interface DeletionCount { collection: string; matched: number; deleted: number }

export class DatabaseClient {
  private constructor(private readonly client: MongoClient, private readonly db: Db) { }

  static async connect(uri: string): Promise<DatabaseClient> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    return new DatabaseClient(client, client.db());
  }

  async close(): Promise<void> { await this.client.close(); }

  async findTestPeople(prefix: string): Promise<ObjectId[]> {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await this.db.collection('people').find({ name: { $regex: `^${escaped} ` } }, { projection: { _id: 1 } }).toArray();
    return rows.map(row => row._id as ObjectId);
  }

  async purge(collection: CleanableCollection, ownerIds: readonly ObjectId[], execute: boolean, report: DeletionCount[]): Promise<void> {
    const filter: Filter<Document> = { $or: collection.ownerFields.map(field => ({ [field]: { $in: ownerIds } })) };
    const ids = await this.findIds(collection.name, filter);
    await this.deleteTree(collection.name, collection.dependents ?? [], ids, execute, report);
  }

  async deletePeople(ids: readonly ObjectId[], execute: boolean, report: DeletionCount[]): Promise<void> {
    await this.deleteTree('people', [], ids, execute, report);
  }

  private async findIds(name: string, filter: Filter<Document>): Promise<ObjectId[]> {
    const rows = await this.db.collection(name).find(filter, { projection: { _id: 1 } }).toArray();
    return rows.map(row => row._id as ObjectId);
  }

  private async deleteTree(name: string, children: readonly DependentCollection[], ids: readonly ObjectId[], execute: boolean, report: DeletionCount[]): Promise<void> {
    if (!ids.length) { report.push({ collection: name, matched: 0, deleted: 0 }); return; }
    for (const child of children) {
      const childIds = await this.findIds(child.name, { [child.foreignKey]: { $in: ids } });
      await this.deleteTree(child.name, child.dependents ?? [], childIds, execute, report);
    }
    const deleted = execute ? (await this.db.collection(name).deleteMany({ _id: { $in: ids } })).deletedCount : 0;
    report.push({ collection: name, matched: ids.length, deleted });
  }
}
