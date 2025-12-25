/**
 * 登录/注册页面
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as api from '@/services/api';

export default function LoginScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    // 验证输入
    if (!username.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      Alert.alert('提示', '用户名需要 3-20 个字符');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    if (password.length < 6) {
      Alert.alert('提示', '密码至少需要 6 个字符');
      return;
    }
    if (!isLoginMode && password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const result = isLoginMode
        ? await api.login(username, password)
        : await api.register(username, password);

      // 保存 Token
      await api.setToken(result.token);

      // 跳转到主页
      router.replace('/(tabs)/ai');
    } catch (error: any) {
      Alert.alert('错误', error.message || (isLoginMode ? '登录失败' : '注册失败'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🎓</Text>
          <Text style={styles.logoTitle}>高考冲刺助手</Text>
          <Text style={styles.logoSubtitle}>专为高三学子打造的智能备考助手</Text>
        </View>

        {/* 切换按钮 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLoginMode && styles.tabActive]}
            onPress={() => setIsLoginMode(true)}
          >
            <Text style={[styles.tabText, isLoginMode && styles.tabTextActive]}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLoginMode && styles.tabActive]}
            onPress={() => setIsLoginMode(false)}
          >
            <Text style={[styles.tabText, !isLoginMode && styles.tabTextActive]}>注册</Text>
          </TouchableOpacity>
        </View>

        {/* 表单 */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="用户名"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="密码"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          {!isLoginMode && (
            <TextInput
              style={styles.input}
              placeholder="确认密码"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#3b82f6" />
            ) : (
              <Text style={styles.buttonText}>{isLoginMode ? '登录' : '注册'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b82f6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  logoTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  logoSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

