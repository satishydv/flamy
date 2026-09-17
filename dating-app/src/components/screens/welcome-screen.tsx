import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const { width, height } = Dimensions.get('window');

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  return (
    <View style={styles.container}>
      {/* Background Hero Image */}
      <View style={styles.heroImageContainer}>
        <Image
          source={require('@/assets/images/welcome_hero.jpg')}
          style={styles.heroImage}
          contentFit="cover"
          priority="high"
        />

        {/* Top Gradient for text contrast */}
        <LinearGradient
          colors={['rgba(2, 132, 199, 0.45)', 'rgba(56, 189, 248, 0.1)', 'transparent']}
          style={styles.topGradient}
        />

        {/* Logo & Headline Overlay */}
        <View style={styles.topOverlay}>
          {/* Brand Logo */}
          <View style={styles.brandRow}>
            <Ionicons name="location-sharp" size={20} color="#FFFFFF" />
            <Text style={styles.brandText}>happn</Text>
          </View>

          {/* Stylized Puffy Clouds Title */}
          <View style={styles.headlineWrapper}>
            <View style={styles.sparkleRow}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" style={styles.sparkleIcon} />
              <Text style={styles.weText}>WE</Text>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" style={styles.sparkleIconRight} />
            </View>
            <Text style={styles.crossedText}>CROSSED</Text>
            <Text style={styles.pathsText}>PATHS</Text>
          </View>
        </View>
      </View>

      {/* Bottom Sheet Card */}
      <View style={styles.bottomCardWrapper}>
        <LinearGradient
          colors={['#E0F2FE', '#F0F9FF', '#FFFFFF']}
          style={styles.bottomCardGradient}
        >
          <View style={styles.dragHandle} />

          <Text style={styles.cardTitle}>Your Perfect Match Is{'\n'}One Swipe Away</Text>

          <Text style={styles.cardSubtitle}>
            Discover genuine connections, meaningful chats, and exciting dating opportunities ahead
          </Text>

          {/* CTA Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.getStartedButton}
            onPress={onGetStarted}
          >
            <View style={styles.arrowCircle}>
              <Ionicons name="arrow-forward" size={20} color="#0F172A" />
            </View>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#38BDF8',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 220,
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headlineWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkleIcon: {
    transform: [{ rotate: '-15deg' }],
  },
  sparkleIconRight: {
    transform: [{ rotate: '20deg' }],
    marginTop: -8,
  },
  weText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    ...Platform.select({
      web: {
        textShadow: '0 3px 8px rgba(14, 165, 233, 0.7)',
      },
      default: {
        textShadowColor: 'rgba(14, 165, 233, 0.7)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 8,
      },
    }),
  },
  crossedText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    lineHeight: 52,
    ...Platform.select({
      web: {
        textShadow: '0 4px 10px rgba(14, 165, 233, 0.7)',
      },
      default: {
        textShadowColor: 'rgba(14, 165, 233, 0.7)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
      },
    }),
  },
  pathsText: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    lineHeight: 48,
    ...Platform.select({
      web: {
        textShadow: '0 4px 10px rgba(14, 165, 233, 0.7)',
      },
      default: {
        textShadowColor: 'rgba(14, 165, 233, 0.7)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
      },
    }),
  },
  bottomCardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 -10px 40px rgba(14, 165, 233, 0.25)',
      },
      default: {
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 16,
      },
    }),
  },
  bottomCardGradient: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#BAE6FD',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    maxWidth: 340,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 32,
    height: 60,
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 8,
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  arrowCircle: {
    position: 'absolute',
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
