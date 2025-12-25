/**
 * 学习进度 API
 * GET /api/progress - 获取学习进度
 * POST /api/progress - 更新学习进度
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../lib/auth';
import { getDatabase, generateId } from '../lib/db';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

/**
 * 高考知识点体系 - 各学科核心考点
 */
const GAOKAO_TOPICS: Record<string, string[]> = {
    math: [
        '集合与常用逻辑用语', '函数的概念与性质', '基本初等函数', '函数与方程',
        '三角函数定义与图像', '三角恒等变换', '解三角形', '平面向量',
        '数列的概念', '等差数列', '等比数列', '数列求和',
        '不等式', '线性规划', '导数的概念', '导数的应用',
        '空间几何体', '点线面位置关系', '空间向量', '立体几何综合',
        '直线与圆', '椭圆', '双曲线', '抛物线', '圆锥曲线综合',
        '计数原理', '排列组合', '二项式定理', '概率', '统计',
        '复数', '参数方程与极坐标', '不等式选讲'
    ],
    physics: [
        '运动的描述', '匀变速直线运动', '相互作用', '牛顿运动定律',
        '曲线运动', '万有引力与航天', '机械能', '动量',
        '静电场', '电容器', '恒定电流', '磁场',
        '电磁感应', '交变电流', '传感器', '机械振动',
        '机械波', '光学', '原子物理', '热学'
    ],
    chemistry: [
        '物质的量', '离子反应', '氧化还原反应', '元素周期律',
        '化学键', '化学反应与能量', '化学反应速率', '化学平衡',
        '弱电解质的电离', '盐类的水解', '难溶电解质的溶解平衡', '电化学',
        '金属及其化合物', '非金属及其化合物', '有机化学基础', '有机合成',
        '化学实验基础', '物质的分离与提纯', '定量实验', '化学计算'
    ],
    chinese: [
        '现代文阅读-论述类', '现代文阅读-文学类', '现代文阅读-实用类',
        '文言文阅读', '古代诗歌鉴赏', '名篇名句默写',
        '语言文字运用-成语', '语言文字运用-病句', '语言文字运用-表达',
        '写作-议论文', '写作-记叙文', '写作-材料作文'
    ],
    english: [
        '阅读理解-细节题', '阅读理解-推断题', '阅读理解-主旨题', '阅读理解-词义题',
        '七选五', '完形填空', '语法填空', '短文改错', '书面表达',
        '定语从句', '名词性从句', '状语从句', '非谓语动词', '虚拟语气'
    ],
    politics: [
        '经济生活-市场经济', '经济生活-收入分配', '经济生活-发展社会主义市场经济',
        '政治生活-公民参与', '政治生活-政府职能', '政治生活-国际关系',
        '文化生活-文化作用', '文化生活-文化传承', '文化生活-中华文化',
        '哲学生活-唯物论', '哲学生活-认识论', '哲学生活-辩证法', '哲学生活-历史唯物主义'
    ]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 验证认证
    const auth = authenticateRequest(req);
    if (!auth) {
        return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const db = getDatabase();

    if (req.method === 'GET') {
        // 获取学习进度
        try {
            const { subject } = req.query;

            let query = `
        SELECT subject, topic, mastery_level, times_studied, times_correct, times_wrong, last_studied_at
        FROM study_progress
        WHERE user_id = ?
      `;
            const params: any[] = [auth.userId];

            if (subject && typeof subject === 'string') {
                query += ' AND subject = ?';
                params.push(subject);
            }

            query += ' ORDER BY subject, mastery_level ASC';

            const progress = db.prepare(query).all(...params) as any[];

            // 计算总体统计
            const stats = {
                totalTopics: 0,
                masteredTopics: 0,
                learningTopics: 0,
                notStartedTopics: 0,
                overallMastery: 0,
                bySubject: {} as Record<string, any>
            };

            // 按学科分组
            const bySubject: Record<string, any[]> = {};
            for (const p of progress) {
                if (!bySubject[p.subject]) {
                    bySubject[p.subject] = [];
                }
                bySubject[p.subject].push(p);
            }

            // 计算各学科统计
            for (const [subj, topics] of Object.entries(bySubject)) {
                const allTopics = GAOKAO_TOPICS[subj] || [];
                const studiedTopics = new Set(topics.map((t: any) => t.topic));

                const mastered = topics.filter((t: any) => t.mastery_level >= 80).length;
                const learning = topics.filter((t: any) => t.mastery_level > 0 && t.mastery_level < 80).length;
                const notStarted = allTopics.length - studiedTopics.size;

                const avgMastery = topics.length > 0
                    ? Math.round(topics.reduce((sum: number, t: any) => sum + t.mastery_level, 0) / topics.length)
                    : 0;

                stats.bySubject[subj] = {
                    totalTopics: allTopics.length,
                    masteredTopics: mastered,
                    learningTopics: learning,
                    notStartedTopics: notStarted,
                    avgMastery,
                    progress: topics,
                    allTopics
                };

                stats.totalTopics += allTopics.length;
                stats.masteredTopics += mastered;
                stats.learningTopics += learning;
                stats.notStartedTopics += notStarted;
            }

            // 添加未开始学习的学科
            for (const [subj, topics] of Object.entries(GAOKAO_TOPICS)) {
                if (!stats.bySubject[subj]) {
                    stats.bySubject[subj] = {
                        totalTopics: topics.length,
                        masteredTopics: 0,
                        learningTopics: 0,
                        notStartedTopics: topics.length,
                        avgMastery: 0,
                        progress: [],
                        allTopics: topics
                    };
                    stats.totalTopics += topics.length;
                    stats.notStartedTopics += topics.length;
                }
            }

            // 计算总体掌握度
            if (progress.length > 0) {
                stats.overallMastery = Math.round(
                    progress.reduce((sum, p) => sum + p.mastery_level, 0) / progress.length
                );
            }

            return sendSuccess(res, stats);

        } catch (error) {
            console.error('Get progress error:', error);
            return sendPredefinedError(res, 'INTERNAL_ERROR');
        }
    }

    if (req.method === 'POST') {
        // 更新学习进度
        try {
            const { subject, topic, masteryChange, notes } = req.body;

            if (!subject || !topic) {
                return sendError(res, 'INVALID_REQUEST', '请指定学科和知识点', 400);
            }

            const now = new Date().toISOString();

            // 检查是否存在
            const existing = db.prepare(`
        SELECT id, mastery_level, times_studied FROM study_progress
        WHERE user_id = ? AND subject = ? AND topic = ?
      `).get(auth.userId, subject, topic) as any;

            if (existing) {
                // 更新
                const newMastery = Math.max(0, Math.min(100, existing.mastery_level + (masteryChange || 0)));

                db.prepare(`
          UPDATE study_progress
          SET mastery_level = ?,
              times_studied = times_studied + 1,
              notes = COALESCE(?, notes),
              last_studied_at = ?,
              updated_at = ?
          WHERE id = ?
        `).run(newMastery, notes || null, now, now, existing.id);

                return sendSuccess(res, {
                    id: existing.id,
                    mastery_level: newMastery,
                    times_studied: existing.times_studied + 1
                });
            } else {
                // 新建
                const id = generateId();
                const initialMastery = Math.max(0, Math.min(100, masteryChange || 10));

                db.prepare(`
          INSERT INTO study_progress (id, user_id, subject, topic, mastery_level, times_studied, notes, last_studied_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(id, auth.userId, subject, topic, initialMastery, notes || '', now, now, now);

                return sendSuccess(res, {
                    id,
                    mastery_level: initialMastery,
                    times_studied: 1
                }, 201);
            }

        } catch (error) {
            console.error('Update progress error:', error);
            return sendPredefinedError(res, 'INTERNAL_ERROR');
        }
    }

    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
}

