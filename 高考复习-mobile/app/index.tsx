/**
 * 应用入口 - 自动重定向到登录页
 */

import { Redirect } from 'expo-router';

export default function Index() {
  // 直接重定向到登录页面，让登录页面处理认证逻辑
  return <Redirect href="/(auth)/login" />;
}
