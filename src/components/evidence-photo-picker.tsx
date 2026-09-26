import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Palette } from '@/components/flat-judge-ui';
import { Typography } from '@/constants/typography';

export type EvidencePhoto = {
  id: string;
  uri: string;
  mimeType: string | null;
};

const MAX_PHOTOS = 3;

export function EvidencePhotoPicker({
  photos,
  onChange,
  onError,
  disabled = false,
}: {
  photos: EvidencePhoto[];
  onChange: (photos: EvidencePhoto[]) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const isFull = photos.length >= MAX_PHOTOS;

  function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const remaining = MAX_PHOTOS - photos.length;
    const added = assets.slice(0, remaining).map((asset) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
    }));
    onChange([...photos, ...added]);
    onError(assets.length > remaining ? `You can attach up to ${MAX_PHOTOS} photos.` : null);
  }

  async function choosePhotos() {
    if (disabled || picking || isFull) return;
    setPicking(true);
    onError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - photos.length,
        quality: 0.75,
      });
      if (!result.canceled && result.assets.length) addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not open your photo library.');
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto() {
    if (disabled || picking || isFull) return;
    setPicking(true);
    onError(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          onError('Camera access was not granted. You can still choose photos from your library.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.75,
      });
      if (!result.canceled && result.assets.length) addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not open the camera.');
    } finally {
      setPicking(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photo evidence <Text style={styles.optional}>(optional)</Text></Text>
      <Text style={styles.help}>Choose up to {MAX_PHOTOS} images or take a picture. Photos stay private to this household.</Text>
      <View style={styles.actions}>
        <PickerButton disabled={disabled || picking || isFull} label={picking ? 'Opening…' : 'Choose photos'} onPress={() => { void choosePhotos(); }} />
        <PickerButton disabled={disabled || picking || isFull} label="Take a picture" onPress={() => { void takePhoto(); }} />
      </View>
      {photos.length ? (
        <View style={styles.photoList}>
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                disabled={disabled}
                onPress={() => onChange(photos.filter((item) => item.id !== photo.id))}
                style={styles.removeButton}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PickerButton({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '800' },
  optional: { color: Palette.muted, fontWeight: '500' },
  help: { color: Palette.muted, fontSize: Typography.caption, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: Palette.line, backgroundColor: Palette.card },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: Palette.ink, fontSize: Typography.caption, fontWeight: '800' },
  photoList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { position: 'relative' },
  thumbnail: { width: 76, height: 76, borderRadius: 12, backgroundColor: Palette.line },
  removeButton: { position: 'absolute', top: -5, right: -5, width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Palette.ink, borderWidth: 2, borderColor: Palette.paper },
  removeText: { color: Palette.paper, fontSize: Typography.heading, lineHeight: 20, fontWeight: '700' },
});
