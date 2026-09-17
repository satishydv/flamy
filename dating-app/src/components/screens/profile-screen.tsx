import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UserPreferences, ProfilePhoto } from '@/types';
import { API_ENDPOINTS, getAuthToken } from '@/constants/api';
import { BlockedUsersModal } from '@/components/blocked-users-modal';

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  image?: string | null;
}

interface ProfileScreenProps {
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onShowWelcomeScreen: () => void;
  onRetakeQuestions?: () => void;
  onShowAuthScreen: () => void;
  onOpenNotifications?: () => void;
  userPreferences?: UserPreferences;
  matchesCount?: number;
  likesCount?: number;
  onNavigateTab?: (tab: 'likes' | 'messages' | 'map') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onLogout,
  onShowWelcomeScreen,
  onRetakeQuestions,
  onShowAuthScreen,
  onOpenNotifications,
  userPreferences,
  matchesCount: propMatchesCount,
  likesCount: propLikesCount,
  onNavigateTab,
}) => {
  // User Profile state (editable)
  const initialName = currentUser?.name || '';
  const initialAvatar = currentUser?.image ? { uri: currentUser.image } : null;

  const [userProfile, setUserProfile] = useState({
    name: initialName,
    age: 24,
    gender: '',
    jobTitle: '',
    location: '',
    bio: '',
    tags: [] as string[],
    avatar: initialAvatar,
  });

  // Dynamic Profile Stats (Encounters, Matches, Likes) from Database
  const [stats, setStats] = useState({
    encounters: 0,
    matches: propMatchesCount ?? 0,
    likes: propLikesCount ?? 0,
  });

  // Keep in sync with app-level props
  useEffect(() => {
    if (typeof propMatchesCount === 'number') {
      setStats((prev) => ({ ...prev, matches: propMatchesCount }));
    }
  }, [propMatchesCount]);

  useEffect(() => {
    if (typeof propLikesCount === 'number') {
      setStats((prev) => ({ ...prev, likes: propLikesCount }));
    }
  }, [propLikesCount]);

  // Photo Upload & Profile Save Loading States
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<ProfilePhoto[]>([]);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);

  // Fetch full profile, photos, saved preferences and real dynamic stats from PostgreSQL backend
  useEffect(() => {
    const fetchBackendProfile = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.getProfile, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success && data.profile) {
          if (data.stats) {
            setStats({
              encounters: data.stats.encounters ?? 0,
              matches: typeof propMatchesCount === 'number' ? propMatchesCount : (data.stats.matches ?? 0),
              likes: typeof propLikesCount === 'number' ? propLikesCount : (data.stats.likes ?? 0),
            });
          }
          setUserProfile((prev) => ({
            ...prev,
            name: data.user?.name || prev.name,
            age: data.profile.age || prev.age,
            gender: data.profile.gender || prev.gender,
            jobTitle: data.profile.jobTitle || prev.jobTitle,
            location: data.profile.location || prev.location,
            bio: data.profile.bio || prev.bio,
            tags: data.profile.tags && data.profile.tags.length > 0 ? data.profile.tags : prev.tags,
            avatar: data.profile.avatarUrl ? { uri: data.profile.avatarUrl } : prev.avatar,
          }));
          if (data.photos && Array.isArray(data.photos)) {
            setGalleryPhotos(data.photos);
          }
          if (typeof data.profile.isGhostMode === 'boolean') {
            setGhostMode(data.profile.isGhostMode);
          }
          if (typeof data.profile.isIncognito === 'boolean') {
            setIncognitoMode(data.profile.isIncognito);
          }
          setEditName(data.user?.name || initialName);
          setEditAge(String(data.profile.age || 24));
          setEditGender(data.profile.gender || '');
          setEditJob(data.profile.jobTitle || '');
          setEditLocation(data.profile.location || '');
          setEditBio(data.profile.bio || '');
          if (data.profile.tags && data.profile.tags.length > 0) {
            setEditTags(data.profile.tags.join(', '));
          }
        }
      } catch (e) {
        console.log('Profile backend fetch notice:', e);
      }
    };

    fetchBackendProfile();
  }, [currentUser]);

  // Modal Visibility States
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  // Edit Profile Form Draft State
  const [editName, setEditName] = useState(userProfile.name);
  const [editAge, setEditAge] = useState(String(userProfile.age));
  const [editGender, setEditGender] = useState(userProfile.gender);
  const [editJob, setEditJob] = useState(userProfile.jobTitle);
  const [editLocation, setEditLocation] = useState(userProfile.location);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editTags, setEditTags] = useState(userProfile.tags.join(', '));

  // Privacy Settings Toggles
  const [ghostMode, setGhostMode] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [preciseLocation, setPreciseLocation] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  // Notification Settings Toggles
  const [encounterAlerts, setEncounterAlerts] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [recommendationsAlert, setRecommendationsAlert] = useState(true);

  // Sync privacy mode toggles to PostgreSQL backend
  const handleToggleGhostMode = async (value: boolean) => {
    setGhostMode(value);
    try {
      await fetch(API_ENDPOINTS.updatePrivacySettings, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isGhostMode: value }),
      });
    } catch (e) {
      console.warn('Ghost mode toggle sync notice:', e);
    }
  };

  const handleToggleIncognito = async (value: boolean) => {
    setIncognitoMode(value);
    try {
      await fetch(API_ENDPOINTS.updatePrivacySettings, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isIncognito: value }),
      });
    } catch (e) {
      console.warn('Incognito mode toggle sync notice:', e);
    }
  };

  // Permanent GDPR & App Store compliant account deletion
  const handleDeleteAccount = () => {
    const doDelete = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.deleteAccount, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        if (data?.success) {
          Alert.alert(
            'Account Deleted',
            'Your account, photos, and messages have been permanently purged per GDPR guidelines.'
          );
          if (onLogout) onLogout();
          else onShowWelcomeScreen();
        } else {
          Alert.alert('Delete Failed', data?.message || 'Could not delete account.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to connect to server.');
      }
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'WARNING: Permanently delete your account? All your photos on Cloudinary, matches, conversations, and preferences will be permanently wiped.'
        )
      ) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Account Permanently? ⚠️',
        'This action is irreversible. All your profile information, Cloudinary photos, chat messages, matches, and preferences will be permanently wiped per GDPR and App Store policies.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Everything', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleOpenEdit = () => {
    setEditName(userProfile.name);
    setEditAge(String(userProfile.age));
    setEditGender(userProfile.gender);
    setEditJob(userProfile.jobTitle);
    setEditLocation(userProfile.location);
    setEditBio(userProfile.bio);
    setEditTags(userProfile.tags.join(', '));
    setShowEditProfileModal(true);
  };

  /**
   * Safe multipart form-data upload helper using XMLHttpRequest
   * Bypasses Expo Winter Fetch's convertFormDataAsync which throws "Unsupported FormDataPart implementation"
   * and directly uses React Native's native OkHttp multipart streamer on Android/iOS.
   */
  const uploadFormDataAsync = (url: string, formData: FormData): Promise<{ status: number; data: any }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.withCredentials = true;

      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('x-session-token', token);
      }

      xhr.onload = () => {
        let data: any;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = { success: false, message: xhr.responseText || 'Failed to parse response' };
        }
        resolve({ status: xhr.status, data });
      };

      xhr.onerror = () => {
        reject(new Error('Network request failed. Please check your internet connection.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload request timed out.'));
      };

      xhr.send(formData);
    });
  };

  /**
   * Upload real profile photo directly to backend Cloudinary endpoint
   */
  const handlePickAndUploadPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please allow access to your media library to upload your profile photo.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsUploadingPhoto(true);

      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        if (blob.size > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Image exceeds the 5 MB limit. Please choose an image smaller than 5 MB.'
          );
          setIsUploadingPhoto(false);
          return;
        }

        formData.append('image', blob, asset.fileName || 'profile_photo.jpg');
      } else {
        // Native (Android / iOS): Use React Native's native file object format!
        // This avoids calling response.blob() (which triggers the "Response.blob() is using React Native's Blob" warning)
        // and ensures the filename and mimeType are correctly recognized by Multer on the backend.
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Image exceeds the 5 MB limit. Please choose an image smaller than 5 MB.'
          );
          setIsUploadingPhoto(false);
          return;
        }

        const uri = asset.uri;
        let fileName = asset.fileName;
        if (!fileName) {
          const uriParts = uri.split('/');
          const raw = uriParts[uriParts.length - 1] || 'profile_photo.jpg';
          fileName = /\.(jpe?g|png|webp)$/i.test(raw) ? raw : `${raw}.jpg`;
        }

        const mimeType =
          asset.mimeType ||
          (fileName.endsWith('.png') ? 'image/png' : fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

        formData.append('image', {
          uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const { status, data: uploadData } = await uploadFormDataAsync(
        API_ENDPOINTS.uploadProfilePhoto,
        formData
      );

      if (status === 200 && uploadData.success && uploadData.url) {
        setUserProfile((prev) => ({
          ...prev,
          avatar: { uri: uploadData.url },
        }));
        Alert.alert('Photo Uploaded! 📸', 'Your profile photo has been successfully updated on Cloudinary.');
      } else {
        Alert.alert('Upload Failed', uploadData.message || 'Failed to upload photo. Please ensure it is under 1 MB.');
      }
    } catch (err: any) {
      console.error('[PROFILE] Image upload error:', err);
      Alert.alert('Upload Error', 'Failed to upload image. Please check your network connection.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  /**
   * Upload a gallery photo (strictly enforces 5 photos maximum)
   */
  const handlePickAndUploadGalleryPhoto = async (slotIndex?: number) => {
    try {
      if (galleryPhotos.length >= 5) {
        Alert.alert(
          'Maximum Reached',
          'You can upload a maximum of 5 photos. Remove an existing photo first to upload a new one.'
        );
        return;
      }

      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please allow access to your media library to upload photos.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setUploadingGalleryIndex(slotIndex !== undefined ? slotIndex : galleryPhotos.length);

      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        if (blob.size > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Image exceeds the 5 MB limit. Please choose an image smaller than 5 MB.'
          );
          setUploadingGalleryIndex(null);
          return;
        }

        formData.append('image', blob, asset.fileName || 'gallery_photo.jpg');
      } else {
        // Native (Android / iOS): Use React Native's native file object format!
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Image exceeds the 5 MB limit. Please choose an image smaller than 5 MB.'
          );
          setUploadingGalleryIndex(null);
          return;
        }

        const uri = asset.uri;
        let fileName = asset.fileName;
        if (!fileName) {
          const uriParts = uri.split('/');
          const raw = uriParts[uriParts.length - 1] || 'gallery_photo.jpg';
          fileName = /\.(jpe?g|png|webp)$/i.test(raw) ? raw : `${raw}.jpg`;
        }

        const mimeType =
          asset.mimeType ||
          (fileName.endsWith('.png') ? 'image/png' : fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

        formData.append('image', {
          uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const { status, data: uploadData } = await uploadFormDataAsync(
        API_ENDPOINTS.uploadGalleryPhoto,
        formData
      );

      if (status === 200 && uploadData.success && uploadData.photo) {
        setGalleryPhotos(uploadData.photos || [...galleryPhotos, uploadData.photo]);
        // Also update local avatar if user had none
        if (!userProfile.avatar || !userProfile.avatar.uri) {
          setUserProfile((prev) => ({ ...prev, avatar: { uri: uploadData.photo.url } }));
        }
        Alert.alert('Photo Added! 📸', `Gallery updated (${uploadData.totalPhotos}/5 photos).`);
      } else {
        Alert.alert('Upload Failed', uploadData.message || 'Failed to upload photo to gallery.');
      }
    } catch (err) {
      console.error('[PROFILE] Gallery photo upload error:', err);
      Alert.alert('Upload Error', 'Failed to upload gallery photo. Please check your network connection.');
    } finally {
      setUploadingGalleryIndex(null);
    }
  };

  /**
   * Delete photo from gallery and Cloudinary
   */
  const handleDeleteGalleryPhoto = async (photoId: string) => {
    const doDelete = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.deleteGalleryPhoto(photoId), {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success) {
          setGalleryPhotos((prev) => prev.filter((p) => p.id !== photoId));
          Alert.alert('Photo Removed', 'The photo has been removed from your gallery.');
        } else {
          Alert.alert('Delete Failed', data.message || 'Could not delete photo.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to delete photo.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this photo from your gallery?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Delete Photo', 'Are you sure you want to remove this photo from your gallery?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  /**
   * Save profile changes (Bio, Age, Gender, Location, Job, Tags, Name) to PostgreSQL
   */
  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const numAge = parseInt(editAge, 10);
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: editName.trim() || userProfile.name,
        age: isNaN(numAge) ? userProfile.age : numAge,
        gender: editGender,
        location: editLocation.trim() || userProfile.location,
        jobTitle: editJob.trim() || userProfile.jobTitle,
        bio: editBio.trim() || userProfile.bio,
        tags: tagsArray,
      };

      const res = await fetch(API_ENDPOINTS.updateProfile, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setUserProfile((prev) => ({
          ...prev,
          name: payload.name,
          age: payload.age,
          gender: payload.gender,
          jobTitle: payload.jobTitle,
          location: payload.location,
          bio: payload.bio,
          tags: payload.tags,
        }));
        setShowEditProfileModal(false);
        Alert.alert('Profile Saved! ✨', 'Your profile details have been successfully updated.');
      } else {
        Alert.alert('Save Failed', data.message || 'Could not save profile changes.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Failed to connect to backend server.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        await fetch(API_ENDPOINTS.signOut, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        console.warn('Sign-out network error:', err);
      }
      if (onLogout) {
        onLogout();
      } else {
        onShowWelcomeScreen();
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to log out of your account?');
      if (confirm) {
        await doLogout();
      }
    } else {
      Alert.alert('Log Out', 'Are you sure you want to log out of your account?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowPrivacyModal(true)}
        >
          <Ionicons name="settings-outline" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrapper}>
            {userProfile.avatar?.uri ? (
              <Image source={userProfile.avatar} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={44} color="#94A3B8" />
              </View>
            )}
            {isUploadingPhoto && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={handlePickAndUploadPhoto}
              disabled={isUploadingPhoto}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.nameVerifiedRow}>
            <Text style={styles.userName}>{userProfile.name}, {userProfile.age}</Text>
            <Ionicons name="checkmark-circle" size={20} color="#0EA5E9" />
          </View>

          {currentUser?.email ? (
            <View style={styles.userEmailBadge}>
              <Ionicons name="mail-outline" size={13} color="#64748B" />
              <Text style={styles.userEmailText}>{currentUser.email}</Text>
            </View>
          ) : null}

          <Text style={styles.userLocation}>📍 {userProfile.location}</Text>
          <Text style={styles.userBio}>{userProfile.bio}</Text>

          {/* Dynamic Database Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statBox}
              activeOpacity={0.7}
              onPress={() => onNavigateTab?.('map')}
            >
              <Text style={styles.statNumber}>{stats.encounters}</Text>
              <Text style={styles.statLabel}>Encounters</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statBox}
              activeOpacity={0.7}
              onPress={() => onNavigateTab?.('messages')}
            >
              <Text style={styles.statNumber}>{stats.matches}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statBox}
              activeOpacity={0.7}
              onPress={() => onNavigateTab?.('likes')}
            >
              <Text style={styles.statNumber}>{stats.likes}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5-PHOTO GALLERY SECTION (Maximum 5 Photos) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.galleryHeaderRow}>
            <View style={styles.galleryTitleWrapper}>
              <Text style={styles.sectionHeader}>PHOTO GALLERY</Text>
              <View style={styles.galleryCounterBadge}>
                <Text style={styles.galleryCounterText}>{galleryPhotos.length}/5 Photos</Text>
              </View>
            </View>
            {galleryPhotos.length < 5 && (
              <TouchableOpacity
                style={styles.addPhotoTopBtn}
                onPress={() => handlePickAndUploadGalleryPhoto()}
                disabled={uploadingGalleryIndex !== null}
              >
                <Ionicons name="add" size={16} color="#0284C7" />
                <Text style={styles.addPhotoTopBtnText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.gallerySubtitle}>
            Showcase up to 5 photos to stand out. Cleaned & compressed via Cloudinary CDN.
          </Text>

          {/* 5-Slot Photo Grid */}
          <View style={styles.galleryGrid}>
            {Array.from({ length: 5 }).map((_, index) => {
              const photo = galleryPhotos[index];
              const isUploadingThis = uploadingGalleryIndex === index;
              const isNextAvailableSlot = index === galleryPhotos.length;

              if (photo) {
                return (
                  <View
                    key={photo.id}
                    style={[styles.gallerySlot, index === 0 && styles.gallerySlotPrimary]}
                  >
                    <Image source={{ uri: photo.url }} style={styles.galleryImage} contentFit="cover" />
                    <LinearGradient
                      colors={['rgba(15,23,42,0.6)', 'transparent']}
                      style={styles.gallerySlotTopGradient}
                    >
                      <View style={styles.slotBadge}>
                        <Text style={styles.slotBadgeText}>{index === 0 ? '★ Primary' : `#${index + 1}`}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deletePhotoBtn}
                        onPress={() => handleDeleteGalleryPhoto(photo.id)}
                      >
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={`slot-${index}`}
                  activeOpacity={isNextAvailableSlot ? 0.75 : 1}
                  style={[
                    styles.gallerySlot,
                    styles.gallerySlotEmpty,
                    isNextAvailableSlot ? styles.gallerySlotNext : styles.gallerySlotDisabled,
                    index === 0 && styles.gallerySlotPrimary,
                  ]}
                  onPress={() => isNextAvailableSlot && handlePickAndUploadGalleryPhoto(index)}
                  disabled={!isNextAvailableSlot || isUploadingThis}
                >
                  {isUploadingThis ? (
                    <ActivityIndicator size="small" color="#0EA5E9" />
                  ) : (
                    <>
                      <View
                        style={[
                          styles.emptySlotIconCircle,
                          isNextAvailableSlot && styles.emptySlotIconCircleActive,
                        ]}
                      >
                        <Ionicons
                          name={isNextAvailableSlot ? 'add' : 'camera-outline'}
                          size={20}
                          color={isNextAvailableSlot ? '#0EA5E9' : '#94A3B8'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.emptySlotLabel,
                          isNextAvailableSlot && styles.emptySlotLabelActive,
                        ]}
                      >
                        {isNextAvailableSlot ? 'Upload' : `Slot ${index + 1}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── PROFILE SECTION (User Requested Hierarchy) ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>PROFILE</Text>

          {/* 1. My Profile */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.actionRow}
            onPress={() => setShowMyProfileModal(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="person-circle-outline" size={22} color="#0284C7" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>My Profile</Text>
              <Text style={styles.actionRowSub}>Preview your card as seen by other people</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 2. Edit Profile */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRow, styles.actionRowBorder]}
            onPress={handleOpenEdit}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="create-outline" size={20} color="#7C3AED" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>Edit Profile</Text>
              <Text style={styles.actionRowSub}>Update bio, occupation, location & tags</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 3. Privacy */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRow, styles.actionRowBorder]}
            onPress={() => setShowPrivacyModal(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>Privacy</Text>
              <Text style={styles.actionRowSub}>Ghost mode, incognito & radar visibility</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* 4. Notifications */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRow, styles.actionRowBorder]}
            onPress={() => setShowNotificationsModal(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="notifications-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>Notifications</Text>
              <Text style={styles.actionRowSub}>Encounter alerts, matches & message sounds</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* My Matchmaking Preferences Card */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>My Match Preferences</Text>
            {onRetakeQuestions && (
              <TouchableOpacity onPress={onRetakeQuestions}>
                <Text style={styles.editLinkText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.prefGrid}>
            <View style={styles.prefItem}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="flag-outline" size={18} color="#0284C7" />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>Dating Goal</Text>
                <Text style={styles.prefValue}>
                  {userPreferences?.datingGoal || 'Long-Term Dating'}
                </Text>
              </View>
            </View>

            <View style={styles.prefItem}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="sparkles-outline" size={18} color="#16A34A" />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>Personality</Text>
                <Text style={styles.prefValue}>
                  {userPreferences?.personality || 'Extroverted & Energetic'}
                </Text>
              </View>
            </View>

            <View style={styles.prefItem}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#FDF4FF' }]}>
                <Ionicons name="heart-half-outline" size={18} color="#C026D3" />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>Partner Traits</Text>
                <Text style={styles.prefValue}>
                  {userPreferences?.partnerTraits || 'Great Sense of Humor'}
                </Text>
              </View>
            </View>

            <View style={styles.prefItem}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="musical-notes-outline" size={18} color="#D97706" />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>Music Vibe</Text>
                <Text style={styles.prefValue}>
                  {userPreferences?.musicPreference || 'Indie Rock & Alternative'}
                </Text>
              </View>
            </View>

            <View style={styles.prefItem}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="shield-outline" size={18} color="#DC2626" />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>Deal-Breaker</Text>
                <Text style={styles.prefValue}>
                  {userPreferences?.dealBreakers || 'Dishonesty & Lack of Trust'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preview Modes Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Preview Modes & Flows</Text>

          {/* Retake Matchmaking Questions Action */}
          {onRetakeQuestions && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.actionRow}
              onPress={onRetakeQuestions}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="options" size={20} color="#0284C7" />
              </View>
              <View style={styles.actionRowText}>
                <Text style={styles.actionRowTitle}>Matchmaking Quiz (5 Steps)</Text>
                <Text style={styles.actionRowSub}>Re-answer goals, traits & music to see matches</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Revisit Welcome / Onboarding Screen Action */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRow, onRetakeQuestions ? styles.actionRowBorder : {}]}
            onPress={onShowWelcomeScreen}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="sparkles" size={20} color="#0284C7" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>Revisit Welcome Screen</Text>
              <Text style={styles.actionRowSub}>Experience the cloud intro & onboarding flow</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* Login & Sign Up Screen Action */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRow, styles.actionRowBorder]}
            onPress={onShowAuthScreen}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#FFE4E6' }]}>
              <Ionicons name="lock-closed" size={19} color="#E11D48" />
            </View>
            <View style={styles.actionRowText}>
              <Text style={styles.actionRowTitle}>Login & Sign Up Screen</Text>
              <Text style={styles.actionRowSub}>Preview dark mode auth flow</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── LOGOUT SECTION (Bottom of Profile Page) ── */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <View style={styles.logoutIconCircle}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          {/* Delete Account Action Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.logoutButton, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3', marginTop: 10 }]}
            onPress={handleDeleteAccount}
          >
            <View style={[styles.logoutIconCircle, { backgroundColor: '#FFE4E6' }]}>
              <Ionicons name="trash-outline" size={20} color="#E11D48" />
            </View>
            <Text style={[styles.logoutButtonText, { color: '#E11D48' }]}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.loggedInAsText}>
            {currentUser?.email
              ? `Signed in as ${currentUser.name} • ${currentUser.email}`
              : `Signed in as ${userProfile.name}`}
          </Text>
        </View>
      </ScrollView>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* 1. MY PROFILE PREVIEW MODAL */}
      <Modal visible={showMyProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Public Profile Preview</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowMyProfileModal(false)}
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile Card Mock */}
              <View style={styles.previewImageWrapper}>
                {userProfile.avatar?.uri ? (
                  <Image source={userProfile.avatar} style={styles.previewImage} contentFit="cover" />
                ) : (
                  <View style={[styles.previewImage, styles.previewPlaceholder]}>
                    <Ionicons name="person" size={72} color="#94A3B8" />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                  style={styles.previewGradient}
                >
                  <View style={styles.nameRow}>
                    <Text style={styles.previewName}>{userProfile.name}, {userProfile.age}</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#38BDF8" />
                  </View>
                  <Text style={styles.previewJob}>{userProfile.jobTitle} • {userProfile.location}</Text>
                </LinearGradient>
              </View>

              <View style={styles.previewDetails}>
                <Text style={styles.previewSectionHeading}>About Me</Text>
                <Text style={styles.previewBioText}>{userProfile.bio}</Text>

                <Text style={[styles.previewSectionHeading, { marginTop: 14 }]}>Dating Goal</Text>
                <View style={styles.previewGoalBadge}>
                  <Text style={styles.previewGoalText}>
                    🎯 {userPreferences?.datingGoal || 'Long-Term Dating'}
                  </Text>
                </View>

                <Text style={[styles.previewSectionHeading, { marginTop: 14 }]}>Interests</Text>
                <View style={styles.previewTagsRow}>
                  {userProfile.tags.map((tag, i) => (
                    <View key={i} style={styles.previewTagPill}>
                      <Text style={styles.previewTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  setShowMyProfileModal(false);
                  handleOpenEdit();
                }}
              >
                <Ionicons name="pencil" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalPrimaryBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. EDIT PROFILE MODAL */}
      <Modal visible={showEditProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowEditProfileModal(false)}
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Profile Photo Uploader Section */}
              <View style={styles.photoUploadBanner}>
                <View style={styles.editModalAvatarWrapper}>
                  {userProfile.avatar?.uri ? (
                    <Image source={userProfile.avatar} style={styles.editModalAvatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.editModalAvatarImage, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={36} color="#94A3B8" />
                    </View>
                  )}
                  {isUploadingPhoto && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.photoUploadInfo}>
                  <TouchableOpacity
                    style={styles.uploadPhotoBtn}
                    onPress={handlePickAndUploadPhoto}
                    disabled={isUploadingPhoto}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadPhotoBtnText}>
                      {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.uploadPhotoHint}>Max 1 MB • Cloudinary CDN • JPEG/PNG/WebP</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.formLabel}>Age</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editAge}
                    onChangeText={setEditAge}
                    keyboardType="number-pad"
                    placeholder="25"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 2 }]}>
                  <Text style={styles.formLabel}>Location</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editLocation}
                    onChangeText={setEditLocation}
                    placeholder="Central London"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Gender Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Gender</Text>
                <View style={styles.genderPillsContainer}>
                  {['Woman', 'Man', 'Non-Binary', 'Other'].map((g) => {
                    const isSelected = editGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        activeOpacity={0.8}
                        style={[
                          styles.genderPill,
                          isSelected ? styles.genderPillSelected : styles.genderPillUnselected,
                        ]}
                        onPress={() => setEditGender(g)}
                      >
                        <Text
                          style={[
                            styles.genderPillText,
                            isSelected ? styles.genderPillTextSelected : styles.genderPillTextUnselected,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Occupation / Job Title</Text>
                <TextInput
                  style={styles.formInput}
                  value={editJob}
                  onChangeText={setEditJob}
                  placeholder="e.g. Product Designer"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bio (Tell others about yourself)</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  numberOfLines={4}
                  placeholder="Write a catchy bio..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Interests & Tags (comma separated)</Text>
                <TextInput
                  style={styles.formInput}
                  value={editTags}
                  onChangeText={setEditTags}
                  placeholder="Coffee, Design, Brunch, Dogs"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, isSavingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.modalPrimaryBtnText}>
                  {isSavingProfile ? 'Saving Changes...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. PRIVACY SETTINGS MODAL */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy & Security</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowPrivacyModal(false)}
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Ghost / Invisible Mode</Text>
                  <Text style={styles.settingToggleDesc}>
                    Temporarily hide your profile from being discovered on the radar map.
                  </Text>
                </View>
                <Switch
                  value={ghostMode}
                  onValueChange={handleToggleGhostMode}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Incognito Browsing</Text>
                  <Text style={styles.settingToggleDesc}>
                    View profiles secretly without appearing in their crossed paths history.
                  </Text>
                </View>
                <Switch
                  value={incognitoMode}
                  onValueChange={handleToggleIncognito}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Precise Location Sharing</Text>
                  <Text style={styles.settingToggleDesc}>
                    Show approximate neighborhood distance instead of exact GPS meters.
                  </Text>
                </View>
                <Switch
                  value={preciseLocation}
                  onValueChange={setPreciseLocation}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Read Receipts</Text>
                  <Text style={styles.settingToggleDesc}>
                    Show matches when you have read their messages in direct chats.
                  </Text>
                </View>
                <Switch
                  value={readReceipts}
                  onValueChange={setReadReceipts}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Blocked Accounts Navigation */}
              <TouchableOpacity
                style={styles.dangerZoneRow}
                onPress={() => setShowBlockedModal(true)}
              >
                <Ionicons name="ban-outline" size={18} color="#EF4444" />
                <Text style={styles.dangerZoneText}>Blocked Accounts</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Delete Account & Data Wipe */}
              <TouchableOpacity
                style={[styles.dangerZoneRow, { borderColor: '#FECDD3', backgroundColor: '#FFF1F2', marginTop: 10 }]}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={18} color="#E11D48" />
                <Text style={[styles.dangerZoneText, { color: '#E11D48' }]}>Delete Account & Wipe Data</Text>
                <Ionicons name="chevron-forward" size={18} color="#FDA4AF" />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  setShowPrivacyModal(false);
                  Alert.alert('Privacy Saved', 'Your privacy preferences have been updated.');
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. NOTIFICATIONS SETTINGS MODAL */}
      <Modal visible={showNotificationsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowNotificationsModal(false)}
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Encounter Alerts</Text>
                  <Text style={styles.settingToggleDesc}>
                    Get real-time push alerts when you cross paths with someone new.
                  </Text>
                </View>
                <Switch
                  value={encounterAlerts}
                  onValueChange={setEncounterAlerts}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Match & Like Alerts</Text>
                  <Text style={styles.settingToggleDesc}>
                    Notify immediately when someone likes you or a mutual match happens.
                  </Text>
                </View>
                <Switch
                  value={matchAlerts}
                  onValueChange={setMatchAlerts}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Chat Message Sounds</Text>
                  <Text style={styles.settingToggleDesc}>
                    Play audio chimes and vibrate on new in-app messages.
                  </Text>
                </View>
                <Switch
                  value={messageSounds}
                  onValueChange={setMessageSounds}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingToggleRow}>
                <View style={styles.settingToggleText}>
                  <Text style={styles.settingToggleTitle}>Weekly Synergy Recommendations</Text>
                  <Text style={styles.settingToggleDesc}>
                    Curated list of profiles that match your dating preferences.
                  </Text>
                </View>
                <Switch
                  value={recommendationsAlert}
                  onValueChange={setRecommendationsAlert}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {onOpenNotifications && (
                <TouchableOpacity
                  style={styles.openNotifsCenterBtn}
                  onPress={() => {
                    setShowNotificationsModal(false);
                    onOpenNotifications();
                  }}
                >
                  <Ionicons name="notifications" size={18} color="#0284C7" />
                  <Text style={styles.openNotifsCenterText}>View Notification History</Text>
                  <Ionicons name="chevron-forward" size={18} color="#0284C7" />
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  setShowNotificationsModal(false);
                  Alert.alert('Notifications Saved', 'Your notification settings have been updated.');
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. BLOCKED ACCOUNTS MODAL */}
      <BlockedUsersModal
        visible={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingBottom: 85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#0EA5E9',
  },
  avatarPlaceholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholder: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0EA5E9',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  userLocation: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  userBio: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  actionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowText: {
    flex: 1,
  },
  actionRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionRowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  prefGrid: {
    gap: 10,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  prefIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefContent: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },

  /* ── Modal Styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalPrimaryBtn: {
    backgroundColor: '#0284C7',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Preview Card Styles */
  previewImageWrapper: {
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewJob: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  previewDetails: {
    paddingHorizontal: 4,
  },
  previewSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewBioText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  previewGoalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  previewGoalText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  previewTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewTagPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  previewTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  /* Form Styles */
  formGroup: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  /* Toggle Settings Styles */
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingToggleText: {
    flex: 1,
    paddingRight: 14,
  },
  settingToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingToggleDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  dangerZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
    marginTop: 6,
  },
  dangerZoneText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  openNotifsCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  openNotifsCenterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  userEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  userEmailText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'center',
    gap: 10,
  },
  logoutButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  logoutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.3,
  },
  loggedInAsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  photoUploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 14,
  },
  editModalAvatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#0284C7',
  },
  editModalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  photoUploadInfo: {
    flex: 1,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  uploadPhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadPhotoHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  genderPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  genderPill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  genderPillUnselected: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  genderPillSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  genderPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  genderPillTextUnselected: {
    color: '#475569',
  },
  genderPillTextSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  galleryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  galleryTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  galleryCounterBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  galleryCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  addPhotoTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  addPhotoTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  gallerySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gallerySlot: {
    width: '31%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  gallerySlotPrimary: {
    width: '48%',
    height: 160,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  gallerySlotTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  slotBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  deletePhotoBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  gallerySlotEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gallerySlotNext: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  gallerySlotDisabled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    opacity: 0.65,
  },
  emptySlotIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotIconCircleActive: {
    backgroundColor: '#E0F2FE',
  },
  emptySlotLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptySlotLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
});
