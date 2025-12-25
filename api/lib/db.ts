/**
 * 内存数据库模块（Vercel Serverless 兼容版）
 * 注意：数据在函数冷启动时会重置，仅用于演示
 */

import { v4 as uuidv4 } from 'uuid';

// 内存存储
interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface Mistake {
  id: string;
  user_id: string;
  subject: string;
  image_data: string;
  analysis: string;
  tags: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  subject: string | null;
  created_at: string;
}

interface StudyProgress {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  mastery_level: number;
  times_studied: number;
  times_correct: number;
  times_wrong: number;
  last_studied_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface TutorSession {
  id: string;
  user_id: string;
  subject: string;
  topic: string | null;
  session_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TutorMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  message_type: string;
  created_at: string;
}

// 全局内存存储
const store = {
  users: new Map<string, User>(),
  mistakes: new Map<string, Mistake>(),
  searchHistory: new Map<string, SearchHistory>(),
  studyProgress: new Map<string, StudyProgress>(),
  tutorSessions: new Map<string, TutorSession>(),
  tutorMessages: new Map<string, TutorMessage>(),
};

// 模拟 better-sqlite3 的 API
class MemoryStatement {
  private sql: string;

  constructor(sql: string) {
    this.sql = sql;
  }

  run(...params: any[]): { changes: number } {
    const sql = this.sql.toLowerCase();

    if (sql.includes('insert into users')) {
      const [id, username, password_hash, created_at, updated_at] = params;
      store.users.set(id, { id, username, password_hash, created_at, updated_at });
      return { changes: 1 };
    }

    if (sql.includes('insert into mistakes')) {
      const [id, user_id, subject, image_data, analysis, tags, created_at, updated_at] = params;
      store.mistakes.set(id, { id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status: 'synced' });
      return { changes: 1 };
    }

    if (sql.includes('insert into search_history')) {
      const [id, user_id, query, subject, created_at] = params;
      store.searchHistory.set(id, { id, user_id, query, subject, created_at });
      return { changes: 1 };
    }

    if (sql.includes('insert into study_progress')) {
      const [id, user_id, subject, topic, mastery_level, times_studied, times_correct, times_wrong, last_studied_at, created_at, updated_at] = params;
      store.studyProgress.set(id, { id, user_id, subject, topic, mastery_level, times_studied, times_correct, times_wrong, last_studied_at, notes: '', created_at, updated_at });
      return { changes: 1 };
    }

    if (sql.includes('insert into tutor_sessions')) {
      const [id, user_id, subject, topic, session_type, status, created_at, updated_at] = params;
      store.tutorSessions.set(id, { id, user_id, subject, topic, session_type, status, created_at, updated_at });
      return { changes: 1 };
    }

    if (sql.includes('insert into tutor_messages')) {
      const [id, session_id, role, content, message_type, created_at] = params;
      store.tutorMessages.set(id, { id, session_id, role, content, message_type, created_at });
      return { changes: 1 };
    }

    if (sql.includes('delete from mistakes')) {
      const [id] = params;
      store.mistakes.delete(id);
      return { changes: 1 };
    }

    if (sql.includes('delete from search_history')) {
      const [user_id] = params;
      for (const [id, h] of store.searchHistory) {
        if (h.user_id === user_id) store.searchHistory.delete(id);
      }
      return { changes: 1 };
    }

    if (sql.includes('update study_progress')) {
      // 简化处理
      return { changes: 0 };
    }

    if (sql.includes('update mistakes')) {
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  get(...params: any[]): any {
    const sql = this.sql.toLowerCase();

    if (sql.includes('from users where username')) {
      const [username] = params;
      for (const user of store.users.values()) {
        if (user.username === username) return user;
      }
      return undefined;
    }

    if (sql.includes('from users where id')) {
      const [id] = params;
      return store.users.get(id);
    }

    if (sql.includes('count(*) as total from mistakes')) {
      const [user_id] = params;
      let total = 0, math = 0, physics = 0, chemistry = 0, chinese = 0, english = 0, politics = 0;
      for (const m of store.mistakes.values()) {
        if (m.user_id === user_id) {
          total++;
          if (m.subject === 'math') math++;
          if (m.subject === 'physics') physics++;
          if (m.subject === 'chemistry') chemistry++;
          if (m.subject === 'chinese') chinese++;
          if (m.subject === 'english') english++;
          if (m.subject === 'politics') politics++;
        }
      }
      return { total, math, physics, chemistry, chinese, english, politics };
    }

    if (sql.includes('from mistakes where id')) {
      const [id, user_id] = params;
      const m = store.mistakes.get(id);
      if (m && m.user_id === user_id) return m;
      return undefined;
    }

    if (sql.includes('from tutor_sessions where id')) {
      const [id, user_id] = params;
      const s = store.tutorSessions.get(id);
      if (s && s.user_id === user_id) return s;
      return undefined;
    }

    if (sql.includes('from study_progress where user_id') && sql.includes('and subject') && sql.includes('and topic')) {
      return undefined; // 简化
    }

    return undefined;
  }

  all(...params: any[]): any[] {
    const sql = this.sql.toLowerCase();

    if (sql.includes('from mistakes') && sql.includes('where user_id')) {
      const [user_id] = params;
      const results: Mistake[] = [];
      for (const m of store.mistakes.values()) {
        if (m.user_id === user_id) results.push(m);
      }
      return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    if (sql.includes('from search_history')) {
      const [user_id] = params;
      const results: SearchHistory[] = [];
      for (const h of store.searchHistory.values()) {
        if (h.user_id === user_id) results.push(h);
      }
      return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    if (sql.includes('from study_progress')) {
      const [user_id] = params;
      const results: StudyProgress[] = [];
      for (const p of store.studyProgress.values()) {
        if (p.user_id === user_id) results.push(p);
      }
      return results;
    }

    if (sql.includes('from tutor_messages')) {
      const [session_id] = params;
      const results: TutorMessage[] = [];
      for (const m of store.tutorMessages.values()) {
        if (m.session_id === session_id) results.push(m);
      }
      return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    return [];
  }
}

class MemoryDatabase {
  prepare(sql: string): MemoryStatement {
    return new MemoryStatement(sql);
  }

  exec(_sql: string): void {
    // 表创建在内存中自动处理
  }

  pragma(_pragma: string): void {
    // 忽略
  }

  close(): void {
    // 忽略
  }
}

let db: MemoryDatabase | null = null;

export function getDatabase(): MemoryDatabase {
  if (!db) {
    db = new MemoryDatabase();
  }
  return db;
}

export function generateId(): string {
  return uuidv4();
}

export function closeDatabase(): void {
  db = null;
}
