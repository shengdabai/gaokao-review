import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Camera, Upload, Search, BookOpen, Brain, Zap, ChevronRight, GraduationCap, History, Trash2, Bookmark, X, Key, Lock, LogOut, User, MessageCircle, TrendingUp, BarChart3, Filter } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { AuthPage } from "./components/AuthPage";
import { TutorChat } from "./components/TutorChat";
import { PredictAnalysis } from "./components/PredictAnalysis";
import { StudyProgress } from "./components/StudyProgress";
import * as api from "./services/api";
import { SUBJECTS } from "./constants/subjects";

interface ErrorItem {
  id: string;
  subject: string;
  image: string;
  analysis: string;
  tags: string[];
  date: string;
}

const App = () => {
  // 认证状态
  const auth = useAuth();

  // API Key State (保留兼容性)
  const [hasApiKey, setHasApiKey] = useState(true); // 默认使用后端 API
  const [isCheckingKey, setIsCheckingKey] = useState(false);

  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0]);
  const [activeTab, setActiveTab] = useState<"ai" | "notes" | "mistakes" | "tutor" | "predict" | "progress">("tutor");

  // AI Solver State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Notes State
  const [noteQuery, setNoteQuery] = useState("");
  const [noteResults, setNoteResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Error Notebook State
  const [errorNotebook, setErrorNotebook] = useState<ErrorItem[]>([]);
  // Mistakes filter state
  const [mistakeSubjectFilter, setMistakeSubjectFilter] = useState<string>("all");

  // Initialize Data - 从服务器加载数据
  // NOTE: useEffect must be called before any conditional returns (React Rules of Hooks)
  useEffect(() => {
    const init = async () => {
      if (!auth.isLoggedIn) return;

      try {
        // 加载搜索历史
        const historyResult = await api.getSearchHistory(10);
        setSearchHistory(historyResult.items.map(h => h.query));
      } catch (e) {
        console.error("Failed to load search history", e);
        // 降级到本地存储
        const savedHistory = localStorage.getItem("app_search_history");
        if (savedHistory) {
          try {
            setSearchHistory(JSON.parse(savedHistory));
          } catch (e) {
            console.error("Failed to parse history", e);
          }
        }
      }

      try {
        // 加载错题本
        const mistakesResult = await api.getMistakes({ limit: 100 });
        setErrorNotebook(mistakesResult.items.map(m => ({
          id: m.id,
          subject: m.subject,
          image: m.imageUrl,
          analysis: m.analysis,
          tags: m.tags,
          date: new Date(m.createdAt).toLocaleDateString()
        })));
      } catch (e) {
        console.error("Failed to load mistakes", e);
        // 降级到本地存储
        const savedNotebook = localStorage.getItem("app_error_notebook");
        if (savedNotebook) {
          try {
            setErrorNotebook(JSON.parse(savedNotebook));
          } catch (e) {
            console.error("Failed to parse notebook", e);
          }
        }
      }
    };
    init();
  }, [auth.isLoggedIn]);

  // 如果未登录，显示认证页面
  if (!auth.isLoggedIn && !auth.isLoading) {
    return (
      <AuthPage
        onLogin={auth.login}
        onRegister={auth.register}
        isLoading={auth.isLoading}
        error={auth.error}
      />
    );
  }

  // 加载中
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="loader"></div>
      </div>
    );
  }

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        // Race condition mitigation: Assume success
        setHasApiKey(true);
      } catch (e) {
        console.error("Error selecting key:", e);
      }
    }
  };

  // --- Search History Logic ---
  const updateHistory = (term: string) => {
    setSearchHistory(prev => {
      const newHistory = [term, ...prev.filter(h => h !== term)].slice(0, 6);
      localStorage.setItem("app_search_history", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("app_search_history");
  };

  // --- Error Notebook Logic ---
  const addToNotebook = async () => {
    if (!selectedImage || !aiAnalysis) return;

    try {
      // 调用后端 API 添加错题
      const result = await api.addMistake({
        subject: activeSubject.id,
        imageUrl: selectedImage,
        analysis: aiAnalysis,
        tags: aiTags,
      });

      const newItem: ErrorItem = {
        id: result.id,
        subject: activeSubject.id,
        image: selectedImage,
        analysis: aiAnalysis,
        tags: aiTags,
        date: new Date().toLocaleDateString()
      };

      const newNotebook = [newItem, ...errorNotebook];
      setErrorNotebook(newNotebook);
      // 同时保存到本地作为备份
      localStorage.setItem("app_error_notebook", JSON.stringify(newNotebook));

      alert("已成功加入错题本！");
    } catch (error: any) {
      console.error("Add to notebook failed", error);
      if (error.code === 'UNAUTHORIZED') {
        auth.logout();
        alert("登录已过期，请重新登录。");
      } else {
        alert(error.message || "保存失败，请重试。");
      }
    }
  };

  const removeFromNotebook = async (id: string) => {
    if (!confirm("确定要删除这条错题记录吗？")) return;

    try {
      // 调用后端 API 删除错题
      await api.deleteMistake(id);

      const newNotebook = errorNotebook.filter(item => item.id !== id);
      setErrorNotebook(newNotebook);
      localStorage.setItem("app_error_notebook", JSON.stringify(newNotebook));
    } catch (error: any) {
      console.error("Delete mistake failed", error);
      if (error.code === 'UNAUTHORIZED') {
        auth.logout();
        alert("登录已过期，请重新登录。");
      } else {
        alert(error.message || "删除失败，请重试。");
      }
    }
  };

  // --- Handlers for AI Solver ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制文件大小为 5MB
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`图片大小不能超过 ${MAX_SIZE_MB}MB，请压缩后重试。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setAiAnalysis(""); // Clear previous analysis
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setAiAnalysis("");
    setAiTags([]);

    try {
      // 调用后端 API 进行图片分析
      const result = await api.analyzeImage(selectedImage, activeSubject.id);

      setAiAnalysis(result.analysis || "无法解析，请重试。");
      setAiTags(result.tags || []);

    } catch (error: any) {
      console.error("Analysis failed", error);

      // 处理特定错误
      if (error.code === 'UNAUTHORIZED') {
        auth.logout();
        alert("登录已过期，请重新登录。");
      } else {
        setAiAnalysis(error.message || "分析失败，请检查网络或重试。");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Handlers for Get Notes ---

  const searchNotes = async (overrideQuery?: string) => {
    const queryToUse = typeof overrideQuery === 'string' ? overrideQuery : noteQuery;

    if (!queryToUse.trim()) return;

    if (overrideQuery) {
      setNoteQuery(overrideQuery);
    }

    // Add to local history
    updateHistory(queryToUse.trim());

    setIsSearching(true);
    setNoteResults(null);

    try {
      // 调用后端 API 搜索笔记
      const result = await api.searchNotes(queryToUse.trim(), activeSubject.id);

      setNoteResults({
        answer: result.content,
        source: result.source === 'ai' ? 'AI' : 'Get笔记'
      });

    } catch (error: any) {
      console.error("Search failed", error);

      if (error.code === 'UNAUTHORIZED') {
        auth.logout();
        alert("登录已过期，请重新登录。");
      } else {
        setNoteResults({ error: error.message || "搜索失败，请稍后重试。" });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // --- Render Helpers ---

  /**
   * 增强版 Markdown 渲染函数
   * 支持标题、粗体、斜体、行内代码、代码块、有序/无序列表等
   * @param text - 原始 Markdown 文本
   * @returns React 元素数组
   */
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    const processInlineMarkdown = (line: string): React.ReactNode[] => {
      // Process bold, italic, inline code
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let key = 0;

      while (remaining.length > 0) {
        // Inline code `...`
        const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
        // Bold **...**
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
        // Italic *...*
        const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);

        // Find earliest match
        let earliest: { type: string; match: RegExpMatchArray } | null = null;
        if (codeMatch && codeMatch[1] !== undefined) {
          const idx = codeMatch[1].length;
          if (!earliest || idx < (earliest.match[1]?.length ?? Infinity)) {
            earliest = { type: 'code', match: codeMatch };
          }
        }
        if (boldMatch && boldMatch[1] !== undefined) {
          const idx = boldMatch[1].length;
          if (!earliest || idx < (earliest.match[1]?.length ?? Infinity)) {
            earliest = { type: 'bold', match: boldMatch };
          }
        }
        if (italicMatch && italicMatch[1] !== undefined && !boldMatch) {
          const idx = italicMatch[1].length;
          if (!earliest || idx < (earliest.match[1]?.length ?? Infinity)) {
            earliest = { type: 'italic', match: italicMatch };
          }
        }

        if (!earliest) {
          parts.push(<span key={key++}>{remaining}</span>);
          break;
        }

        const { type, match } = earliest;
        if (match[1]) {
          parts.push(<span key={key++}>{match[1]}</span>);
        }

        if (type === 'code') {
          parts.push(
            <code key={key++} className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono">
              {match[2]}
            </code>
          );
        } else if (type === 'bold') {
          parts.push(<strong key={key++} className="font-bold text-gray-900">{match[2]}</strong>);
        } else if (type === 'italic') {
          parts.push(<em key={key++} className="italic">{match[2]}</em>);
        }

        remaining = match[3] || '';
      }

      return parts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block toggle
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <pre key={i} className="bg-gray-900 text-green-400 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono">
              <code>{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Headings (### > ## > #)
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={i} className="font-bold text-base mt-3 mb-1.5 text-gray-800">
            {processInlineMarkdown(line.replace(/^###\s/, ''))}
          </h4>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={i} className="font-bold text-lg mt-4 mb-2 text-gray-900">
            {processInlineMarkdown(line.replace(/^##\s/, ''))}
          </h3>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h2 key={i} className="font-extrabold text-xl mt-4 mb-2 text-gray-900">
            {processInlineMarkdown(line.replace(/^#\s/, ''))}
          </h2>
        );
      }
      // Unordered list items
      else if (line.match(/^\s*[-*]\s/)) {
        const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
        elements.push(
          <div key={i} className="flex items-start gap-2 mb-0.5 text-gray-700" style={{ paddingLeft: `${Math.min(indent, 6) * 8}px` }}>
            <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
            <span>{processInlineMarkdown(line.replace(/^\s*[-*]\s/, ''))}</span>
          </div>
        );
      }
      // Ordered list items
      else if (line.match(/^\s*\d+\.\s/)) {
        const numMatch = line.match(/^\s*(\d+)\.\s(.*)/);
        if (numMatch) {
          elements.push(
            <div key={i} className="flex items-start gap-2 mb-0.5 text-gray-700">
              <span className="text-blue-500 font-bold flex-shrink-0 min-w-[1.2rem] text-right">{numMatch[1]}.</span>
              <span>{processInlineMarkdown(numMatch[2])}</span>
            </div>
          );
        }
      }
      // Horizontal rule
      else if (line.match(/^[-*_]{3,}\s*$/)) {
        elements.push(<hr key={i} className="my-3 border-gray-200" />);
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      }
      // Normal paragraph
      else {
        elements.push(
          <div key={i} className="mb-1 text-gray-700 leading-relaxed">
            {processInlineMarkdown(line)}
          </div>
        );
      }
    }

    // Handle unclosed code block
    if (inCodeBlock && codeContent.length > 0) {
      elements.push(
        <pre key="unclosed-code" className="bg-gray-900 text-green-400 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono">
          <code>{codeContent.join('\n')}</code>
        </pre>
      );
    }

    return elements;
  };

  const renderNoteResults = () => {
    if (!noteResults) return null;

    if (noteResults.error) {
      return <div className="text-red-500 p-4 bg-red-50 rounded-lg">{noteResults.error}</div>;
    }

    // Determine content to display
    let content = "";
    if (typeof noteResults === 'string') {
      content = noteResults;
    } else if (noteResults.answer) {
      content = noteResults.answer;
    } else if (noteResults.output) {
      content = noteResults.output;
    } else if (noteResults.message) {
      content = noteResults.message;
    } else {
      content = JSON.stringify(noteResults, null, 2).replace(/[{}"]/g, '');
    }

    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-gray-800">搜索结果</h3>
            {noteResults.source === "AI" && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Brain className="w-3 h-3" />
                AI 智能笔记
              </span>
            )}
          </div>
          <div className="prose max-w-none text-gray-700 whitespace-pre-wrap text-sm">
            {renderMarkdown(content)}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex items-start gap-2">
          <Zap className="w-4 h-4 mt-0.5" />
          <span>提示：结合 Get 笔记和 AI 分析，整理错题本效果更好哦！</span>
        </div>
      </div>
    );
  };

  // --- Landing Page ---
  if (isCheckingKey) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="loader"></div></div>;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 p-6 text-white text-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl max-w-md w-full border border-white/20 shadow-2xl">
          <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">高考冲刺 · 逆袭计划</h1>
          <p className="text-blue-100 mb-8">
            专为高三学子打造的智能备考助手。<br />
            我们需要连接您的 Google API Key 以使用最先进的视觉模型 (Gemini 3.0 Pro) 来分析题目。
          </p>

          <button
            onClick={handleSelectKey}
            className="w-full bg-white text-blue-600 font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-blue-50 transition-all shadow-lg active:scale-95"
          >
            <Key className="w-5 h-5" />
            连接 API Key
          </button>

          <p className="mt-6 text-xs text-blue-200/60">
            请确保选择一个已关联 Billing 账户的项目。<br />
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              了解更多关于 Billing 的信息
            </a>
          </p>
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="w-8 h-8" />
              <h1 className="text-2xl font-bold tracking-tight">高考冲刺 · 逆袭计划</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* 用户信息 */}
              <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-lg">
                <User className="w-4 h-4" />
                <span>{auth.user?.username}</span>
              </div>
              {/* 登出按钮 */}
              <button
                onClick={auth.logout}
                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                title="退出登录"
              >
                <LogOut className="w-3 h-3" />
                退出
              </button>
            </div>
          </div>
          <p className="text-blue-100 text-sm">
            专为基础薄弱同学打造 · 数理化重点突破 · AI 智能辅导
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">

        {/* Subject Selection */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SUBJECTS.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setActiveSubject(sub)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 border-2 ${activeSubject.id === sub.id
                  ? `border-${sub.color.split("-")[1]}-500 bg-white shadow-md transform scale-105`
                  : "border-transparent bg-white hover:bg-gray-50 text-gray-500"
                }`}
            >
              <span className="text-2xl mb-1">{sub.icon}</span>
              <span className={`text-sm font-bold ${activeSubject.id === sub.id ? "text-gray-900" : ""}`}>
                {sub.name}
              </span>
              {sub.primary && activeSubject.id !== sub.id && (
                <span className="text-[10px] text-red-500 font-medium mt-1">重点</span>
              )}
            </button>
          ))}
        </div>

        {/* Feature Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap border-b border-gray-100">
            <button
              onClick={() => setActiveTab("tutor")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "tutor" ? "text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">AI 导师</span>
              <span className="sm:hidden">导师</span>
            </button>
            <button
              onClick={() => setActiveTab("predict")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "predict" ? "text-orange-600 bg-orange-50/50 border-b-2 border-orange-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">试题分析</span>
              <span className="sm:hidden">分析</span>
            </button>
            <button
              onClick={() => setActiveTab("progress")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "progress" ? "text-green-600 bg-green-50/50 border-b-2 border-green-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">学习进度</span>
              <span className="sm:hidden">进度</span>
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "ai" ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">拍题讲解</span>
              <span className="sm:hidden">拍题</span>
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "notes" ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">笔记搜索</span>
              <span className="sm:hidden">笔记</span>
            </button>
            <button
              onClick={() => setActiveTab("mistakes")}
              className={`flex-1 min-w-[100px] py-3 text-center font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-colors ${activeTab === "mistakes" ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">错题本</span>
              <span className="sm:hidden">错题</span>
            </button>
          </div>

          <div className="p-6 min-h-[400px]">

            {/* AI 导师 Tab */}
            {activeTab === "tutor" && (
              <TutorChat
                subject={activeSubject}
                onLogout={auth.logout}
              />
            )}

            {/* 试题分析预测 Tab */}
            {activeTab === "predict" && (
              <PredictAnalysis
                subject={activeSubject}
                onLogout={auth.logout}
              />
            )}

            {/* 学习进度 Tab */}
            {activeTab === "progress" && (
              <StudyProgress
                subject={activeSubject}
                onLogout={auth.logout}
              />
            )}

            {/* AI拍题 Tab Content */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div
                    className="w-full h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative overflow-hidden group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedImage ? (
                      <img src={selectedImage} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <>
                        <div className="bg-white p-4 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-blue-500" />
                        </div>
                        <p className="text-gray-500 font-medium">点击上传或拍摄题目</p>
                        <p className="text-gray-400 text-xs mt-1">支持数学公式、物理电路图等</p>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>

                  <button
                    onClick={analyzeImage}
                    disabled={!selectedImage || isAnalyzing}
                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${!selectedImage || isAnalyzing
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
                      }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="loader mr-2"></div>
                        AI 正在深度思考...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        开始分析题目
                      </>
                    )}
                  </button>
                </div>

                {aiAnalysis && (
                  <div className="animate-fade-in bg-white rounded-xl border border-blue-100 shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-gray-800">AI 老师解析</h3>
                      </div>
                      <button
                        onClick={addToNotebook}
                        className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Bookmark className="w-4 h-4" />
                        加入错题本
                      </button>
                    </div>
                    <div className="markdown-body text-sm sm:text-base">
                      {renderMarkdown(aiAnalysis)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab Content */}
            {activeTab === "notes" && (
              <div className="space-y-6">
                <div className="flex flex-col space-y-3">
                  <label className="text-sm font-medium text-gray-700">想复习哪个知识点？</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={noteQuery}
                        onChange={(e) => setNoteQuery(e.target.value)}
                        placeholder={`例如：${activeSubject.name}三角函数、牛顿定律...`}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && searchNotes()}
                      />
                    </div>
                    <button
                      onClick={() => searchNotes()}
                      disabled={isSearching || !noteQuery.trim()}
                      className={`px-6 rounded-xl font-bold text-white transition-all ${isSearching || !noteQuery.trim()
                          ? "bg-gray-300"
                          : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                      {isSearching ? "搜索中..." : "搜索"}
                    </button>
                  </div>
                </div>

                {/* History Section */}
                {!noteResults && !isSearching && searchHistory.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <History className="w-3.5 h-3.5" />
                        最近搜索
                      </h3>
                      <button
                        onClick={clearHistory}
                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((term, idx) => (
                        <button
                          key={idx}
                          onClick={() => searchNotes(term)}
                          className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-sm rounded-lg hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center gap-2 group"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Topics Quick Select */}
                {!noteResults && !isSearching && (
                  <div className="mt-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                      {activeSubject.name} · 高频考点推荐
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {getTopicsForSubject(activeSubject.id).map(topic => (
                        <button
                          key={topic}
                          onClick={() => searchNotes(topic)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {renderNoteResults()}
              </div>
            )}

            {/* Mistakes Tab Content - 错题本，含学科筛选和知识点标签 */}
            {activeTab === "mistakes" && (
              <div className="space-y-6">
                {/* Subject filter bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <button
                    onClick={() => setMistakeSubjectFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      mistakeSubjectFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    全部
                  </button>
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setMistakeSubjectFilter(s.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        mistakeSubjectFilter === s.id
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>

                {errorNotebook.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p>还没有错题记录哦</p>
                    <p className="text-xs mt-1">快去"AI 拍题"里添加吧！</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const filtered = errorNotebook.filter(
                        (item) => mistakeSubjectFilter === "all" || item.subject === mistakeSubjectFilter
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-400">
                            <p>该学科暂无错题记录</p>
                          </div>
                        );
                      }
                      return filtered.map((item) => (
                        <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold">
                                {SUBJECTS.find(s => s.id === item.subject)?.name || item.subject}
                              </span>
                              <span className="text-xs text-gray-400">{item.date}</span>
                            </div>
                            <button
                              onClick={() => removeFromNotebook(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-4">
                            <div className="mb-4 bg-gray-50 rounded-lg p-2 inline-block">
                              <img src={item.image} alt="Question" className="max-h-32 rounded object-contain" />
                            </div>
                            <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-100">
                              {renderMarkdown(item.analysis)}
                            </div>
                            {/* Display knowledge point tags */}
                            {item.tags && item.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="text-center text-gray-400 text-xs py-4">
          © 2024 高考冲刺助手 · Powered by Gemini & Get Notes
        </div>
      </main>
    </div>
  );
};

// Helper data for quick topics
function getTopicsForSubject(subId: string): string[] {
  switch (subId) {
    case "math": return ["三角函数", "立体几何", "导数基础", "圆锥曲线", "数列求和"];
    case "physics": return ["牛顿运动定律", "动能定理", "电磁感应", "万有引力", "电路分析"];
    case "chemistry": return ["氧化还原反应", "有机化学基础", "电化学", "元素周期律", "化学平衡"];
    case "chinese": return ["文言文实词", "古诗词鉴赏", "作文素材", "成语运用"];
    case "english": return ["定语从句", "虚拟语气", "完形填空技巧", "写作模板"];
    case "politics": return ["唯物辩证法", "经济生活", "政治生活", "文化生活"];
    default: return [];
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
