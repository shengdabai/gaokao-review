/**
 * 认证 Hook
 * 管理用户认证状态
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getToken, 
  setToken, 
  clearToken, 
  login as apiLogin, 
  register as apiRegister,
  getCurrentUser,
  type AuthUser,
  type UserInfo
} from '../services/api';

export interface UseAuthReturn {
  // 状态
  isLoggedIn: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  error: string | null;
  
  // 方法
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

/**
 * 认证 Hook
 */
export function useAuth(): UseAuthReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Logout, unmount and newer auth operations invalidate older responses.
  const authRequest = useRef(0);

  /**
   * 刷新用户信息
   */
  const refreshUser = useCallback(async () => {
    const request = ++authRequest.current;
    const token = getToken();
    if (!token) {
      setIsLoggedIn(false);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userInfo = await getCurrentUser();
      if (request !== authRequest.current) return;
      setUser(userInfo);
      setIsLoggedIn(true);
      setError(null);
    } catch (err: any) {
      if (request !== authRequest.current) return;
      // Token 无效或过期
      if (err.status === 401) {
        clearToken();
        setIsLoggedIn(false);
        setUser(null);
      }
      setError(err.message);
    } finally {
      if (request === authRequest.current) setIsLoading(false);
    }
  }, []);

  /**
   * 初始化时检查登录状态
   */
  useEffect(() => {
    refreshUser();
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'auth_token' && event.key !== null) return;
      if (event.storageArea && event.storageArea !== localStorage) return;
      // Hide the old account before validating another tab's new token.
      setUser(null);
      setIsLoggedIn(false);
      setError(null);
      setIsLoading(true);
      refreshUser();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      authRequest.current++;
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshUser]);

  /**
   * 登录
   */
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const request = ++authRequest.current;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiLogin(username, password);
      if (request !== authRequest.current) return false;
      setToken(result.token);
      
      // 获取完整用户信息
      const userInfo = await getCurrentUser();
      if (request !== authRequest.current) return false;
      setUser(userInfo);
      setIsLoggedIn(true);
      
      return true;
    } catch (err: any) {
      if (request !== authRequest.current) return false;
      setError(err.message);
      return false;
    } finally {
      if (request === authRequest.current) setIsLoading(false);
    }
  }, []);

  /**
   * 注册
   */
  const register = useCallback(async (username: string, password: string): Promise<boolean> => {
    const request = ++authRequest.current;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiRegister(username, password);
      if (request !== authRequest.current) return false;
      setToken(result.token);
      
      // 设置用户信息
      setUser({
        userId: result.userId,
        username: result.username,
        createdAt: new Date().toISOString(),
        stats: {
          totalMistakes: 0,
          bySubject: {},
        },
      });
      setIsLoggedIn(true);
      
      return true;
    } catch (err: any) {
      if (request !== authRequest.current) return false;
      setError(err.message);
      return false;
    } finally {
      if (request === authRequest.current) setIsLoading(false);
    }
  }, []);

  /**
   * 登出
   */
  const logout = useCallback(() => {
    authRequest.current++;
    clearToken();
    setIsLoggedIn(false);
    setUser(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isLoggedIn,
    isLoading,
    user,
    error,
    login,
    register,
    logout,
    refreshUser,
  };
}


