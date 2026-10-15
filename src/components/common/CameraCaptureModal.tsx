import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { Colors } from '@constants/colors';
import { ensureCameraPermission } from '@lib/devicePermissions';

export type CapturedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

type CameraFacing = 'front' | 'back';

type CameraCaptureModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (photo: CapturedPhoto) => void;
  defaultFacing?: CameraFacing;
};

export default function CameraCaptureModal({
  visible,
  title,
  onClose,
  onCaptured,
  defaultFacing = 'back',
}: CameraCaptureModalProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permissionReady, setPermissionReady] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>(defaultFacing);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<CapturedPhoto | null>(null);
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    let alive = true;

    if (!visible) {
      setPreview(null);
      setCapturing(false);
      setPermissionReady(false);
      setZoom(0);
      return;
    }

    setFacing(defaultFacing);
    setZoom(0);
    ensureCameraPermission().then((allowed) => {
      if (alive) setPermissionReady(allowed);
      if (!allowed) onClose();
    });

    return () => {
      alive = false;
    };
  }, [defaultFacing, onClose, visible]);

  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: true });
      if (photo?.uri) {
        setPreview({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
        });
      }
    } finally {
      setCapturing(false);
    }
  };

  const usePhoto = () => {
    if (!preview) return;
    onCaptured(preview);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton} activeOpacity={0.8}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
            style={styles.iconButton}
            activeOpacity={0.8}
            disabled={Boolean(preview)}
          >
            <MaterialCommunityIcons name="camera-flip" size={24} color={preview ? 'rgba(255,255,255,0.35)' : Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraWrap}>
          {preview ? (
            <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="cover" />
          ) : permissionReady ? (
            <View style={styles.cameraStage}>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} autofocus="on" zoom={zoom} />
              <View style={styles.zoomHud}>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => setZoom((current) => Math.max(0, Number((current - 0.1).toFixed(2))))}
                  disabled={zoom <= 0}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={zoom <= 0 ? 'rgba(255,255,255,0.35)' : Colors.white} />
                </TouchableOpacity>
                <Text style={styles.zoomText}>{`Zoom x${(1 + zoom * 3).toFixed(1)}`}</Text>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => setZoom((current) => Math.min(1, Number((current + 0.1).toFixed(2))))}
                  disabled={zoom >= 1}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={zoom >= 1 ? 'rgba(255,255,255,0.35)' : Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.loading}>
              <MaterialCommunityIcons name="camera" size={42} color={Colors.white} />
              <Text style={styles.loadingText}>Opening camera...</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {preview ? (
            <>
              <Button mode="outlined" icon="camera-retake" onPress={() => setPreview(null)} style={styles.footerButton}>
                Retake
              </Button>
              <Button mode="contained" icon="check" onPress={usePhoto} style={styles.footerButton}>
                Use Photo
              </Button>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.shutter, capturing && styles.shutterDisabled]}
              activeOpacity={0.82}
              onPress={capturePhoto}
              disabled={!permissionReady || capturing}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 46,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#111',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  title: { flex: 1, color: Colors.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  cameraStage: { flex: 1 },
  camera: { flex: 1 },
  preview: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  zoomHud: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  zoomText: { color: Colors.white, fontSize: 13, fontWeight: '700', minWidth: 88, textAlign: 'center' },
  footer: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 24,
    backgroundColor: '#111',
  },
  footerButton: { flex: 1, borderRadius: 10 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.45 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
  },
});
