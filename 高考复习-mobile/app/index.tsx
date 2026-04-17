/**
 * 应用入口 - 检查认证状态后重定向
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken, clearToken } from '@/services/api';

/**
 * 解码 JWT payload（不验证签名，仅用于检查过期时间）
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp || typeof payload.exp !== 'number') return false;
    // 提前 60 秒判定过期，避免边界情况
    return Date.now() >= (payload.exp * 1000) - 60_000;
  } catch {
    return true;
  }
}

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const token = await getToken();
        if (!cancelled) {
          if (token && !isTokenExpired(token)) {
            setIsLoggedIn(true);
          } else {
            // Token 不存在或已过期，清除并跳转登录
            if (token) {
              await clearToken();
            }
            setIsLoggedIn(false);
          }
        }
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/tutor" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
});
