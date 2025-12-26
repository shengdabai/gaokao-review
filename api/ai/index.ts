/**
 * AI API（合并版）
 * POST /api/ai?action=analyze  - 图片分析
 * POST /api/ai?action=ask      - 文本问答
 * POST /api/ai?action=tutor    - AI 导师
 * POST /api/ai?action=predict  - 试题预测
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { getDatabase, generateId } from '../lib/db';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GETNOTES_URL = 'https://hook.us2.make.com/628uk9k37rq9v8cffmsw4u2ao7kel6l2';
const GETNOTES_TOKEN = process.env.GETNOTES_TOKEN || '';
const GETNOTES_TOPIC_IDS = ['K0BlyZmn', 'BJ888R8J'];
const TEXT_MODEL = 'gemini-2.5-flash-preview-05-20';
const IMAGE_MODEL = 'gemini-2.0-flash-exp';

const SUBJECT_NAMES: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学',
  chinese: '语文', english: '英语', politics: '政治',
};

// ============ 图片分析 ============
async function handleAnalyze(req: VercelRequest, res: VercelResponse) {
  const { image, subject } = req.body;
  if (!image) return sendError(res, 'INVALID_REQUEST', '请上传题目图片', 400);
  if (!image.startsWith('data:image/')) return sendError(res, 'INVALID_REQUEST', '图片格式无效', 400);

  const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) return sendError(res, 'INVALID_REQUEST', '图片数据格式错误', 400);

  const [, mimeType, base64Data] = matches;
  const subjectHint = subject && SUBJECT_NAMES[subject] ? `这可能是一道${SUBJECT_NAMES[subject]}题目。` : '';

  const prompt = `你是一位专业的高考辅导老师。${subjectHint}
请分析图片中的题目：
1. 【科目识别】识别学科
2. 【标签】核心知识点（逗号分隔）
3. 【题目内容】简要描述
4. 【详细解答】分步骤解答
5. 【通俗解释】用简单语言解释核心概念
6. 【提分技巧】应试技巧
使用 Markdown 格式。`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });
  const result = await model.generateContent([{ inlineData: { mimeType, data: base64Data } }, { text: prompt }]);
  const analysisText = result.response.text();

  if (!analysisText) return sendPredefinedError(res, 'AI_ERROR', '无法解析图片内容');

  const tagMatch = analysisText.match(/【标签】\s*(.+?)(?:\n|$)/);
  const tags = tagMatch ? tagMatch[1].split(/[,，、]/).map(t => t.trim()).filter(Boolean) : [];

  let detectedSubject = subject || 'unknown';
  const patterns: Record<string, RegExp> = {
    math: /数学|函数|几何|方程/, physics: /物理|力学|电磁/,
    chemistry: /化学|反应|元素/, chinese: /语文|文言文|古诗/,
    english: /英语|grammar/i, politics: /政治|哲学/,
  };
  for (const [subj, pattern] of Object.entries(patterns)) {
    if (pattern.test(analysisText)) { detectedSubject = subj; break; }
  }

  return sendSuccess(res, { analysis: analysisText, tags, subject: detectedSubject, confidence: tags.length > 0 ? 0.9 : 0.7 });
}

// ============ 文本问答 ============
async function handleAsk(req: VercelRequest, res: VercelResponse) {
  const { question, subject, context } = req.body;
  if (!question || question.trim().length === 0) return sendError(res, 'INVALID_REQUEST', '请输入问题', 400);
  if (question.length > 2000) return sendError(res, 'INVALID_REQUEST', '问题内容过长', 400);

  const subjectHint = subject && SUBJECT_NAMES[subject] ? `学生正在学习${SUBJECT_NAMES[subject]}。` : '';
  const contextHint = context ? `\n相关背景：${context}` : '';

  const prompt = `你是专业的高考辅导老师。${subjectHint}${contextHint}
学生的问题：${question}
请回答：1.核心概念 2.详细解答 3.举例说明 4.高考提示
使用 Markdown 格式。`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });
  const result = await model.generateContent(prompt);
  const answerText = result.response.text();

  if (!answerText) return sendPredefinedError(res, 'AI_ERROR', '生成回答失败');
  return sendSuccess(res, { answer: answerText, question, subject: subject || 'general' });
}

// ============ AI 导师 ============
async function handleTutor(req: VercelRequest, res: VercelResponse, userId: string) {
  const { sessionId, message, subject, topic, mode = 'learn' } = req.body;
  if (!message || message.trim().length === 0) return sendError(res, 'INVALID_REQUEST', '请输入消息', 400);
  if (!subject) return sendError(res, 'INVALID_REQUEST', '请选择学科', 400);

  const db = getDatabase();
  let session = { id: sessionId, isNew: false };

  if (sessionId) {
    const existing = await db.getTutorSession(sessionId, userId);
    if (!existing) session = { id: generateId(), isNew: true };
  } else {
    session = { id: generateId(), isNew: true };
  }

  if (session.isNew) {
    await db.createTutorSession(session.id, userId, subject, topic || null, mode);
  }

  await db.createTutorMessage(generateId(), session.id, 'user', message.trim(), 'chat');

  const history = await db.getTutorMessages(session.id, 10);
  const historyContext = history.length > 0 ? history.reverse().map(h => `${h.role === 'user' ? '学生' : 'AI'}: ${h.content}`).join('\n') : '';

  let knowledgeContext = '';
  if (GETNOTES_TOKEN) {
    try {
      const resp = await fetch(GETNOTES_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GETNOTES_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `${SUBJECT_NAMES[subject]} ${topic || message}`, topic_ids: GETNOTES_TOPIC_IDS, deep_seek: true }),
      });
      if (resp.ok) { const r = await resp.json(); knowledgeContext = r.answer || r.output || ''; }
    } catch (e) { console.error('Knowledge retrieval failed:', e); }
  }

  const prompt = `你是高考${SUBJECT_NAMES[subject] || subject}辅导老师，采用苏格拉底式教学法。
${topic ? `知识点：${topic}` : ''}
${historyContext ? `\n对话历史：\n${historyContext}` : ''}
${knowledgeContext ? `\n知识库参考：\n${knowledgeContext.substring(0, 1500)}` : ''}

学生消息：${message}

请用中文回复（约200字），结尾提出引导性问题。`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  if (!responseText) return sendPredefinedError(res, 'AI_ERROR', '生成回复失败');

  await db.createTutorMessage(generateId(), session.id, 'assistant', responseText, 'chat');

  return sendSuccess(res, { sessionId: session.id, isNewSession: session.isNew, response: responseText, subject, topic, mode, hasKnowledgeContext: !!knowledgeContext });
}

// ============ 试题预测 ============
async function handlePredict(req: VercelRequest, res: VercelResponse, userId: string) {
  const { subject, topic } = req.body;
  if (!subject) return sendError(res, 'INVALID_REQUEST', '请选择学科', 400);

  let examData = '';
  if (GETNOTES_TOKEN) {
    const queries = [`${SUBJECT_NAMES[subject]}高考真题 ${topic || ''} 出题规律`, `${SUBJECT_NAMES[subject]}高考 考点分析`];
    for (const q of queries) {
      try {
        const resp = await fetch(GETNOTES_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GETNOTES_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q.trim(), topic_ids: GETNOTES_TOPIC_IDS, deep_seek: true }),
        });
        if (resp.ok) { const r = await resp.json(); examData += (r.answer || r.output || '') + '\n'; }
      } catch (e) { console.error('Retrieval failed:', e); }
    }
  }

  const db = getDatabase();
  const weakPoints = await db.getWeakTopics(userId, subject, 10);

  const prompt = `你是高考命题研究专家。
【知识库数据】${examData || '无历史数据'}
${weakPoints.length > 0 ? `【学生薄弱点】${weakPoints.join('、')}` : ''}
${topic ? `【重点分析】${topic}` : ''}

请输出JSON格式分析：
{"hotspots":{"top5":["考点1","考点2","考点3","考点4","考点5"],"analysis":"分析"},"trends":{"summary":"趋势","changes":["变化1"],"difficulty":"难度"},"predictions":{"mustKnow":["重点1"],"likelyTopics":["新考点"],"reasoning":"依据"},"studyPlan":{"priority":["复习1"],"timeAllocation":"建议","strategies":["策略"],"commonMistakes":["易错点"]},"examTips":{"timeManagement":"时间","answeringOrder":"顺序","checkPoints":["检查点"]}}`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let analysis = {};
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) { try { analysis = JSON.parse(jsonMatch[0]); } catch (e) {} }

  return sendSuccess(res, { subject, subjectName: SUBJECT_NAMES[subject] || subject, topic: topic || '全部', analysis, hasKnowledgeData: !!examData, userWeakPoints: weakPoints, generatedAt: new Date().toISOString() });
}

// ============ 主处理函数 ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  if (!GEMINI_API_KEY) return sendPredefinedError(res, 'INTERNAL_ERROR', 'AI 服务未配置');

  try {
    const auth = authenticateRequest(req);
    if (!auth) return sendPredefinedError(res, 'UNAUTHORIZED');

    const action = req.query.action as string;

    switch (action) {
      case 'analyze': return await handleAnalyze(req, res);
      case 'ask': return await handleAsk(req, res);
      case 'tutor': return await handleTutor(req, res, auth.userId);
      case 'predict': return await handlePredict(req, res, auth.userId);
      default: return sendError(res, 'INVALID_REQUEST', '请指定 action: analyze/ask/tutor/predict', 400);
    }
  } catch (error: any) {
    console.error('AI API error:', error);
    if (error.message?.includes('API key')) return sendPredefinedError(res, 'AI_ERROR', 'API Key 无效');
    if (error.message?.includes('quota') || error.message?.includes('rate')) return sendPredefinedError(res, 'AI_ERROR', '请求过于频繁');
    return sendPredefinedError(res, 'AI_ERROR');
  }
}
