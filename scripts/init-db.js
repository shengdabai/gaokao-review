#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 运行: npm run db:init
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库目录
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'gaokao.db');

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ 创建 data 目录');
}

// 创建数据库连接
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('📦 初始化数据库...');

// 创建用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('  ✅ users 表');

// 创建错题表
db.exec(`
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
console.log('  ✅ mistakes 表');

// 创建搜索历史表
db.exec(`
  CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    subject TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
console.log('  ✅ search_history 表');

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
  CREATE INDEX IF NOT EXISTS idx_mistakes_subject ON mistakes(subject);
  CREATE INDEX IF NOT EXISTS idx_mistakes_created_at ON mistakes(created_at);
  CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
`);
console.log('  ✅ 索引');

// 关闭数据库
db.close();

console.log('');
console.log('🎉 数据库初始化完成!');
console.log(`   路径: ${dbPath}`);


