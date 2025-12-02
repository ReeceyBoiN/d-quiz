/**
 * Device ID utility for phone app persistence
 * Generates a unique device ID on first load and stores it in localStorage
 */

const DEVICE_ID_KEY = 'popquiz_device_id';

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a new device ID using timestamp and random string
    deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

export function getDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}
