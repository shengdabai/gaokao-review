/**
 * 学习进度组件
 * 显示各学科知识点的掌握程度
 */

import React, { useState, useEffect } from 'react';
import {
    BarChart3, CheckCircle2, Clock, Target, TrendingUp,
    Loader2, RefreshCw, BookOpen, AlertCircle
} from 'lucide-react';
import * as api from '../services/api';

interface Props {
    subject?: { id: string; name: string; icon: string };
    onLogout: () => void;
}

export const StudyProgress: React.FC<Props> = ({ subject, onLogout }) => {
    const [progress, setProgress] = useState<api.StudyProgressResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string | null>(subject?.id || null);

    const SUBJECTS = [
        { id: 'math', name: '数学', icon: '📐' },
        { id: 'physics', name: '物理', icon: '⚡' },
        { id: 'chemistry', name: '化学', icon: '🧪' },
        { id: 'chinese', name: '语文', icon: '📖' },
        { id: 'english', name: '英语', icon: '🔤' },
        { id: 'politics', name: '政治', icon: '⚖️' },
    ];

    const loadProgress = async () => {
        setIsLoading(true);
        setError('');

        try {
            const data = await api.getStudyProgress();
            setProgress(data);
        } catch (err: any) {
            if (err.code === 'UNAUTHORIZED') {
                onLogout();
            } else {
                setError(err.message || '加载失败');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProgress();
    }, []);

    // 计算进度条颜色
    const getMasteryColor = (level: number) => {
        if (level >= 80) return 'bg-green-500';
        if (level >= 50) return 'bg-yellow-500';
        if (level > 0) return 'bg-orange-500';
        return 'bg-gray-200';
    };

    // 计算进度条背景
    const getMasteryBg = (level: number) => {
        if (level >= 80) return 'bg-green-50';
        if (level >= 50) return 'bg-yellow-50';
        if (level > 0) return 'bg-orange-50';
        return 'bg-gray-50';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-gray-500">{error}</p>
                <button
                    onClick={loadProgress}
                    className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm hover:bg-indigo-200"
                >
                    重试
                </button>
            </div>
        );
    }

    if (!progress) {
        return null;
    }

    const currentSubjectData = selectedSubject
        ? progress.bySubject[selectedSubject]
        : null;

    return (
        <div className="space-y-6">
            {/* 总体概览 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        学习进度总览
                    </h3>
                    <button
                        onClick={loadProgress}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold">{progress.overallMastery}%</div>
                        <div className="text-xs text-white/70">总体掌握度</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-300">{progress.masteredTopics}</div>
                        <div className="text-xs text-white/70">已掌握</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-300">{progress.learningTopics}</div>
                        <div className="text-xs text-white/70">学习中</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white/50">{progress.notStartedTopics}</div>
                        <div className="text-xs text-white/70">未开始</div>
                    </div>
                </div>

                {/* 总进度条 */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-white/70 mb-1">
                        <span>整体进度</span>
                        <span>{progress.masteredTopics}/{progress.totalTopics} 知识点</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${(progress.masteredTopics / progress.totalTopics) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 学科选择 */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedSubject(null)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedSubject === null
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    全部学科
                </button>
                {SUBJECTS.map(subj => (
                    <button
                        key={subj.id}
                        onClick={() => setSelectedSubject(subj.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${selectedSubject === subj.id
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <span>{subj.icon}</span>
                        {subj.name}
                        {progress.bySubject[subj.id] && (
                            <span className="ml-1 text-xs bg-white/50 px-1.5 py-0.5 rounded">
                                {progress.bySubject[subj.id].avgMastery}%
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 学科详情 */}
            {selectedSubject ? (
                currentSubjectData ? (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-gray-800">
                                    {SUBJECTS.find(s => s.id === selectedSubject)?.icon}{' '}
                                    {SUBJECTS.find(s => s.id === selectedSubject)?.name} 知识点
                                </h4>
                                <div className="text-sm text-gray-500">
                                    掌握 {currentSubjectData.masteredTopics}/{currentSubjectData.totalTopics}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto">
                            <div className="space-y-3">
                                {currentSubjectData.allTopics.map(topic => {
                                    const topicProgress = currentSubjectData.progress.find(
                                        (p: any) => p.topic === topic
                                    );
                                    const mastery = topicProgress?.mastery_level || 0;

                                    return (
                                        <div key={topic} className={`p-3 rounded-lg ${getMasteryBg(mastery)}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-800">{topic}</span>
                                                <div className="flex items-center gap-2">
                                                    {mastery >= 80 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                                    {mastery > 0 && mastery < 80 && <Clock className="w-4 h-4 text-yellow-500" />}
                                                    <span className={`text-sm font-medium ${mastery >= 80 ? 'text-green-600' :
                                                            mastery >= 50 ? 'text-yellow-600' :
                                                                mastery > 0 ? 'text-orange-600' : 'text-gray-400'
                                                        }`}>
                                                        {mastery}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${getMasteryColor(mastery)}`}
                                                    style={{ width: `${mastery}%` }}
                                                />
                                            </div>
                                            {topicProgress && (
                                                <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                                                    <span>学习 {topicProgress.times_studied} 次</span>
                                                    <span>正确 {topicProgress.times_correct} 次</span>
                                                    {topicProgress.last_studied_at && (
                                                        <span>
                                                            上次: {new Date(topicProgress.last_studied_at).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">还没有开始学习这个学科</p>
                        <p className="text-sm text-gray-400 mt-1">使用 AI 导师开始学习吧！</p>
                    </div>
                )
            ) : (
                /* 全部学科概览 */
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SUBJECTS.map(subj => {
                        const subjData = progress.bySubject[subj.id];
                        if (!subjData) return null;

                        return (
                            <div
                                key={subj.id}
                                onClick={() => setSelectedSubject(subj.id)}
                                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{subj.icon}</span>
                                        <span className="font-bold text-gray-800">{subj.name}</span>
                                    </div>
                                    <span className={`text-lg font-bold ${subjData.avgMastery >= 80 ? 'text-green-600' :
                                            subjData.avgMastery >= 50 ? 'text-yellow-600' :
                                                subjData.avgMastery > 0 ? 'text-orange-600' : 'text-gray-400'
                                        }`}>
                                        {subjData.avgMastery}%
                                    </span>
                                </div>

                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                                    <div
                                        className={`h-full rounded-full transition-all ${getMasteryColor(subjData.avgMastery)}`}
                                        style={{ width: `${subjData.avgMastery}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        {subjData.masteredTopics} 已掌握
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-yellow-500" />
                                        {subjData.learningTopics} 学习中
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Target className="w-3 h-3 text-gray-400" />
                                        {subjData.notStartedTopics} 待学习
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StudyProgress;

