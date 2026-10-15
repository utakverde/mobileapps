import { Alert } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';

export async function ensureCameraPermission(): Promise<boolean> {
  const current = await Camera.getCameraPermissionsAsync();
  const permission = current.granted ? current : await Camera.requestCameraPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Camera permission needed', 'Allow camera access before capturing field photos.');
    return false;
  }

  return true;
}

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  const permission = current.granted ? current : await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Location permission needed', 'Allow location access before saving GPS coordinates.');
    return false;
  }

  return true;
}
