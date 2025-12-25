/**
 * 认证页面组件
 * 包含登录和注册功能
 */

import React, { useState } from 'react';
import { GraduationCap, User, Lock, Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onRegister: (username: string, password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLogin,
  onRegister,
  isLoading,
  error,
}) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // 验证输入
    if (!username.trim()) {
      setLocalError('请输入用户名');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setLocalError('用户名需要 3-20 个字符');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setLocalError('用户名只能包含字母、数字和下划线');
      return;
    }

    if (!password) {
      setLocalError('请输入密码');
      return;
    }

    if (password.length < 6) {
      setLocalError('密码至少需要 6 个字符');
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      setLocalError('两次输入的密码不一致');
      return;
    }

    // 执行登录或注册
    const success = isLoginMode
      ? await onLogin(username, password)
      : await onRegister(username, password);

    if (!success && !error) {
      setLocalError(isLoginMode ? '登录失败，请重试' : '注册失败，请重试');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 p-6">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl max-w-md w-full border border-white/20 shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">高考冲刺助手</h1>
          <p className="text-blue-100 text-sm">
            专为高三学子打造的智能备考助手
          </p>
        </div>

        {/* 切换按钮 */}
        <div className="flex bg-white/10 rounded-xl p-1 mb-6">
          <button
            onClick={() => {
              setIsLoginMode(true);
              setLocalError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              isLoginMode
                ? 'bg-white text-blue-600'
                : 'text-white/70 hover:text-white'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => {
              setIsLoginMode(false);
              setLocalError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              !isLoginMode
                ? 'bg-white text-blue-600'
                : 'text-white/70 hover:text-white'
            }`}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名 */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/50 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
              disabled={isLoading}
            />
          </div>

          {/* 密码 */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-12 pr-12 text-white placeholder-white/50 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* 确认密码（仅注册时显示） */}
          {!isLoginMode && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="确认密码"
                className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/50 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
                disabled={isLoading}
              />
            </div>
          )}

          {/* 错误提示 */}
          {displayError && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl py-3 px-4 text-red-200 text-sm">
              {displayError}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-white text-blue-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg ${
              isLoading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-50 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="loader mr-2"></div>
                {isLoginMode ? '登录中...' : '注册中...'}
              </>
            ) : (
              isLoginMode ? '登录' : '注册'
            )}
          </button>
        </form>

        {/* 提示信息 */}
        <p className="mt-6 text-xs text-center text-blue-200/60">
          {isLoginMode ? (
            <>
              还没有账号？
              <button
                onClick={() => {
                  setIsLoginMode(false);
                  setLocalError(null);
                }}
                className="text-white underline ml-1 hover:no-underline"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                onClick={() => {
                  setIsLoginMode(true);
                  setLocalError(null);
                }}
                className="text-white underline ml-1 hover:no-underline"
              >
                去登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};


