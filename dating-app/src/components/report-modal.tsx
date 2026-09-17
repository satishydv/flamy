import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Profile, ReportCategory } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';

interface ReportModalProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onReportSubmitted?: (reportedUserId: string, wasBlocked: boolean) => void;
}

interface CategoryOption {
  id: ReportCategory;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'Harassment',
    title: 'Harassment or Bullying',
    icon: 'hand-left-outline',
    description: 'Offensive language, stalking, or unwanted behavior',
  },
  {
    id: 'Fake Profile',
    title: 'Fake Profile or Impersonation',
    icon: 'person-remove-outline',
    description: 'Using someone else’s photos or fake identity',
  },
  {
    id: 'Inappropriate Photos',
    title: 'Inappropriate Photos or Nudity',
    icon: 'images-outline',
    description: 'Explicit, vulgar, or inappropriate photos',
  },
  {
    id: 'Spam & Scams',
    title: 'Spam, Scams or Commercial',
    icon: 'megaphone-outline',
    description: 'Selling services, money requests, or bot links',
  },
  {
    id: 'Hate Speech & Threats',
    title: 'Hate Speech or Safety Threats',
    icon: 'warning-outline',
    description: 'Discrimination, slurs, threats, or danger',
  },
  {
    id: 'Underage / Safety Concern',
    title: 'Underage or Safety Concern',
    icon: 'shield-outline',
    description: 'Appears under 18 or severe safety violation',
  },
  {
    id: 'Other',
    title: 'Other Safety Concern',
    icon: 'help-circle-outline',
    description: 'Any other violation of community guidelines',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  profile,
  onClose,
  onReportSubmitted,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('Harassment');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!profile) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const res = await fetch(API_ENDPOINTS.reportUser, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: profile.id,
          category: selectedCategory,
          details: details.trim(),
          alsoBlock,
        }),
      });

      const data = await res.json();

      if (data?.success) {
        Alert.alert(
          'Report Submitted 🛡️',
          alsoBlock
            ? `Thank you for keeping our community safe. ${profile.name} has been reported and blocked.`
            : `Thank you for your report. Our safety team will review ${profile.name} promptly.`
        );
        onClose();
        if (onReportSubmitted) {
          onReportSubmitted(profile.id, alsoBlock);
        }
      } else {
        Alert.alert('Report Failed', data?.message || 'Could not submit report.');
      }
    } catch (err) {
      Alert.alert('Connection Error', 'Could not connect to safety server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="shield-outline" size={22} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Report Profile</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Target Profile Summary */}
            <View style={styles.profileBadge}>
              <Image
                source={profile.image ? { uri: profile.image } : null}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.profileBadgeInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile.name}, {profile.age}
                </Text>
                <Text style={styles.profileSub}>
                  {profile.location || 'Nearby'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Reason for Reporting</Text>
            <Text style={styles.sectionHint}>
              Select the primary issue that violates community standards.
            </Text>

            {/* Violation Categories */}
            <View style={styles.categoriesList}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        isSelected ? styles.iconWrapSelected : styles.iconWrapUnselected,
                      ]}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={20}
                        color={isSelected ? '#FFFFFF' : '#475569'}
                      />
                    </View>
                    <View style={styles.categoryText}>
                      <Text
                        style={[
                          styles.categoryTitle,
                          isSelected && styles.categoryTitleSelected,
                        ]}
                      >
                        {cat.title}
                      </Text>
                      <Text style={styles.categoryDesc}>{cat.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Additional Details TextInput */}
            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
              Additional Context (Optional)
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Provide any additional details or messages that help us take quick action..."
              placeholderTextColor="#94A3B8"
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            {/* Also Block Switch */}
            <View style={styles.blockRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.blockTitle}>Also block {profile.name}</Text>
                <Text style={styles.blockDesc}>
                  Neither of you will see each other in radar, feed, likes, or messages.
                </Text>
              </View>
              <Switch
                value={alsoBlock}
                onValueChange={setAlsoBlock}
                trackColor={{ false: '#CBD5E1', true: '#EF4444' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Confidentiality Notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="lock-closed" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.noticeText}>
                Your report is 100% confidential. {profile.name} will not be notified who submitted it.
              </Text>
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="alert-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#CBD5E1',
  },
  profileBadgeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  categoriesList: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  categoryCardSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapUnselected: {
    backgroundColor: '#F1F5F9',
  },
  iconWrapSelected: {
    backgroundColor: '#EF4444',
  },
  categoryText: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryTitleSelected: {
    color: '#DC2626',
  },
  categoryDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleSelected: {
    borderColor: '#EF4444',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9F1239',
  },
  blockDesc: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 16,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  noticeText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
