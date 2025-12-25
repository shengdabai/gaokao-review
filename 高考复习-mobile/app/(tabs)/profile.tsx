/**
 * 个人中心页面
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as api from '@/services/api';
import * as storage from '@/services/storage';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userInfo = await api.getCurrentUser();
      setUser(userInfo);
    } catch (error) {
      console.error('Failed to load user info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await api.clearToken();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    try {
      Alert.alert('提示', '正在同步数据...');
      
      // 获取未同步的本地数据
      const unsyncedMistakes = await storage.getUnsyncedMistakes();
      const lastSyncTime = await storage.getLastSyncTime();
      
      // 调用同步 API
      const result = await api.syncMistakes({
        lastSyncTime: lastSyncTime || undefined,
        localMistakes: unsyncedMistakes,
      });
      
      // 保存服务器数据到本地
      for (const mistake of result.serverMistakes) {
        await storage.saveMistakeLocally({
          ...mistake,
          synced: true,
        });
      }
      
      // 标记已同步的数据
      for (const syncResult of result.syncResults) {
        if (syncResult.status === 'created' || syncResult.status === 'updated') {
          await storage.markMistakeSynced(syncResult.id);
        }
      }
      
      // 更新同步时间
      await storage.setLastSyncTime(result.syncTime);
      
      Alert.alert('成功', '数据同步完成');
    } catch (error: any) {
      Alert.alert('同步失败', error.message || '请稍后重试');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      '确认清除',
      '确定要清除本地缓存吗？这不会影响云端数据。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAllLocalData();
            Alert.alert('成功', '本地缓存已清除');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息卡片 */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.username}>{user?.username || '加载中...'}</Text>
        {user?.createdAt && (
          <Text style={styles.joinDate}>
            注册于 {new Date(user.createdAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* 统计信息 */}
      {user?.stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.totalMistakes}</Text>
            <Text style={styles.statLabel}>错题总数</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.bySubject?.math || 0}</Text>
            <Text style={styles.statLabel}>数学</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.bySubject?.physics || 0}</Text>
            <Text style={styles.statLabel}>物理</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.bySubject?.chemistry || 0}</Text>
            <Text style={styles.statLabel}>化学</Text>
          </View>
        </View>
      )}

      {/* 功能列表 */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={handleSync}>
          <Text style={styles.menuIcon}>🔄</Text>
          <Text style={styles.menuText}>同步数据</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
          <Text style={styles.menuIcon}>🗑️</Text>
          <Text style={styles.menuText}>清除缓存</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>ℹ️</Text>
          <Text style={styles.menuText}>关于</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 退出按钮 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>退出登录</Text>
      </TouchableOpacity>

      {/* 版本信息 */}
      <Text style={styles.versionText}>高考冲刺助手 v1.0.0</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  userCard: {
    backgroundColor: '#3b82f6',
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  menuContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
  },
  menuArrow: {
    fontSize: 20,
    color: '#9ca3af',
  },
  logoutButton: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
  },
});

