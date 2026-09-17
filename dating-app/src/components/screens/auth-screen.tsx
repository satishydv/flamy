import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import Svg, { Circle, Path } from 'react-native-svg';
import { BACKEND_URL, API_ENDPOINTS, setAuthToken } from '@/constants/api';

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  image?: string | null;
}

interface AuthScreenProps {
  onBack: () => void;
  onLoginSuccess: (user?: AuthUser) => void;
  onSignUpSuccess: (user?: AuthUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBack,
  onLoginSuccess,
  onSignUpSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes = 600s
  const [loginWithOtp, setLoginWithOtp] = useState(false);

  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setOtpSent(false);
    setOtp('');
    setLoginWithOtp(false);
  };

  // Live 10-minute countdown timer
  useEffect(() => {
    let timer: any;
    if (otpSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Direct Phone + Password Login
  const handleLoginWithPassword = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      showAlert('Invalid Phone', 'Please enter your 10-digit mobile number.');
      return;
    }
    if (!password) {
      showAlert('Password Required', 'Please enter your account password.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(API_ENDPOINTS.login, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        if (data.token) {
          setAuthToken(data.token);
        }
        const authUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email || '',
          phoneNumber: data.user.phoneNumber,
          image: data.user.image,
        };
        showAlert('Logged In! 🎉', `Welcome back, ${authUser.name}!`);
        onLoginSuccess(authUser);
      } else {
        showAlert('Login Failed', data.message || 'Invalid mobile number or password.');
      }
    } catch (err: any) {
      showAlert('Connection Error', `Could not connect to backend server at ${BACKEND_URL}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      showAlert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (mode === 'signup') {
      if (!fullName.trim()) {
        showAlert('Name Required', 'Please enter your full name for sign up.');
        return;
      }
      if (!password || password.length < 6) {
        showAlert('Password Required', 'Please create a password with at least 6 characters.');
        return;
      }
    }

    try {
      setIsLoading(true);
      const res = await fetch(API_ENDPOINTS.sendOtp, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, mode }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setCountdown(600); // 10 minutes
        showAlert('OTP Sent! 📲', `A 6-digit verification code has been sent to +91 ${cleanPhone}. It is valid for 10 minutes.`);
      } else {
        showAlert('Error', data.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      showAlert('Connection Error', `Could not connect to backend server at ${BACKEND_URL}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanPhone = phone.trim();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      showAlert('Invalid OTP', 'Please enter the 6-digit verification code sent to your phone.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(API_ENDPOINTS.verifyOtp, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          otp: cleanOtp,
          name: mode === 'signup' ? fullName.trim() : undefined,
          password: mode === 'signup' ? password : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        if (data.token) {
          setAuthToken(data.token);
        }
        const authUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email || '',
          phoneNumber: data.user.phoneNumber,
          image: data.user.image,
        };
        showAlert('Verified! 🎉', mode === 'signup' ? `Welcome ${authUser.name}! Account created.` : `Welcome back, ${authUser.name}!`);
        if (mode === 'signup') {
          onSignUpSuccess(authUser);
        } else {
          onLoginSuccess(authUser);
        }
      } else {
        showAlert('Verification Failed', data.message || 'Incorrect OTP code. Please try again.');
      }
    } catch (err: any) {
      showAlert('Connection Error', 'Failed to connect to auth backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_ENDPOINTS.resendOtp, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCountdown(600);
        showAlert('OTP Resent! 📲', 'A fresh 6-digit code has been sent to your mobile number.');
      } else {
        showAlert('Error', data.message || 'Failed to resend OTP.');
      }
    } catch (e: any) {
      showAlert('Error', 'Could not resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const [isSocialLoading, setIsSocialLoading] = useState(false);

  const handleSocialAuth = async (providerName: 'google' | 'facebook') => {
    try {
      setIsSocialLoading(true);
      // Clear any previous stale session token before starting fresh social authentication
      setAuthToken(null);

      const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
      const origin = isWeb
        ? window.location.origin
        : (BACKEND_URL || 'https://backend.ckinfynity.shop');

      // On Web: use browser window.location.origin
      // On Mobile (Android / iOS in Expo): use Expo deep link (exp://... or datingapp://...)
      const callbackURL = isWeb
        ? `${window.location.origin}?flow=${mode}`
        : Linking.createURL('/', { queryParams: { flow: mode } });

      const errorCallbackURL = isWeb
        ? `${window.location.origin}?auth_error=true`
        : Linking.createURL('/', { queryParams: { auth_error: 'true' } });

      const res = await fetch(API_ENDPOINTS.socialSignIn, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Referer: origin,
        },
        body: JSON.stringify({
          provider: providerName,
          callbackURL,
          errorCallbackURL,
        }),
      });

      const data = await res.json();
      if (data.url) {
        if (isWeb) {
          window.location.href = data.url;
        } else {
          const WebBrowser = await import('expo-web-browser');
          const result = await WebBrowser.openAuthSessionAsync(data.url, callbackURL);
          if (result.type === 'success') {
            // Extract the new session token returned from the OAuth redirect URL
            let newToken: string | null = null;
            if (result.url) {
              try {
                const parsed = Linking.parse(result.url);
                if (parsed.queryParams?.token) {
                  newToken = String(parsed.queryParams.token);
                }
              } catch (e) {}

              if (!newToken) {
                const match = result.url.match(/[?&]token=([^&#]+)/);
                if (match) {
                  newToken = decodeURIComponent(match[1]);
                }
              }
            }

            if (newToken) {
              setAuthToken(newToken);
            }

            // Hydrate user session from backend with the new token
            try {
              const headers: Record<string, string> = {};
              if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                headers['x-session-token'] = newToken;
              }

              const sessionRes = await fetch(API_ENDPOINTS.getSession, {
                credentials: 'include',
                headers,
              });
              const sessionData = await sessionRes.json();
              if (sessionData?.user) {
                if (mode === 'signup') {
                  onSignUpSuccess(sessionData.user);
                } else {
                  onLoginSuccess(sessionData.user);
                }
                return;
              }
            } catch (sErr) {
              console.log('[AUTH] Session hydration after social auth notice:', sErr);
            }

            if (mode === 'signup') {
              onSignUpSuccess();
            } else {
              onLoginSuccess();
            }
          }
        }
      } else {
        const errorMsg =
          data.message || `Failed to initiate ${providerName} login. Please check configuration.`;
        if (isWeb) {
          window.alert(errorMsg);
        } else {
          Alert.alert('Authentication Error', errorMsg);
        }
      }
    } catch (error: any) {
      console.error('Social auth error:', error);
      const errorMsg =
        `Could not connect to auth backend at ${BACKEND_URL}. Please make sure the backend server is running.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Connection Error', errorMsg);
      }
    } finally {
      setIsSocialLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Floating Glass Back Button at Top-Left (preserves clean layout like 1st image) */}
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.floatingBackBtn}
        onPress={onBack}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.03)']}
          style={styles.floatingBackGradient}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Glowing Halo Logo */}
        <View style={styles.logoContainer}>
          {/* Ambient Glow */}
          <View style={styles.logoAmbientGlow} />

          <LinearGradient
            colors={['#FF0077', '#FF176B', '#F43F5E']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.logoCircle}
          >
            <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
              {/* Smiling face outline */}
              <Circle cx="12" cy="12" r="9" stroke="#FFFFFF" strokeWidth="2" />
              {/* Eyes */}
              <Circle cx="8.5" cy="10" r="1.3" fill="#FFFFFF" />
              <Circle cx="15.5" cy="10" r="1.3" fill="#FFFFFF" />
              {/* Smile */}
              <Path
                d="M8.5 14.5C9.5 16.2 11 16.8 12 16.8C13 16.8 14.5 16.2 15.5 14.5"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Heart in top right corner */}
              <Path
                d="M19 4.5C18 3.5 16.5 4 16.5 5.2C16.5 6.5 19 8 19 8C19 8 21.5 6.5 21.5 5.2C21.5 4 20 3.5 19 4.5Z"
                fill="#FFFFFF"
              />
            </Svg>
          </LinearGradient>
        </View>

        {/* Headings */}
        <Text style={styles.title}>Login or Sign Up Now</Text>
        <Text style={styles.subtitle}>
          Your next match is waiting. Sign in or create an account to start your journey.
        </Text>

        {/* Segmented Toggle with Glassmorphism & Specular Top Edge */}
        <View style={styles.segmentOuterGlass}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
            style={styles.segmentInnerGradient}
          >
            {/* Log In Tab */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.segmentTab}
              onPress={() => handleModeSwitch('login')}
            >
              {mode === 'login' ? (
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.06)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.activeTabGlass}
                >
                  <Text style={styles.activeTabText}>Log In</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.inactiveTabText}>Log In</Text>
              )}
            </TouchableOpacity>

            {/* Sign up Tab */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.segmentTab}
              onPress={() => handleModeSwitch('signup')}
            >
              {mode === 'signup' ? (
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.06)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.activeTabGlass}
                >
                  <Text style={styles.activeTabText}>Sign up</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.inactiveTabText}>Sign up</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* Full Name for Sign up */}
          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.glassInputContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.glassInputGradient}
                >
                  <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your Full Name"
                    placeholderTextColor="#64748B"
                    editable={!otpSent}
                  />
                </LinearGradient>
              </View>
            </View>
          )}

          {/* Mobile Number Field */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Mobile Number</Text>
              {otpSent && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                >
                  <Text style={styles.changePhoneText}>Change Number</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.phoneInputRow}>
              {/* Country Code Badge */}
              <View style={styles.countryCodeBadge}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.04)']}
                  style={styles.countryCodeGradient}
                >
                  <Text style={styles.countryFlag}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </LinearGradient>
              </View>

              {/* Phone Input Box */}
              <View style={styles.phoneInputContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.11)', 'rgba(255, 255, 255, 0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.glassInputGradient}
                >
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                    placeholder="98765 43210"
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpSent}
                  />
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Password Field:
              Shown on Sign Up (always, unless OTP already sent),
              and shown on Login (when not in OTP-only mode) */}
          {((mode === 'signup' && !otpSent) || (mode === 'login' && !loginWithOtp)) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {mode === 'signup' ? 'Set Password' : 'Password'}
              </Text>
              <View style={styles.glassInputContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.11)', 'rgba(255, 255, 255, 0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.glassInputGradient}
                >
                  <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder={mode === 'signup' ? 'Create password (min 6 chars)' : '••••••••••••'}
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          )}

          {/* Options Row (Remember Me & Login via OTP) for Login mode */}
          {mode === 'login' && !loginWithOtp && (
            <View style={styles.optionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.rememberMeRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.glassCheckbox, rememberMe && styles.glassCheckboxChecked]}>
                  {rememberMe && <View style={styles.checkboxInnerDot} />}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setLoginWithOtp(true);
                  setOtpSent(false);
                  setOtp('');
                }}
              >
                <Text style={styles.forgotPasswordText}>Login via OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* OTP Verification Section (Revealed when OTP is sent) */}
          {otpSent && (
            <View style={styles.otpSection}>
              <View style={styles.otpHeaderRow}>
                <Text style={styles.label}>6-Digit Verification Code</Text>
                <View style={styles.timerBadge}>
                  <Ionicons name="time-outline" size={13} color="#FF0077" />
                  <Text style={styles.timerText}>{formatTime(countdown)}</Text>
                </View>
              </View>

              <View style={styles.glassInputContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.11)', 'rgba(255, 255, 255, 0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.glassInputGradient}
                >
                  <Ionicons name="shield-checkmark-outline" size={19} color="#FF0077" style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ''))}
                    placeholder="••••••"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </LinearGradient>
              </View>

              <View style={styles.resendRow}>
                <Text style={styles.resendPrompt}>Didn't receive SMS?</Text>
                {countdown > 0 ? (
                  <Text style={styles.resendCountdown}>Resend in {formatTime(countdown)}</Text>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isLoading}
                    onPress={handleResendOtp}
                  >
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.swipeBtn, isLoading && { opacity: 0.7 }]}
            disabled={isLoading}
            onPress={() => {
              if (mode === 'login' && !loginWithOtp) {
                handleLoginWithPassword();
              } else if (otpSent) {
                handleVerifyOtp();
              } else {
                handleSendOtp();
              }
            }}
          >
            <LinearGradient
              colors={['#FF0077', '#FF176B', '#F43F5E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.swipeGradient}
            >
              <View style={styles.heartThumb}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FF0077" />
                ) : (
                  <Ionicons
                    name={
                      mode === 'login' && !loginWithOtp
                        ? 'log-in-outline'
                        : otpSent
                        ? 'checkmark'
                        : 'arrow-forward'
                    }
                    size={22}
                    color="#FF0077"
                  />
                )}
              </View>

              <Text style={styles.swipeText}>
                {isLoading
                  ? 'Please wait...'
                  : mode === 'login' && !loginWithOtp
                  ? 'Log In'
                  : otpSent
                  ? mode === 'signup'
                    ? 'Verify & Create Account'
                    : 'Verify & Login'
                  : 'Send OTP'}
              </Text>

              <View style={styles.chevronsRow}>
                <Ionicons name="chevron-forward" size={17} color="rgba(255, 255, 255, 0.45)" />
                <Ionicons name="chevron-forward" size={17} color="rgba(255, 255, 255, 0.75)" style={{ marginLeft: -9 }} />
                <Ionicons name="chevron-forward" size={17} color="#FFFFFF" style={{ marginLeft: -9 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Toggle between Password Login and OTP Login */}
          {mode === 'login' && (
            <View style={styles.toggleLoginModeRow}>
              <Text style={styles.toggleLoginModeText}>
                {loginWithOtp ? 'Remember your password?' : 'Want to login without password?'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setLoginWithOtp(!loginWithOtp);
                  setOtpSent(false);
                  setOtp('');
                }}
              >
                <Text style={styles.toggleLoginModeHighlight}>
                  {loginWithOtp ? 'Login with Password' : 'Login via SMS OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Or Sign In With Divider */}
        <Text style={styles.socialDividerText}>Or Sign in with</Text>

        {/* Social Buttons with Glass Specular Rims (Google & Facebook) */}
        <View style={styles.socialRow}>
          {/* Facebook */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.socialGlassBtn, isSocialLoading && { opacity: 0.6 }]}
            disabled={isSocialLoading}
            onPress={() => handleSocialAuth('facebook')}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)']}
              style={styles.socialGradient}
            >
              <Ionicons name="logo-facebook" size={25} color="#1877F2" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.socialGlassBtn, isSocialLoading && { opacity: 0.6 }]}
            disabled={isSocialLoading}
            onPress={() => handleSocialAuth('google')}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)']}
              style={styles.socialGradient}
            >
              <Ionicons name="logo-google" size={23} color="#EA4335" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  floatingBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 20,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 4px 12px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  floatingBackGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 20,
    marginTop: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoAmbientGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FF0077',
    opacity: 0.35,
    ...Platform.select({
      web: {
        filter: 'blur(20px)',
      },
    }),
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(255, 0, 119, 0.5)',
      },
      default: {
        shadowColor: '#FF0077',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
    marginBottom: 26,
  },
  segmentOuterGlass: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 26,
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.15), 0 6px 18px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  segmentInnerGradient: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 30,
  },
  segmentTab: {
    flex: 1,
    height: 48,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabGlass: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.35), 0 4px 14px rgba(0, 0, 0, 0.45)',
      },
    }),
  },
  activeTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inactiveTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71798E',
  },
  formContainer: {
    width: '100%',
    gap: 18,
    marginBottom: 28,
  },
  inputGroup: {
    width: '100%',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  glassInputContainer: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.2), 0 6px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  glassInputGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  input: {
    fontSize: 14,
    color: '#FFFFFF',
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changePhoneText: {
    fontSize: 12,
    color: '#FF176B',
    fontWeight: '600',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  countryCodeBadge: {
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.2), 0 6px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  countryCodeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  phoneInputContainer: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.2), 0 6px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  otpSection: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 0, 119, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 119, 0.3)',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF0077',
  },
  otpInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    color: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  resendPrompt: {
    fontSize: 12,
    color: '#94A3B8',
  },
  resendCountdown: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 12,
    color: '#FF176B',
    fontWeight: '700',
  },
  eyeBtn: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -2,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glassCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 1.5px rgba(255, 255, 255, 0.2)',
      },
    }),
  },
  glassCheckboxChecked: {
    backgroundColor: 'rgba(255, 0, 119, 0.2)',
    borderColor: '#FF0077',
  },
  checkboxInnerDot: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
    backgroundColor: '#FF0077',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#FF176B',
    fontWeight: '600',
  },
  toggleLoginModeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleLoginModeText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  toggleLoginModeHighlight: {
    fontSize: 13,
    color: '#FF176B',
    fontWeight: '700',
    marginLeft: 6,
  },
  swipeBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.35), 0 8px 26px rgba(255, 0, 119, 0.45)',
      },
      default: {
        shadowColor: '#FF0077',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },
  swipeBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  swipeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
  },
  heartThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  swipeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chevronsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  socialDividerText: {
    fontSize: 13,
    color: '#788296',
    fontWeight: '500',
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  socialGlassBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderTopWidth: 1.8,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 1.5px rgba(255, 255, 255, 0.25), 0 6px 18px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  socialGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
