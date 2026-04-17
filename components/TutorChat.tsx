/**
 * AI 导师聊天组件 - 苏格拉底式教学
 * 参考 CFP-Study 项目的学习方法
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    MessageCircle, Send, Loader2, BookOpen, Brain, Target,
    RefreshCw, ChevronDown, Sparkles, GraduationCap
} from 'lucide-react';
import * as api from '../services/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface Props {
    subject: { id: string; name: string; icon: string };
    onLogout: () => void;
}

// 学习模式配置
const MODES = [
    { id: 'learn', name: '学习模式', icon: BookOpen, desc: '系统学习新知识点' },
    { id: 'review', name: '复习模式', icon: RefreshCw, desc: '复习薄弱知识点' },
    { id: 'quiz', name: '测验模式', icon: Target, desc: '做题检验掌握程度' },
];

// 快捷提问
const QUICK_QUESTIONS: Record<string, string[]> = {
    math: ['三角函数的诱导公式怎么记？', '导数求极值的步骤是什么？', '圆锥曲线有哪些常用结论？'],
    physics: ['牛顿三定律分别是什么？', '动能定理怎么用？', '电磁感应的右手定则怎么判断？'],
    chemistry: ['氧化还原反应怎么配平？', '化学平衡移动怎么判断？', '有机化学官能团有哪些？'],
    chinese: ['文言文翻译有什么技巧？', '古诗词鉴赏答题模板？', '议论文怎么写开头？'],
    english: ['定语从句和同位语从句怎么区分？', '虚拟语气的用法？', '作文高级句型有哪些？'],
    politics: ['唯物辩证法的核心观点？', '经济生活答题套路？', '哲学大题怎么分析？'],
};

export const TutorChat: React.FC<Props> = ({ subject, onLogout }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [mode, setMode] = useState<'learn' | 'review' | 'quiz'>('learn');
    const [topic, setTopic] = useState('');
    const [showModeSelect, setShowModeSelect] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const modeDropdownRef = useRef<HTMLDivElement>(null);

    // 滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 点击外部关闭模式选择下拉
    useEffect(() => {
        if (!showModeSelect) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
                setShowModeSelect(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showModeSelect]);

    // 切换学科时重置对话
    useEffect(() => {
        setMessages([]);
        setSessionId(null);
        setTopic('');
    }, [subject.id]);

    // 发送消息
    const sendMessage = async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text || isLoading) return;

        // 添加用户消息
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.chatWithTutor({
                sessionId: sessionId || undefined,
                message: text,
                subject: subject.id,
                topic: topic || undefined,
                mode,
            });

            // 保存 sessionId
            if (!sessionId) {
                setSessionId(response.sessionId);
            }

            // 添加 AI 回复
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.response,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);

        } catch (error: any) {
            console.error('Chat error:', error);

            if (error.code === 'UNAUTHORIZED') {
                onLogout();
                return;
            }

            // 添加错误消息
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `❌ ${error.message || '发送失败，请重试'}`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // 开始新对话
    const startNewChat = () => {
        setMessages([]);
        setSessionId(null);
    };

    // 处理按键
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // 渲染消息内容（简单 Markdown）
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-bold text-gray-900 mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-gray-700">{line.substring(2)}</li>;
            }
            if (line.startsWith('# ')) {
                return <h3 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.substring(2)}</h3>;
            }
            if (line.startsWith('## ')) {
                return <h4 key={i} className="font-bold text-gray-800 mt-3 mb-1">{line.substring(3)}</h4>;
            }
            return <p key={i} className="text-gray-700 mb-1">{line || '\u00A0'}</p>;
        });
    };

    return (
        <div className="flex flex-col h-[600px]">
            {/* 顶部控制栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            AI 导师 · {subject.name}
                            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                                苏格拉底式教学
                            </span>
                        </h3>
                        <p className="text-xs text-gray-500">
                            {MODES.find(m => m.id === mode)?.desc}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* 模式选择 */}
                    <div className="relative" ref={modeDropdownRef}>
                        <button
                            onClick={() => setShowModeSelect(!showModeSelect)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-indigo-300 transition-colors"
                        >
                            {React.createElement(MODES.find(m => m.id === mode)?.icon || BookOpen, { className: 'w-4 h-4' })}
                            {MODES.find(m => m.id === mode)?.name}
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {showModeSelect && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
                                {MODES.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            setMode(m.id as any);
                                            setShowModeSelect(false);
                                            startNewChat();
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${mode === m.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'
                                            }`}
                                    >
                                        <m.icon className="w-4 h-4" />
                                        <div className="text-left">
                                            <div className="font-medium">{m.name}</div>
                                            <div className="text-xs text-gray-500">{m.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 新对话按钮 */}
                    <button
                        onClick={startNewChat}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                        title="开始新对话"
                    >
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* 知识点输入 */}
            {messages.length === 0 && (
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <label className="text-sm text-gray-600 mb-2 block">
                        指定学习的知识点（可选）
                    </label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={`例如：三角函数、动能定理、氧化还原反应...`}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none"
                    />
                </div>
            )}

            {/* 消息区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-2">开始你的学习之旅</h4>
                        <p className="text-sm text-gray-500 mb-6 max-w-md">
                            我是你的 AI 导师，采用苏格拉底式教学法。<br />
                            我会先了解你已知的内容，然后循序渐进地帮你掌握知识点。
                        </p>

                        {/* 快捷提问 */}
                        <div className="w-full max-w-md">
                            <p className="text-xs text-gray-400 mb-2">快捷提问：</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {(QUICK_QUESTIONS[subject.id] || []).map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(q)}
                                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                            : 'bg-white border border-gray-200 shadow-sm'
                                        }`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                                            <Brain className="w-4 h-4 text-indigo-500" />
                                            <span className="text-xs font-medium text-indigo-600">AI 导师</span>
                                        </div>
                                    )}
                                    <div className={msg.role === 'user' ? 'text-white' : ''}>
                                        {msg.role === 'user' ? msg.content : renderContent(msg.content)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                        <span className="text-sm text-gray-500">AI 导师正在思考...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="p-4 border-t border-gray-100 bg-white">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入你的问题，按 Enter 发送..."
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                        className={`px-4 rounded-xl font-medium flex items-center justify-center transition-all ${!input.trim() || isLoading
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 active:scale-95'
                            }`}
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                    基于历年高考真题知识库 · 苏格拉底式教学法
                </p>
            </div>
        </div>
    );
};

export default TutorChat;

