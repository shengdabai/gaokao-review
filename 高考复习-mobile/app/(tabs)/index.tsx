/**
 * Tabs 默认入口 - 重定向到笔记页
 */

import { Redirect } from 'expo-router';

export default function TabsIndex() {
    return <Redirect href="/(tabs)/notes" />;
}

