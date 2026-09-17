import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { ONBOARDING_QUESTIONS } from '@/constants/mock-data';
import { UserPreferences, OnboardingBasics } from '@/types';

interface MatchQuestionsScreenProps {
  onBackToWelcome?: () => void;
  onComplete: (preferences: UserPreferences, basics: OnboardingBasics) => void;
  onSkip: () => void;
  initialPreferences?: Partial<UserPreferences>;
  initialBasics?: Partial<OnboardingBasics>;
}

export const MatchQuestionsScreen: React.FC<MatchQuestionsScreenProps> = ({
  onBackToWelcome,
  onComplete,
  onSkip,
  initialPreferences,
  initialBasics,
}) => {
  // Step 1 is "Basics & Identity", Steps 2 to 6 are the 5 compatibility questions
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // --- STEP 1: BASICS STATE ---
  const [fullName, setFullName] = useState(initialBasics?.name || '');
  const [dobDay, setDobDay] = useState('15');
  const [dobMonth, setDobMonth] = useState('06');
  const [dobYear, setDobYear] = useState('1999');
  const [gender, setGender] = useState<'Woman' | 'Man' | 'Non-Binary'>(
    (initialBasics?.gender as any) || 'Woman'
  );
  const [lookingFor, setLookingFor] = useState<string[]>(
    initialBasics?.lookingFor || ['Man']
  );
  const [locationCity, setLocationCity] = useState(initialBasics?.location || 'Central London');
  const [userCoords, setUserCoords] = useState<{ latitude?: number; longitude?: number }>({
    latitude: initialBasics?.latitude,
    longitude: initialBasics?.longitude,
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // --- STEPS 2 to 6: COMPATIBILITY PREFERENCES ---
  const [selectedGoal, setSelectedGoal] = useState<string>(
    initialPreferences?.datingGoal || ONBOARDING_QUESTIONS.step1.options[0].title
  );
  const [selectedPersonality, setSelectedPersonality] = useState<string>(
    initialPreferences?.personality || ONBOARDING_QUESTIONS.step2.options[1].title
  );
  const [selectedPartnerTrait, setSelectedPartnerTrait] = useState<string>(
    initialPreferences?.partnerTraits || ONBOARDING_QUESTIONS.step3.options[1].title
  );
  const [selectedMusic, setSelectedMusic] = useState<string>(
    initialPreferences?.musicPreference || ONBOARDING_QUESTIONS.step4.options[0].title
  );
  const [selectedDealBreaker, setSelectedDealBreaker] = useState<string>(
    initialPreferences?.dealBreakers || ONBOARDING_QUESTIONS.step5.options[2].title
  );

  // Helper to compute age from day, month, year
  const calculateAge = (): number | null => {
    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);
    if (!day || !month || !year || year < 1920 || year > new Date().getFullYear()) {
      return null;
    }
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculatedAge = calculateAge();

  // Location Auto-detection handler
  const handleDetectLocation = async () => {
    try {
      setIsDetectingLocation(true);

      // Web Browser standard Geolocation API
      if (Platform.OS === 'web' && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setUserCoords({ latitude: lat, longitude: lon });

            try {
              // Reverse geocode via free OpenStreetMap Nominatim API
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
              );
              const data = await res.json();
              const city =
                data.address?.city ||
                data.address?.town ||
                data.address?.suburb ||
                data.address?.state_district ||
                'London';
              const country = data.address?.country || 'UK';
              setLocationCity(`${city}, ${country}`);
            } catch {
              setLocationCity('Current Location');
            }
            setIsDetectingLocation(false);
          },
          (err) => {
            console.warn('Web geolocation error:', err);
            setIsDetectingLocation(false);
            Alert.alert(
              'Location Access',
              'Could not auto-detect location. Please type your city name manually.'
            );
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
        return;
      }

      // Native Expo Location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsDetectingLocation(false);
        Alert.alert(
          'Permission Denied',
          'Location permission helps find matches nearby. You can type your city manually.'
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo) {
        const city = geo.city || geo.subregion || geo.region || 'Nearby';
        const country = geo.country || '';
        setLocationCity(`${city}${country ? `, ${country}` : ''}`);
      }
    } catch (err: any) {
      console.warn('Location detection failed:', err);
      Alert.alert('GPS Notice', 'Could not detect GPS. Please enter your city name.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const toggleLookingFor = (item: string) => {
    if (item === 'Everyone') {
      setLookingFor(['Everyone']);
      return;
    }
    if (lookingFor.includes('Everyone')) {
      setLookingFor([item]);
      return;
    }
    if (lookingFor.includes(item)) {
      if (lookingFor.length > 1) {
        setLookingFor(lookingFor.filter((g) => g !== item));
      }
    } else {
      setLookingFor([...lookingFor, item]);
    }
  };

  const handleNext = () => {
    // Validate Step 1
    if (step === 1) {
      if (!fullName.trim()) {
        Alert.alert('Name Required', 'Please enter your full name to proceed.');
        return;
      }
      if (!calculatedAge || calculatedAge < 18) {
        Alert.alert(
          'Age Requirement',
          'You must be at least 18 years old to join. Please check your Date of Birth.'
        );
        return;
      }
      if (!locationCity.trim()) {
        Alert.alert('Location Required', 'Please enter your location or detect your GPS.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else {
      // Step 6 completed!
      const dobFormatted = `${dobYear.trim()}-${dobMonth.trim().padStart(2, '0')}-${dobDay
        .trim()
        .padStart(2, '0')}`;

      onComplete(
        {
          datingGoal: selectedGoal,
          personality: selectedPersonality,
          partnerTraits: selectedPartnerTrait,
          musicPreference: selectedMusic,
          dealBreakers: selectedDealBreaker,
        },
        {
          name: fullName.trim(),
          dob: dobFormatted,
          gender: gender,
          lookingFor: lookingFor,
          location: locationCity.trim(),
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
        }
      );
    }
  };

  const handleBack = () => {
    if (step === 6) setStep(5);
    else if (step === 5) setStep(4);
    else if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else if (onBackToWelcome) onBackToWelcome();
  };

  // Step 2 to 6 data from ONBOARDING_QUESTIONS
  const currentStepData =
    step === 2
      ? ONBOARDING_QUESTIONS.step1
      : step === 3
      ? ONBOARDING_QUESTIONS.step2
      : step === 4
      ? ONBOARDING_QUESTIONS.step3
      : step === 5
      ? ONBOARDING_QUESTIONS.step4
      : ONBOARDING_QUESTIONS.step5;

  const currentSelection =
    step === 2
      ? selectedGoal
      : step === 3
      ? selectedPersonality
      : step === 4
      ? selectedPartnerTrait
      : step === 5
      ? selectedMusic
      : selectedDealBreaker;

  const handleSelectOption = (title: string) => {
    if (step === 2) setSelectedGoal(title);
    else if (step === 3) setSelectedPersonality(title);
    else if (step === 4) setSelectedPartnerTrait(title);
    else if (step === 5) setSelectedMusic(title);
    else if (step === 6) setSelectedDealBreaker(title);
  };

  // Helper to render title with highlighted keyword for steps 2 to 6
  const renderHighlightedTitle = () => {
    if (step === 1) return null;
    const fullTitle = currentStepData.title;
    const highlight = currentStepData.highlightWord;

    if (!fullTitle.includes(highlight)) {
      return <Text style={styles.titleText}>{fullTitle}</Text>;
    }

    const parts = fullTitle.split(highlight);
    return (
      <Text style={styles.titleText}>
        {parts[0]}
        <Text style={styles.highlightText}>{highlight}</Text>
        {parts[1]}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header: Progress Bar & Actions */}
        <View style={styles.topHeader}>
          {/* Back Button */}
          <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          {/* 6-Segment Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressBarSegment,
                  step >= i ? styles.progressBarFilled : styles.progressBarEmpty,
                ]}
              />
            ))}
          </View>

          {/* Skip Button */}
          <TouchableOpacity activeOpacity={0.7} style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── STEP 1: BASICS FORM (Name, DOB, Gender, Looking For, Location) ── */}
        {step === 1 ? (
          <ScrollView
            style={styles.optionsScrollView}
            contentContainerStyle={styles.basicsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContent}>
              <Text style={styles.stepLabel}>STEP 1 OF 6</Text>
              <Text style={styles.titleText}>
                Tell us about <Text style={styles.highlightText}>yourself</Text>
              </Text>
              <Text style={styles.descriptionText}>
                We use this to verify your age, set up your profile, and find your closest matches nearby.
              </Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="person-outline" size={20} color="#0284C7" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Jenny Wilson"
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Date of Birth (DD / MM / YYYY) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                {calculatedAge !== null ? (
                  <View
                    style={[
                      styles.ageBadge,
                      calculatedAge >= 18 ? styles.ageBadgeValid : styles.ageBadgeInvalid,
                    ]}
                  >
                    <Ionicons
                      name={calculatedAge >= 18 ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={calculatedAge >= 18 ? '#16A34A' : '#DC2626'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.ageBadgeText,
                        calculatedAge >= 18 ? styles.ageBadgeTextValid : styles.ageBadgeTextInvalid,
                      ]}
                    >
                      {calculatedAge >= 18 ? `${calculatedAge} years old` : 'Must be 18+'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.dobRow}>
                <View style={styles.dobBox}>
                  <Text style={styles.dobSubLabel}>DAY</Text>
                  <TextInput
                    style={styles.dobInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="15"
                    placeholderTextColor="#94A3B8"
                    value={dobDay}
                    onChangeText={setDobDay}
                  />
                </View>

                <View style={styles.dobBox}>
                  <Text style={styles.dobSubLabel}>MONTH</Text>
                  <TextInput
                    style={styles.dobInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="06"
                    placeholderTextColor="#94A3B8"
                    value={dobMonth}
                    onChangeText={setDobMonth}
                  />
                </View>

                <View style={[styles.dobBox, { flex: 1.5 }]}>
                  <Text style={styles.dobSubLabel}>YEAR</Text>
                  <TextInput
                    style={styles.dobInput}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="1999"
                    placeholderTextColor="#94A3B8"
                    value={dobYear}
                    onChangeText={setDobYear}
                  />
                </View>
              </View>
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>I am a</Text>
              <View style={styles.pillsRow}>
                {(['Woman', 'Man', 'Non-Binary'] as const).map((g) => {
                  const isSelected = gender === g;
                  const emoji = g === 'Woman' ? '👩' : g === 'Man' ? '👨' : '🧑';
                  return (
                    <TouchableOpacity
                      key={g}
                      activeOpacity={0.8}
                      style={[
                        styles.pillOption,
                        isSelected ? styles.pillOptionSelected : styles.pillOptionUnselected,
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={styles.pillEmoji}>{emoji}</Text>
                      <Text
                        style={[
                          styles.pillText,
                          isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Looking For */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>I'm looking for</Text>
              <View style={styles.pillsRow}>
                {['Men', 'Women', 'Everyone'].map((opt) => {
                  const isSelected = lookingFor.includes(opt);
                  const emoji = opt === 'Men' ? '👨' : opt === 'Women' ? '👩' : '✨';
                  return (
                    <TouchableOpacity
                      key={opt}
                      activeOpacity={0.8}
                      style={[
                        styles.pillOption,
                        isSelected ? styles.pillOptionSelected : styles.pillOptionUnselected,
                      ]}
                      onPress={() => toggleLookingFor(opt)}
                    >
                      <Text style={styles.pillEmoji}>{emoji}</Text>
                      <Text
                        style={[
                          styles.pillText,
                          isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                        ]}
                      >
                        {opt}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#0284C7"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location & GPS */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Location</Text>
                {userCoords.latitude ? (
                  <View style={styles.gpsActivePill}>
                    <Ionicons name="navigate" size={12} color="#0284C7" style={{ marginRight: 3 }} />
                    <Text style={styles.gpsActiveText}>GPS Pinned</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.inputFieldWrapper}>
                <Ionicons name="location-outline" size={20} color="#0284C7" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Notting Hill, London"
                  placeholderTextColor="#94A3B8"
                  value={locationCity}
                  onChangeText={setLocationCity}
                />
              </View>

              {/* GPS Auto-detect Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.gpsDetectButton}
                onPress={handleDetectLocation}
                disabled={isDetectingLocation}
              >
                {isDetectingLocation ? (
                  <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="locate" size={18} color="#0284C7" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.gpsDetectText}>
                  {isDetectingLocation ? 'Detecting GPS...' : '📍 Auto-detect My Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          /* ── STEPS 2 to 6: COMPATIBILITY QUESTION LIST ── */
          <>
            <View style={styles.headerContent}>
              <Text style={styles.stepLabel}>{currentStepData.stepLabel.replace('5', '6')}</Text>
              {renderHighlightedTitle()}
              <Text style={styles.descriptionText}>{currentStepData.description}</Text>
            </View>

            <ScrollView
              style={styles.optionsScrollView}
              contentContainerStyle={styles.optionsList}
              showsVerticalScrollIndicator={false}
            >
              {currentStepData.options.map((option) => {
                const isSelected = currentSelection === option.title;

                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.85}
                    style={[
                      styles.optionCard,
                      isSelected ? styles.optionCardSelected : styles.optionCardUnselected,
                    ]}
                    onPress={() => handleSelectOption(option.title)}
                  >
                    {/* Left Emoji / Icon Badge */}
                    <View
                      style={[
                        styles.iconBadge,
                        isSelected ? styles.iconBadgeSelected : styles.iconBadgeUnselected,
                      ]}
                    >
                      <Text style={styles.emojiText}>{option.emoji}</Text>
                    </View>

                    {/* Option Title */}
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected ? styles.optionTitleSelected : styles.optionTitleUnselected,
                      ]}
                    >
                      {option.title}
                    </Text>

                    {/* Radio Selector */}
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected ? styles.radioCircleSelected : styles.radioCircleUnselected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInnerDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Bottom Bar with Signature Pill Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity activeOpacity={0.85} style={styles.continueButton} onPress={handleNext}>
            <LinearGradient
              colors={['#0284C7', '#0EA5E9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueGradient}
            >
              {/* Left Circular Icon Badge */}
              <View style={styles.buttonLeftCircle}>
                <Ionicons name="heart" size={18} color="#0284C7" />
              </View>

              {/* Center Text */}
              <Text style={styles.continueText}>
                {step === 6 ? 'Find My Matches' : 'Continue'}
              </Text>

              {/* Right Triple Chevron */}
              <View style={styles.buttonRightChevrons}>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color="#FFFFFF"
                  style={{ opacity: 0.5, marginRight: -6 }}
                />
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#FFFFFF"
                  style={{ opacity: 0.8, marginRight: -6 }}
                />
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 14,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  progressBarSegment: {
    flex: 1,
    height: 4.5,
    borderRadius: 3,
  },
  progressBarFilled: {
    backgroundColor: '#0284C7',
  },
  progressBarEmpty: {
    backgroundColor: '#E2E8F0',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  highlightText: {
    color: '#0284C7',
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  optionsScrollView: {
    flex: 1,
  },
  basicsScrollContent: {
    paddingBottom: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  ageBadgeValid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ageBadgeInvalid: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  ageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ageBadgeTextValid: {
    color: '#16A34A',
  },
  ageBadgeTextInvalid: {
    color: '#DC2626',
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  dobRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dobBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  dobSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dobInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    width: '100%',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pillOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  pillOptionUnselected: {
    borderColor: '#E2E8F0',
  },
  pillOptionSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  pillEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextUnselected: {
    color: '#475569',
  },
  pillTextSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  gpsActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  gpsActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  gpsDetectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    paddingVertical: 11,
    marginTop: 6,
  },
  gpsDetectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  optionsList: {
    gap: 12,
    paddingBottom: 16,
    paddingTop: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  optionCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  optionCardSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(2, 132, 199, 0.15)',
      },
      default: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeUnselected: {
    backgroundColor: '#F1F5F9',
  },
  iconBadgeSelected: {
    backgroundColor: '#E0F2FE',
  },
  emojiText: {
    fontSize: 22,
  },
  optionTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  optionTitleUnselected: {
    color: '#1E293B',
  },
  optionTitleSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleUnselected: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  radioCircleSelected: {
    borderWidth: 2,
    borderColor: '#0284C7',
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284C7',
  },
  bottomBar: {
    paddingVertical: Platform.OS === 'ios' ? 12 : 18,
    paddingTop: 8,
  },
  continueButton: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
      },
      default: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  continueGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  buttonLeftCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonRightChevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
});
