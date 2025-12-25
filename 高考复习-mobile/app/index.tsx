/**
 * 应用入口 - 自动重定向
 */

import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as api from '@/services/api';

export default function Index() {
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await api.getToken();
            if (token) {
                await api.getCurrentUser();
                setIsLoggedIn(true);
            }
        } catch (error) {
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

    // 根据登录状态重定向
    if (isLoggedIn) {
        return <Redirect href="/(tabs)/notes" />;
    } else {
        return <Redirect href="/(auth)/login" />;
    }
}

