import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types';

interface ExploreScreenProps {
  profiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  onLikeProfile: (profile: Profile) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  profiles,
  onSelectProfile,
  onLikeProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

  const tags = ['All', 'Coffee', 'Photography', 'Art', 'Music', 'Travel'];

  const filtered = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === 'All' || p.tags.some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()));
    return matchesSearch && matchesTag;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>Find people who crossed paths with you</Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or neighborhood..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Filter Tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {tags.map((tag) => {
            const active = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagPill, active && styles.tagPillActive]}
                onPress={() => setSelectedTag(tag)}
              >
                <Text style={[styles.tagPillText, active && styles.tagPillTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid of Profiles */}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="compass-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No profiles found</Text>
            <Text style={styles.emptySubtitle}>Try changing your search term or selecting another category tag.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                activeOpacity={0.85}
                style={styles.gridCard}
                onPress={() => onSelectProfile(profile)}
              >
                <Image
                  source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
                  style={styles.cardImage}
                  contentFit="cover"
                />

                <LinearGradient
                  colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                  style={styles.cardScrim}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.matchPill}>
                      <Text style={styles.matchPillText}>{profile.matchPercentage}%</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cardHeartBtn}
                      onPress={() => onLikeProfile(profile)}
                    >
                      <Ionicons
                        name={profile.liked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={profile.liked ? '#F43F5E' : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                  </View>

                  <View>
                    <Text style={styles.cardName}>
                      {profile.name}, {profile.age}
                    </Text>
                    <Text style={styles.cardLocation} numberOfLines={1}>
                      📍 {profile.location.split(',')[0]}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  tagsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  tagPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tagPillActive: {
    backgroundColor: '#0EA5E9',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tagPillTextActive: {
    color: '#FFFFFF',
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    padding: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: 'space-between',
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchPill: {
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  matchPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardHeartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cardLocation: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
