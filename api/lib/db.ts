/**
 * SQLite 数据库管理模块
 * 用于初始化数据库和提供数据库操作方法
 */

import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 数据库文件路径
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'gaokao.db');

// 创建数据库实例
let db: Database.Database | null = null;

/**
 * 获取数据库实例
 * @returns SQLite 数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
function initTables(): void {
  const database = db!;

  // 用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 错题表
  database.exec(`
    CREATE TABLE IF NOT EXISTS mistakes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      image_data TEXT NOT NULL,
      analysis TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 搜索历史表
  database.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      subject TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 学习进度表 - 跟踪每个知识点的掌握程度
  database.exec(`
    CREATE TABLE IF NOT EXISTS study_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      mastery_level INTEGER DEFAULT 0,
      times_studied INTEGER DEFAULT 0,
      times_correct INTEGER DEFAULT 0,
      times_wrong INTEGER DEFAULT 0,
      last_studied_at TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, subject, topic)
    )
  `);

  // AI导师对话历史表 - 记录苏格拉底式学习对话
  database.exec(`
    CREATE TABLE IF NOT EXISTS tutor_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT,
      session_type TEXT DEFAULT 'learn',
      status TEXT DEFAULT 'active',
      summary TEXT DEFAULT '',
      topics_covered TEXT DEFAULT '[]',
      knowledge_gaps TEXT DEFAULT '[]',
      mastered_concepts TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 对话消息表
  database.exec(`
    CREATE TABLE IF NOT EXISTS tutor_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'chat',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES tutor_sessions(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
    CREATE INDEX IF NOT EXISTS idx_mistakes_subject ON mistakes(subject);
    CREATE INDEX IF NOT EXISTS idx_mistakes_created_at ON mistakes(created_at);
    CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_study_progress_user_id ON study_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_study_progress_subject ON study_progress(subject);
    CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_id ON tutor_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tutor_messages_session_id ON tutor_messages(session_id);
  `);
}

/**
 * 生成 UUID
 * @returns 新的 UUID 字符串
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}


