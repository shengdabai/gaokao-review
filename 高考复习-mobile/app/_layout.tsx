/**
 * 根布局组件
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as api from '@/services/api';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await api.getToken();
      if (token) {
        // 验证 token 是否有效
        await api.getCurrentUser();
        setIsLoggedIn(true);
      }
    } catch (error) {
      // Token 无效，清除
      await api.clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#3b82f6',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen
            name="(auth)/login"
            options={{
              headerShown: false,
            }}
          />
        ) : (
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
        )}
      </Stack>
    </>
  );
}

