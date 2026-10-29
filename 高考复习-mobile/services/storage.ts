/**
 * 本地存储服务 - SQLite 离线缓存
 */

import * as SQLite from 'expo-sqlite';

// Cache files belong to one account. The legacy gaokao_cache.db has no
// provable owner and must never be opened or migrated into a user's cache.
const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();

/**
 * 获取数据库实例
 */
export async function getDatabase(userId: string): Promise<SQLite.SQLiteDatabase> {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('本地缓存需要明确的用户 ID');
  }

  let database = databases.get(userId);
  if (!database) {
    database = (async () => {
      const db = await SQLite.openDatabaseAsync(`gaokao_cache_user-${encodeURIComponent(userId)}.db`);
      await initTables(db);
      return db;
    })();
    databases.set(userId, database);
  }

  try {
    return await database;
  } catch (error) {
    if (databases.get(userId) === database) databases.delete(userId);
    throw error;
  }
}

/**
 * 初始化数据库表
 */
async function initTables(db: SQLite.SQLiteDatabase): Promise<void> {
  // 错题缓存表
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS mistakes_cache (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      image_data TEXT NOT NULL,
      analysis TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    )
  `);

  // 同步状态表
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_status (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

/**
 * 保存错题到本地缓存
 */
export async function saveMistakeLocally(userId: string, mistake: {
  id: string;
  subject: string;
  imageUrl: string;
  analysis: string;
  tags: string[];
  createdAt: string;
  synced?: boolean;
}): Promise<void> {
  const database = await getDatabase(userId);
  
  await database.runAsync(
    `INSERT OR REPLACE INTO mistakes_cache (id, subject, image_data, analysis, tags, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      mistake.id,
      mistake.subject,
      mistake.imageUrl,
      mistake.analysis,
      JSON.stringify(mistake.tags),
      mistake.createdAt,
      mistake.synced ? 1 : 0,
    ]
  );
}

/**
 * 获取本地缓存的错题
 */
export async function getLocalMistakes(userId: string): Promise<any[]> {
  const database = await getDatabase(userId);
  
  const result = await database.getAllAsync(
    'SELECT * FROM mistakes_cache ORDER BY created_at DESC'
  );
  
  return result.map((row: any) => ({
    id: row.id,
    subject: row.subject,
    imageUrl: row.image_data,
    analysis: row.analysis,
    tags: JSON.parse(row.tags || '[]'),
    createdAt: row.created_at,
    synced: row.synced === 1,
  }));
}

/**
 * 获取未同步的错题
 */
export async function getUnsyncedMistakes(userId: string): Promise<any[]> {
  const database = await getDatabase(userId);
  
  const result = await database.getAllAsync(
    'SELECT * FROM mistakes_cache WHERE synced = 0'
  );
  
  return result.map((row: any) => ({
    id: row.id,
    subject: row.subject,
    imageUrl: row.image_data,
    analysis: row.analysis,
    tags: JSON.parse(row.tags || '[]'),
    createdAt: row.created_at,
  }));
}

/**
 * 标记错题为已同步
 */
export async function markMistakeSynced(userId: string, id: string): Promise<void> {
  const database = await getDatabase(userId);
  await database.runAsync(
    'UPDATE mistakes_cache SET synced = 1 WHERE id = ?',
    [id]
  );
}

/**
 * 删除本地错题
 */
export async function deleteLocalMistake(userId: string, id: string): Promise<void> {
  const database = await getDatabase(userId);
  await database.runAsync(
    'DELETE FROM mistakes_cache WHERE id = ?',
    [id]
  );
}

/**
 * 获取上次同步时间
 */
export async function getLastSyncTime(userId: string): Promise<string | null> {
  const database = await getDatabase(userId);
  const result = await database.getFirstAsync(
    "SELECT value FROM sync_status WHERE key = 'last_sync_time'"
  ) as { value: string } | null;
  
  return result?.value || null;
}

/**
 * 设置上次同步时间
 */
export async function setLastSyncTime(userId: string, time: string): Promise<void> {
  const database = await getDatabase(userId);
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_status (key, value) VALUES ('last_sync_time', ?)",
    [time]
  );
}

/**
 * 清空当前用户的本地数据
 */
export async function clearAllLocalData(userId: string): Promise<void> {
  const database = await getDatabase(userId);
  await database.execAsync('DELETE FROM mistakes_cache');
  await database.execAsync('DELETE FROM sync_status');
}

