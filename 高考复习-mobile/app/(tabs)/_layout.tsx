/**
 * Tab 导航布局
 */

import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

// Tab 图标组件
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#6366f1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="tutor"
        options={{
          title: 'AI 导师',
          headerTitle: '高考冲刺 · AI 导师',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: '拍题',
          headerTitle: '高考冲刺 · AI 拍题',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: '笔记',
          headerTitle: '高考冲刺 · 知识点',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '错题',
          headerTitle: '高考冲刺 · 错题本',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          headerTitle: '个人中心',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

