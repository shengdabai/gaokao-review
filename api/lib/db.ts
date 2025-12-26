/**
 * PostgreSQL 数据库模块
 * 使用 pg 库连接 Vercel Postgres / Prisma Postgres
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// 创建连接池
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// 标记是否已初始化表
let tablesInitialized = false;

/**
 * 执行 SQL 查询
 */
async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * 初始化数据库表
 */
async function initTables(): Promise<void> {
  if (tablesInitialized) return;

  try {
    // 用户表
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 错题表
    await query(`
      CREATE TABLE IF NOT EXISTS mistakes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        image_data TEXT NOT NULL,
        analysis TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'synced'
      )
    `);

    // 搜索历史表
    await query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        subject TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 学习进度表
    await query(`
      CREATE TABLE IF NOT EXISTS study_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        mastery_level INTEGER DEFAULT 0,
        times_studied INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        times_wrong INTEGER DEFAULT 0,
        last_studied_at TIMESTAMP,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, subject, topic)
      )
    `);

    // AI导师会话表
    await query(`
      CREATE TABLE IF NOT EXISTS tutor_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT,
        session_type TEXT DEFAULT 'learn',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 对话消息表
    await query(`
      CREATE TABLE IF NOT EXISTS tutor_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引（忽略已存在的错误）
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_mistakes_subject ON mistakes(subject)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_study_progress_user_id ON study_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_id ON tutor_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_tutor_messages_session_id ON tutor_messages(session_id)',
    ];

    for (const sql of indexes) {
      try {
        await query(sql);
      } catch (e) {
        // 忽略索引创建错误
      }
    }

    tablesInitialized = true;
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Failed to initialize tables:', error);
    throw error;
  }
}

/**
 * 数据库操作类 - 提供统一的数据库访问接口
 */
class Database {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initTables();
      this.initialized = true;
    }
  }

  // ============ 用户相关 ============

  async getUserByUsername(username: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async getUserById(id: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createUser(id: string, username: string, passwordHash: string): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await query(
      'INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [id, username, passwordHash, now, now]
    );
  }

  // ============ 错题相关 ============

  async getMistakes(userId: string, subject?: string, limit = 20, offset = 0): Promise<any[]> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query(
        'SELECT * FROM mistakes WHERE user_id = $1 AND subject = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
        [userId, subject, limit, offset]
      );
      return result.rows;
    }
    const result = await query(
      'SELECT * FROM mistakes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getMistakeById(id: string, userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM mistakes WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0];
  }

  async getMistakesCount(userId: string, subject?: string): Promise<number> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query('SELECT COUNT(*) as count FROM mistakes WHERE user_id = $1 AND subject = $2', [userId, subject]);
      return parseInt(result.rows[0].count);
    }
    const result = await query('SELECT COUNT(*) as count FROM mistakes WHERE user_id = $1', [userId]);
    return parseInt(result.rows[0].count);
  }

  async getMistakesStats(userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN subject = 'math' THEN 1 END) as math,
        COUNT(CASE WHEN subject = 'physics' THEN 1 END) as physics,
        COUNT(CASE WHEN subject = 'chemistry' THEN 1 END) as chemistry,
        COUNT(CASE WHEN subject = 'chinese' THEN 1 END) as chinese,
        COUNT(CASE WHEN subject = 'english' THEN 1 END) as english,
        COUNT(CASE WHEN subject = 'politics' THEN 1 END) as politics
      FROM mistakes WHERE user_id = $1
    `, [userId]);
    return result.rows[0];
  }

  async createMistake(id: string, userId: string, subject: string, imageData: string, analysis: string, tags: string): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await query(
      'INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, userId, subject, imageData, analysis, tags, now, now]
    );
  }

  async deleteMistake(id: string): Promise<void> {
    await this.ensureInitialized();
    await query('DELETE FROM mistakes WHERE id = $1', [id]);
  }

  // ============ 搜索历史 ============

  async getSearchHistory(userId: string, limit = 20): Promise<any[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  async createSearchHistory(id: string, userId: string, queryText: string, subject: string | null): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await query(
      'INSERT INTO search_history (id, user_id, query, subject, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, userId, queryText, subject, now]
    );
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await this.ensureInitialized();
    await query('DELETE FROM search_history WHERE user_id = $1', [userId]);
  }

  // ============ 学习进度 ============

  async getStudyProgress(userId: string, subject?: string): Promise<any[]> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query(
        'SELECT * FROM study_progress WHERE user_id = $1 AND subject = $2 ORDER BY mastery_level ASC',
        [userId, subject]
      );
      return result.rows;
    }
    const result = await query(
      'SELECT * FROM study_progress WHERE user_id = $1 ORDER BY mastery_level ASC',
      [userId]
    );
    return result.rows;
  }

  async getWeakTopics(userId: string, subject: string, limit = 10): Promise<string[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT topic FROM study_progress WHERE user_id = $1 AND subject = $2 AND mastery_level < 60 ORDER BY mastery_level ASC LIMIT $3',
      [userId, subject, limit]
    );
    return result.rows.map((r: any) => r.topic);
  }

  // ============ AI导师会话 ============

  async getTutorSession(sessionId: string, userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM tutor_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    return result.rows[0];
  }

  async createTutorSession(id: string, userId: string, subject: string, topic: string | null, sessionType: string): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO tutor_sessions (id, user_id, subject, topic, session_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)`,
      [id, userId, subject, topic, sessionType, now, now]
    );
  }

  async getTutorMessages(sessionId: string, limit = 10): Promise<any[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM tutor_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2',
      [sessionId, limit]
    );
    return result.rows;
  }

  async createTutorMessage(id: string, sessionId: string, role: string, content: string, messageType: string): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await query(
      'INSERT INTO tutor_messages (id, session_id, role, content, message_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, sessionId, role, content, messageType, now]
    );
  }
}

// 单例数据库实例
const db = new Database();

/**
 * 获取数据库实例
 */
export function getDatabase(): Database {
  return db;
}

/**
 * 生成 UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}
