/**
 * 高考试题分析与预测 API
 * POST /api/ai/predict
 * 
 * 基于 Get笔记知识库（历年高考真题）分析考点趋势，预测重点
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { getDatabase } from '../lib/db';
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

interface PredictBody {
    subject: string;
    topic?: string;
    analysisType?: 'hotspots' | 'trends' | 'prediction' | 'comprehensive';
}

const SUBJECT_NAMES: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    chinese: '语文',
    english: '英语',
    politics: '政治',
};

/**
 * 从知识库检索历年真题数据
 */
async function retrieveExamData(subject: string, topic?: string): Promise<string> {
    if (!GETNOTES_TOKEN) return '';

    const queries = [
        `${SUBJECT_NAMES[subject]}高考真题 ${topic || ''} 历年出题规律`,
        `${SUBJECT_NAMES[subject]}高考 ${topic || ''} 考点分析 命题趋势`,
        `${SUBJECT_NAMES[subject]}高考 ${topic || ''} 难度分布 题型变化`
    ];

    let allResults = '';

    for (const query of queries) {
        try {
            const response = await fetch(GETNOTES_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GETNOTES_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: query.trim(),
                    topic_ids: GETNOTES_TOPIC_IDS,
                    deep_seek: true,
                    top_k: 5,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                const content = result.answer || result.output || '';
                if (content) {
                    allResults += `\n\n【检索: ${query}】\n${content}`;
                }
            }
        } catch (error) {
            console.error('Knowledge retrieval failed:', error);
        }
    }

    return allResults;
}

/**
 * 获取用户学习进度（用于个性化建议）
 */
function getUserWeakPoints(userId: string, subject: string): string[] {
    try {
        const db = getDatabase();
        const weakTopics = db.prepare(`
      SELECT topic FROM study_progress
      WHERE user_id = ? AND subject = ? AND mastery_level < 60
      ORDER BY mastery_level ASC
      LIMIT 10
    `).all(userId, subject) as any[];

        return weakTopics.map(t => t.topic);
    } catch (error) {
        return [];
    }
}

/**
 * AI分析与预测
 */
async function analyzeAndPredict(
    subject: string,
    topic: string | undefined,
    examData: string,
    weakPoints: string[],
    analysisType: string
): Promise<any> {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

    const subjectName = SUBJECT_NAMES[subject] || subject;

    const weakPointsContext = weakPoints.length > 0
        ? `\n\n【学生薄弱知识点】\n${weakPoints.join('、')}`
        : '';

    const prompt = `你是一位资深的高考命题研究专家，精通${subjectName}学科的高考出题规律。

请基于以下从知识库检索到的历年高考真题和解析信息进行分析：

【知识库检索结果（历年高考真题数据）】
${examData || '暂无检索到的历史数据，请基于你对高考命题规律的专业知识进行分析。'}
${weakPointsContext}
${topic ? `\n【重点分析知识点】${topic}` : ''}

请输出以下内容（使用JSON格式）：

{
  "hotspots": {
    "top5": ["高频考点1", "高频考点2", "高频考点3", "高频考点4", "高频考点5"],
    "analysis": "高频考点详细分析（100字）"
  },
  "trends": {
    "summary": "近5年命题趋势总结（150字）",
    "changes": ["变化1: 具体说明", "变化2: 具体说明", "变化3: 具体说明"],
    "difficulty": "难度变化趋势说明"
  },
  "predictions": {
    "mustKnow": ["必考重点1", "必考重点2", "必考重点3"],
    "likelyTopics": ["可能出现的新题型或新考点1", "可能出现2"],
    "reasoning": "预测依据说明（100字）"
  },
  "studyPlan": {
    "priority": ["优先复习1", "优先复习2", "优先复习3"],
    "timeAllocation": "时间分配建议（针对冲刺阶段）",
    "strategies": ["策略1", "策略2", "策略3"],
    "commonMistakes": ["易错点1", "易错点2", "易错点3"]
  },
  "examTips": {
    "timeManagement": "考场时间分配建议",
    "answeringOrder": "答题顺序建议",
    "checkPoints": ["检查要点1", "检查要点2"]
  }
}

注意：
1. 分析必须基于真实的高考命题规律
2. 预测要有理有据，结合历年数据
3. 复习建议要具体可操作，适合冲刺阶段
4. 只输出JSON，不要有其他内容`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // 提取JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { error: '解析失败', rawResponse: text };
    } catch (error: any) {
        console.error('AI analysis failed:', error);
        throw error;
    }
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

        const { subject, topic, analysisType = 'comprehensive' } = req.body as PredictBody;

        if (!subject) {
            return sendError(res, 'INVALID_REQUEST', '请选择学科', 400);
        }

        // 从知识库检索历年真题数据
        const examData = await retrieveExamData(subject, topic);

        // 获取用户薄弱点
        const weakPoints = getUserWeakPoints(auth.userId, subject);

        // AI分析与预测
        const analysis = await analyzeAndPredict(
            subject,
            topic,
            examData,
            weakPoints,
            analysisType
        );

        return sendSuccess(res, {
            subject,
            subjectName: SUBJECT_NAMES[subject] || subject,
            topic: topic || '全部',
            analysis,
            hasKnowledgeData: !!examData,
            userWeakPoints: weakPoints,
            generatedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Predict API error:', error);

        if (error.message?.includes('API key')) {
            return sendPredefinedError(res, 'AI_ERROR', 'API Key 无效');
        }

        if (error.message?.includes('quota') || error.message?.includes('rate')) {
            return sendPredefinedError(res, 'AI_ERROR', '请求过于频繁，请稍后重试');
        }

        return sendPredefinedError(res, 'AI_ERROR');
    }
}

