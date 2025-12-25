/**
 * 高考试题分析与预测组件
 * 基于历年真题分析考点趋势，预测复习重点
 */

import React, { useState } from 'react';
import {
    TrendingUp, Target, Lightbulb, BookOpen, Loader2,
    Flame, BarChart3, Clock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import * as api from '../services/api';

interface Props {
    subject: { id: string; name: string; icon: string };
    onLogout: () => void;
}

export const PredictAnalysis: React.FC<Props> = ({ subject, onLogout }) => {
    const [topic, setTopic] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<api.PredictResult | null>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError('');
        setResult(null);

        try {
            const data = await api.predictExam(subject.id, topic || undefined);
            setResult(data);
        } catch (err: any) {
            if (err.code === 'UNAUTHORIZED') {
                onLogout();
            } else {
                setError(err.message || '分析失败，请重试');
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 输入区域 */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    {subject.icon} {subject.name} · 高考试题分析与预测
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    基于你上传到 Get笔记 的历年高考真题，AI 将分析出题规律并预测今年重点
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-600 mb-2 block">
                            指定分析的知识点（可选，留空则分析全部）
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={`例如：三角函数、动能定理、氧化还原反应...`}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${isAnalyzing
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-[0.98]'
                            }`}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                AI 正在深度分析历年真题...
                            </>
                        ) : (
                            <>
                                <Target className="w-5 h-5" />
                                开始分析预测
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* 分析结果 */}
            {result && result.analysis && (
                <div className="space-y-6 animate-fade-in">

                    {/* 高频考点 */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            高频考点 TOP 5
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {result.analysis.hotspots?.top5?.map((spot, idx) => (
                                <span
                                    key={idx}
                                    className="px-4 py-2 bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-1"
                                >
                                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                    {spot}
                                </span>
                            ))}
                        </div>
                        <p className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                            {result.analysis.hotspots?.analysis}
                        </p>
                    </div>

                    {/* 命题趋势 */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                            命题趋势分析
                        </h4>
                        <p className="text-gray-700 mb-4">{result.analysis.trends?.summary}</p>
                        <div className="space-y-2">
                            {result.analysis.trends?.changes?.map((change, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                    <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-gray-600">{change}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium text-blue-700">难度变化：</span>
                            <span className="text-sm text-blue-600 ml-2">{result.analysis.trends?.difficulty}</span>
                        </div>
                    </div>

                    {/* 预测重点 */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-500" />
                            今年预测重点
                        </h4>

                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-2">🎯 必考重点</h5>
                                <ul className="space-y-2">
                                    {result.analysis.predictions?.mustKnow?.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            <span className="text-gray-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-2">🔮 可能出现</h5>
                                <ul className="space-y-2">
                                    {result.analysis.predictions?.likelyTopics?.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                                            <span className="text-gray-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">
                            <span className="font-medium">预测依据：</span> {result.analysis.predictions?.reasoning}
                        </p>
                    </div>

                    {/* 复习计划 */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-green-600" />
                            冲刺复习建议
                        </h4>

                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white/70 p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 mb-2">📋 优先复习</h5>
                                <ol className="space-y-1">
                                    {result.analysis.studyPlan?.priority?.map((item, idx) => (
                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                            <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                            <div className="bg-white/70 p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 mb-2">⚠️ 易错点</h5>
                                <ul className="space-y-1">
                                    {result.analysis.studyPlan?.commonMistakes?.map((item, idx) => (
                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-white/70 p-4 rounded-lg mb-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <Clock className="w-4 h-4" /> 时间分配
                            </h5>
                            <p className="text-sm text-gray-600">{result.analysis.studyPlan?.timeAllocation}</p>
                        </div>

                        <div className="bg-white/70 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">💡 复习策略</h5>
                            <ul className="space-y-1">
                                {result.analysis.studyPlan?.strategies?.map((item, idx) => (
                                    <li key={idx} className="text-sm text-gray-600">• {item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* 考场技巧 */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            考场应试技巧
                        </h4>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h5 className="text-sm font-medium text-amber-800 mb-2">⏱️ 时间管理</h5>
                                <p className="text-sm text-amber-700">{result.analysis.examTips?.timeManagement}</p>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h5 className="text-sm font-medium text-amber-800 mb-2">📝 答题顺序</h5>
                                <p className="text-sm text-amber-700">{result.analysis.examTips?.answeringOrder}</p>
                            </div>
                        </div>

                        <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                            <h5 className="text-sm font-medium text-amber-800 mb-2">✅ 检查要点</h5>
                            <ul className="space-y-1">
                                {result.analysis.examTips?.checkPoints?.map((item, idx) => (
                                    <li key={idx} className="text-sm text-amber-700 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* 数据来源标注 */}
                    <div className="text-center text-xs text-gray-400 space-y-1">
                        <p>数据来源：{result.hasKnowledgeData ? 'Get笔记知识库（历年高考真题）+ AI分析' : 'AI智能分析'}</p>
                        {result.userWeakPoints && result.userWeakPoints.length > 0 && (
                            <p>已结合你的薄弱知识点：{result.userWeakPoints.join('、')}</p>
                        )}
                        <p>生成时间：{new Date(result.generatedAt).toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PredictAnalysis;

