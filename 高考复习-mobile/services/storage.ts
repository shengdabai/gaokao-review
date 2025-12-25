/**
 * 本地存储服务 - SQLite 离线缓存
 */

import * as SQLite from 'expo-sqlite';

// 数据库实例
let db: SQLite.SQLiteDatabase | null = null;

/**
 * 获取数据库实例
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gaokao_cache.db');
    await initTables();
  }
  return db;
}

/**
 * 初始化数据库表
 */
async function initTables(): Promise<void> {
  if (!db) return;

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
export async function saveMistakeLocally(mistake: {
  id: string;
  subject: string;
  imageUrl: string;
  analysis: string;
  tags: string[];
  createdAt: string;
  synced?: boolean;
}): Promise<void> {
  const database = await getDatabase();
  
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
export async function getLocalMistakes(): Promise<any[]> {
  const database = await getDatabase();
  
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
export async function getUnsyncedMistakes(): Promise<any[]> {
  const database = await getDatabase();
  
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
export async function markMistakeSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE mistakes_cache SET synced = 1 WHERE id = ?',
    [id]
  );
}

/**
 * 删除本地错题
 */
export async function deleteLocalMistake(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'DELETE FROM mistakes_cache WHERE id = ?',
    [id]
  );
}

/**
 * 获取上次同步时间
 */
export async function getLastSyncTime(): Promise<string | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync(
    "SELECT value FROM sync_status WHERE key = 'last_sync_time'"
  ) as { value: string } | null;
  
  return result?.value || null;
}

/**
 * 设置上次同步时间
 */
export async function setLastSyncTime(time: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_status (key, value) VALUES ('last_sync_time', ?)",
    [time]
  );
}

/**
 * 清空所有本地数据
 */
export async function clearAllLocalData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync('DELETE FROM mistakes_cache');
  await database.execAsync('DELETE FROM sync_status');
}

