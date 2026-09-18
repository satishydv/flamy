import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { setAuthToken } from '@/constants/api';

WebBrowser.maybeCompleteAuthSession();

export default function NotFoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    async function handleFallback() {
      let token = params.token ? String(params.token) : null;
      if (!token) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const match = initialUrl.match(/[?&]token=([^&#]+)/);
          if (match) token = decodeURIComponent(match[1]);
        }
      }
      if (token) {
        setAuthToken(token);
      }
      WebBrowser.maybeCompleteAuthSession();
      router.replace({
        pathname: '/',
        params: {
          token: token || '',
          flow: 'login',
        },
      });
    }
    handleFallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FE3C72" />
      <Text style={styles.text}>Redirecting...</Text>
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
