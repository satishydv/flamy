import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { setAuthToken } from '@/constants/api';

WebBrowser.maybeCompleteAuthSession();

export default function AuthRedirectHandler() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; flow?: string; auth_error?: string }>();

  useEffect(() => {
    async function processAuth() {
      let token = params.token ? String(params.token) : null;

      // In case params were not parsed by router, extract directly from deep link URL
      if (!token) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const match = initialUrl.match(/[?&]token=([^&#]+)/);
          if (match) {
            token = decodeURIComponent(match[1]);
          }
        }
      }

      if (token) {
        console.log('[AUTH REDIRECT] Session token captured successfully');
        setAuthToken(token);
      }

      // Notify any waiting WebBrowser auth session
      WebBrowser.maybeCompleteAuthSession();

      // Navigate to main application with auth params
      router.replace({
        pathname: '/',
        params: {
          token: token || '',
          flow: params.flow || 'login',
        },
      });
    }

    processAuth();
  }, [params.token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FE3C72" />
      <Text style={styles.text}>Completing Sign In...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
