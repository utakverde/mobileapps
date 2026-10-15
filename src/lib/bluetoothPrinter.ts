import { PermissionsAndroid, Platform } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { BluetoothDevice } from '@constants/types';

type PrinterPayload = {
  transportEncoding?: string;
  encoding?: string;
  init?: string;
  body?: string;
  feed?: string;
  feedAndCut?: string;
};

function mapDevice(device: any): BluetoothDevice {
  return {
    id: String(device.id || device.address || ''),
    name: String(device.name || device.deviceName || 'Bluetooth Printer'),
    address: String(device.address || device.id || ''),
    isPaired: Boolean(device.bonded ?? true),
    isConnected: Boolean(device.connected ?? false),
    rssi: device.rssi,
  };
}

export function payloadToText(payload: PrinterPayload | string): string {
  if (typeof payload === 'string') return payload;
  return `${payload.init || ''}${payload.body || ''}${payload.feedAndCut || payload.feed || ''}`;
}

export async function ensureBluetoothPrintReady(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Bluetooth thermal printing is currently wired for Android devices only.');
  }

  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
        ];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.find((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) throw new Error('Bluetooth permission is required to print.');

  const available = await RNBluetoothClassic.isBluetoothAvailable();
  if (!available) throw new Error('This device does not support Bluetooth Classic printing.');

  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    const wasEnabled = await RNBluetoothClassic.requestBluetoothEnabled();
    if (!wasEnabled) throw new Error('Bluetooth must be enabled before printing.');
  }
}

export async function listBondedBluetoothPrinters(): Promise<BluetoothDevice[]> {
  await ensureBluetoothPrintReady();
  const devices = await RNBluetoothClassic.getBondedDevices();
  return devices.map(mapDevice);
}

export async function connectBluetoothPrinter(address: string): Promise<BluetoothDevice> {
  if (!address) throw new Error('Printer Bluetooth address is missing.');
  await ensureBluetoothPrintReady();
  const connected = await RNBluetoothClassic.isDeviceConnected(address);
  const device = connected
    ? await RNBluetoothClassic.getConnectedDevice(address)
    : await RNBluetoothClassic.connectToDevice(address);
  return { ...mapDevice(device), isConnected: true };
}

export async function sendBluetoothPrint(address: string, payload: PrinterPayload | string): Promise<boolean> {
  if (!address) throw new Error('Printer Bluetooth address is missing.');
  const device = await connectBluetoothPrinter(address);
  const text = payloadToText(payload);
  if (!text.trim()) throw new Error('Nothing to print.');
  const encoding = typeof payload === 'string' ? 'latin1' : payload.transportEncoding || 'latin1';
  return RNBluetoothClassic.writeToDevice(device.address, text, encoding as any);
}
