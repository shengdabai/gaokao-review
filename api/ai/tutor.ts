/**
 * AI 导师 API - 苏格拉底式教学
 * POST /api/ai/tutor
 * 
 * 参考 CFP-Study 项目的学习方法：
 * - 先询问学生已知内容
 * - 简洁解释（约200字）
 * - 验证理解的后续问题
 * - 根据回答调整教学风格
 * - 跟踪学习会话
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { getDatabase, generateId } from '../lib/db';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

// API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GETNOTES_URL = 'https://hook.us2.make.com/628uk9k37rq9v8cffmsw4u2ao7kel6l2';
const GETNOTES_TOKEN = process.env.GETNOTES_TOKEN || '';
// Get笔记知识库ID
// K0BlyZmn - 高考试题知识库
// BJ888R8J - 数学学习知识库
const GETNOTES_TOPIC_IDS = ['K0BlyZmn', 'BJ888R8J'];
const TEXT_MODEL = 'gemini-2.5-flash-preview-05-20';

/**
 * 请求体类型
 */
interface TutorBody {
    sessionId?: string;      // 会话ID，不传则创建新会话
    message: string;         // 用户消息
    subject: string;         // 学科
    topic?: string;          // 具体知识点（可选）
    mode?: 'learn' | 'review' | 'quiz';  // 学习模式
}

/**
 * 学科名称映射
 */
const SUBJECT_NAMES: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    chinese: '语文',
    english: '英语',
    politics: '政治',
};

/**
 * 从 Get笔记知识库检索相关内容
 */
async function retrieveFromKnowledge(query: string, subject: string): Promise<string> {
    if (!GETNOTES_TOKEN) return '';

    try {
        const searchQuery = `${SUBJECT_NAMES[subject] || subject} ${query} 高考知识点`;

        const response = await fetch(GETNOTES_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GETNOTES_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: searchQuery,
                topic_ids: GETNOTES_TOPIC_IDS,
                deep_seek: true,
                top_k: 5,
            }),
        });

        if (!response.ok) return '';

        const result = await response.json();
        return result.answer || result.output || '';
    } catch (error) {
        console.error('Knowledge retrieval failed:', error);
        return '';
    }
}

/**
 * 获取用户学习进度
 */
function getUserProgress(userId: string, subject: string): any[] {
    try {
        const db = getDatabase();
        return db.prepare(`
      SELECT topic, mastery_level, times_studied, times_correct, times_wrong, last_studied_at
      FROM study_progress
      WHERE user_id = ? AND subject = ?
      ORDER BY mastery_level ASC, last_studied_at ASC
    `).all(userId, subject) as any[];
    } catch (error) {
        console.error('Failed to get progress:', error);
        return [];
    }
}

/**
 * 获取会话历史
 */
function getSessionHistory(sessionId: string, limit: number = 10): any[] {
    try {
        const db = getDatabase();
        return db.prepare(`
      SELECT role, content, message_type, created_at
      FROM tutor_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(sessionId, limit) as any[];
    } catch (error) {
        console.error('Failed to get session history:', error);
        return [];
    }
}

/**
 * 保存消息到会话
 */
function saveMessage(sessionId: string, role: string, content: string, messageType: string = 'chat'): void {
    try {
        const db = getDatabase();
        db.prepare(`
      INSERT INTO tutor_messages (id, session_id, role, content, message_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateId(), sessionId, role, content, messageType, new Date().toISOString());
    } catch (error) {
        console.error('Failed to save message:', error);
    }
}

/**
 * 创建或获取会话
 */
function getOrCreateSession(
    userId: string,
    sessionId: string | undefined,
    subject: string,
    topic: string | undefined,
    mode: string
): { id: string; isNew: boolean } {
    const db = getDatabase();

    if (sessionId) {
        // 检查会话是否存在
        const existing = db.prepare(`
      SELECT id FROM tutor_sessions WHERE id = ? AND user_id = ?
    `).get(sessionId, userId);

        if (existing) {
            return { id: sessionId, isNew: false };
        }
    }

    // 创建新会话
    const newId = generateId();
    db.prepare(`
    INSERT INTO tutor_sessions (id, user_id, subject, topic, session_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(newId, userId, subject, topic || null, mode, new Date().toISOString(), new Date().toISOString());

    return { id: newId, isNew: true };
}

/**
 * 更新学习进度
 */
function updateProgress(
    userId: string,
    subject: string,
    topic: string,
    isCorrect: boolean
): void {
    try {
        const db = getDatabase();
        const now = new Date().toISOString();

        // 尝试更新现有记录
        const result = db.prepare(`
      UPDATE study_progress 
      SET times_studied = times_studied + 1,
          times_correct = times_correct + ?,
          times_wrong = times_wrong + ?,
          mastery_level = CASE 
            WHEN ? = 1 THEN MIN(mastery_level + 10, 100)
            ELSE MAX(mastery_level - 5, 0)
          END,
          last_studied_at = ?,
          updated_at = ?
      WHERE user_id = ? AND subject = ? AND topic = ?
    `).run(
            isCorrect ? 1 : 0,
            isCorrect ? 0 : 1,
            isCorrect ? 1 : 0,
            now, now, userId, subject, topic
        );

        // 如果没有更新到记录，则插入新记录
        if (result.changes === 0) {
            db.prepare(`
        INSERT INTO study_progress (id, user_id, subject, topic, mastery_level, times_studied, times_correct, times_wrong, last_studied_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
                generateId(), userId, subject, topic,
                isCorrect ? 10 : 0,
                isCorrect ? 1 : 0,
                isCorrect ? 0 : 1,
                now, now, now
            );
        }
    } catch (error) {
        console.error('Failed to update progress:', error);
    }
}

/**
 * 构建苏格拉底式教学 Prompt
 */
function buildSocraticPrompt(
    message: string,
    subject: string,
    topic: string | undefined,
    mode: string,
    history: any[],
    progress: any[],
    knowledgeContext: string
): string {
    const subjectName = SUBJECT_NAMES[subject] || subject;

    // 构建历史对话上下文
    const historyContext = history.length > 0
        ? '\n\n【之前的对话】\n' + history.reverse().map(h =>
            `${h.role === 'user' ? '学生' : 'AI导师'}: ${h.content}`
        ).join('\n')
        : '';

    // 构建学习进度上下文
    const progressContext = progress.length > 0
        ? '\n\n【学生学习进度】\n' + progress.slice(0, 5).map(p =>
            `- ${p.topic}: 掌握度${p.mastery_level}%, 学习${p.times_studied}次, 正确${p.times_correct}次`
        ).join('\n')
        : '';

    // 构建知识库上下文
    const knowledgeSection = knowledgeContext
        ? `\n\n【知识库参考（来自历年高考真题和解析）】\n${knowledgeContext.substring(0, 2000)}`
        : '';

    const modeInstructions = {
        learn: `
**学习模式指令：**
1. 首先询问学生对这个知识点已经了解多少
2. 基于学生的回答，从他们已知的内容开始讲解
3. 每次讲解控制在200字左右，简洁明了
4. 讲解后提出一个验证理解的问题
5. 根据学生回答调整下一步教学`,

        review: `
**复习模式指令：**
1. 根据学生的学习进度，重点复习掌握度低的知识点
2. 采用"提问-回答-纠正-强化"的方式
3. 对于薄弱点，提供记忆技巧和口诀
4. 结合历年高考真题进行针对性训练`,

        quiz: `
**测验模式指令：**
1. 根据知识点出一道高考风格的题目
2. 等待学生回答后再给出评价
3. 如果回答错误，引导学生自己发现问题
4. 记录学生的正确率，调整题目难度`
    };

    return `你是一位专业的高考${subjectName}辅导老师，采用苏格拉底式教学法。

**核心教学原则（参考 CFP-Study 方法）：**
- 对话式、无评判的学习环境
- 建立在学生已有知识基础上
- 先检查理解再继续教学
- 根据学生学习风格调整
- 注重深度理解，而非死记硬背
- 语言通俗易懂，适合基础薄弱的学生

${modeInstructions[mode as keyof typeof modeInstructions] || modeInstructions.learn}

${topic ? `**当前学习知识点：** ${topic}` : ''}
${historyContext}
${progressContext}
${knowledgeSection}

**学生的消息：** ${message}

请用中文回复，控制在200字左右。如果是新话题，先询问学生已知内容；如果是继续对话，根据学生回答给出针对性指导。每次回复结尾提出一个引导性问题。`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
    }

    if (!GEMINI_API_KEY) {
        return sendPredefinedError(res, 'INTERNAL_ERROR', 'AI 服务未配置');
    }

    try {
        // 验证认证
        const auth = authenticateRequest(req);
        if (!auth) {
            return sendPredefinedError(res, 'UNAUTHORIZED');
        }

        const { sessionId, message, subject, topic, mode = 'learn' } = req.body as TutorBody;

        // 验证参数
        if (!message || message.trim().length === 0) {
            return sendError(res, 'INVALID_REQUEST', '请输入消息', 400);
        }

        if (!subject) {
            return sendError(res, 'INVALID_REQUEST', '请选择学科', 400);
        }

        if (message.length > 2000) {
            return sendError(res, 'INVALID_REQUEST', '消息过长', 400);
        }

        // 获取或创建会话
        const session = getOrCreateSession(auth.userId, sessionId, subject, topic, mode);

        // 保存用户消息
        saveMessage(session.id, 'user', message.trim());

        // 获取会话历史
        const history = getSessionHistory(session.id, 10);

        // 获取用户学习进度
        const progress = getUserProgress(auth.userId, subject);

        // 从知识库检索相关内容
        const knowledgeContext = await retrieveFromKnowledge(
            topic || message,
            subject
        );

        // 构建 Prompt
        const prompt = buildSocraticPrompt(
            message.trim(),
            subject,
            topic,
            mode,
            history,
            progress,
            knowledgeContext
        );

        // 调用 AI
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (!responseText) {
            return sendPredefinedError(res, 'AI_ERROR', '生成回复失败');
        }

        // 保存 AI 回复
        saveMessage(session.id, 'assistant', responseText);

        // 如果检测到学生回答了问题，更新进度
        if (history.length > 0 && topic) {
            // 简单判断：如果 AI 回复中包含"正确"、"很好"等词，认为回答正确
            const isCorrect = responseText.includes('正确') ||
                responseText.includes('很好') ||
                responseText.includes('没错') ||
                responseText.includes('理解得很好');

            if (responseText.includes('错') || responseText.includes('不对') || isCorrect) {
                updateProgress(auth.userId, subject, topic, isCorrect);
            }
        }

        // 返回结果
        return sendSuccess(res, {
            sessionId: session.id,
            isNewSession: session.isNew,
            response: responseText,
            subject,
            topic,
            mode,
            hasKnowledgeContext: !!knowledgeContext,
        });

    } catch (error: any) {
        console.error('Tutor API error:', error);

        if (error.message?.includes('API key')) {
            return sendPredefinedError(res, 'AI_ERROR', 'API Key 无效');
        }

        if (error.message?.includes('quota') || error.message?.includes('rate')) {
            return sendPredefinedError(res, 'AI_ERROR', '请求过于频繁，请稍后重试');
        }

        return sendPredefinedError(res, 'AI_ERROR');
    }
}

