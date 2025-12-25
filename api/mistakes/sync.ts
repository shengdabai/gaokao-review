/**
 * 错题本同步 API
 * POST /api/mistakes/sync
 * 
 * 用于 Web 和 Android 之间同步错题数据
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

/**
 * 同步请求体类型
 */
interface SyncBody {
  lastSyncTime?: string;  // ISO 8601 格式
  localMistakes?: LocalMistake[];  // 本地待同步的错题
}

/**
 * 本地错题类型
 */
interface LocalMistake {
  id: string;
  subject: string;
  imageUrl: string;
  analysis: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

/**
 * 错题数据库记录类型
 */
interface MistakeRecord {
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

/**
 * 有效学科列表
 */
const VALID_SUBJECTS = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  // 验证用户认证
  const auth = authenticateRequest(req);
  if (!auth) {
    return sendPredefinedError(res, 'UNAUTHORIZED');
  }

  try {
    const { lastSyncTime, localMistakes = [] } = req.body as SyncBody;
    const db = getDatabase();
    const now = new Date().toISOString();

    // 处理本地待同步的错题
    const syncResults: { id: string; status: 'created' | 'updated' | 'conflict' }[] = [];

    for (const local of localMistakes) {
      if (!local.id || !VALID_SUBJECTS.includes(local.subject)) {
        continue;
      }

      // 检查服务器上是否已存在
      const existing = db
        .prepare('SELECT id, updated_at FROM mistakes WHERE id = ? AND user_id = ?')
        .get(local.id, auth.userId) as { id: string; updated_at: string } | undefined;

      if (existing) {
        // 已存在，检查是否需要更新
        const serverTime = new Date(existing.updated_at).getTime();
        const localTime = new Date(local.updatedAt).getTime();

        if (localTime > serverTime) {
          // 本地更新，覆盖服务器
          db.prepare(`
            UPDATE mistakes
            SET subject = ?, image_data = ?, analysis = ?, tags = ?, updated_at = ?, sync_status = 'synced'
            WHERE id = ? AND user_id = ?
          `).run(
            local.subject,
            local.imageUrl,
            local.analysis,
            JSON.stringify(local.tags || []),
            now,
            local.id,
            auth.userId
          );
          syncResults.push({ id: local.id, status: 'updated' });
        } else if (localTime < serverTime) {
          // 服务器更新，标记冲突（客户端应获取服务器版本）
          syncResults.push({ id: local.id, status: 'conflict' });
        }
        // 时间相同，跳过
      } else {
        // 不存在，创建新记录
        db.prepare(`
          INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        `).run(
          local.id,
          auth.userId,
          local.subject,
          local.imageUrl,
          local.analysis,
          JSON.stringify(local.tags || []),
          local.createdAt || now,
          now
        );
        syncResults.push({ id: local.id, status: 'created' });
      }
    }

    // 获取服务器上自 lastSyncTime 以来更新的错题
    let serverMistakes: MistakeRecord[] = [];
    
    if (lastSyncTime) {
      serverMistakes = db
        .prepare(`
          SELECT id, subject, image_data, analysis, tags, created_at, updated_at, sync_status
          FROM mistakes
          WHERE user_id = ? AND updated_at > ?
          ORDER BY updated_at DESC
        `)
        .all(auth.userId, lastSyncTime) as MistakeRecord[];
    } else {
      // 首次同步，获取所有错题
      serverMistakes = db
        .prepare(`
          SELECT id, subject, image_data, analysis, tags, created_at, updated_at, sync_status
          FROM mistakes
          WHERE user_id = ?
          ORDER BY updated_at DESC
        `)
        .all(auth.userId) as MistakeRecord[];
    }

    return sendSuccess(res, {
      syncTime: now,
      syncResults,
      serverMistakes: serverMistakes.map(m => ({
        id: m.id,
        subject: m.subject,
        imageUrl: m.image_data,
        analysis: m.analysis,
        tags: JSON.parse(m.tags || '[]'),
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        syncStatus: m.sync_status,
      })),
    });

  } catch (error) {
    console.error('Sync error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}


