import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import base64 from 'base64-js';

const manager = new BleManager();
const devices = []; // Хранилище уникальных устройств
let userLocation = null;
let isScanning = false; // Флаг для контроля сканирования
let readyForReturn = false;
let whitelist = []; // Хранилище whitelist с координатами маяков

// Функция для запроса разрешений
async function requestPermissions() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    if (
      granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
    ) {
      return true;
    }
    throw new Error('Permissions not granted');
  } else {
    const locationStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    const bluetoothStatus = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);

    if (locationStatus === RESULTS.GRANTED && bluetoothStatus === RESULTS.GRANTED) {
      return true;
    }
    throw new Error('Permissions not granted');
  }
}

// Функция для декодирования UUID из manufacturerData
function parseUUID(manufacturerData) {
  if (!manufacturerData) return null;

  const bytes = base64.toByteArray(manufacturerData);

  if (bytes.length < 18) return null;

  const uuid = Array.from(bytes.slice(2, 18))
    .map((b, i) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

// Улучшенный расчет расстояния с учетом шума и корректировок
function calculateDistance(txPower, rssi) {
  if (rssi === 0) {
    return -1; // Если RSSI равен 0, то расстояние не может быть рассчитано
  }

  const ratio = rssi * 1.0 / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    const accuracy = (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
    return accuracy;
  }
}

// Расчет позиции с использованием мультилатерации
function calculateLocation(whitelist, devices) {
  const PATH_LOSS_EXPONENT = 2; // Коэффициент затухания
  const MIN_DISTANCE = 0.1; // Минимальное расстояние
  const MAX_DISTANCE = 100; // Максимальное расстояние
  const DEFAULT_TXPOWER = -59; // Стандартная мощность передатчика

  const beaconData = devices.map(device => {
    const beacon = whitelist.find(w => w.uuid === device.uuid);
    if (!beacon || device.rssi >= 0) return null;

    const txPower = beacon.txPower ?? DEFAULT_TXPOWER;
    const distance = calculateDistance(txPower, device.rssi);

    if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) return null;

    return {
      latitude: beacon.latitude,
      longitude: beacon.longitude,
      distance,
    };
  }).filter(Boolean);

  if (beaconData.length < 3) {
    console.warn('Not enough beacons for triangulation');
    return null;
  }

  // Мультилатерация
  const totalWeight = beaconData.reduce((sum, c) => sum + 1 / c.distance, 0);

  const weightedLatitude = beaconData.reduce(
    (sum, c) => sum + (c.latitude / c.distance),
    0
  ) / totalWeight;

  const weightedLongitude = beaconData.reduce(
    (sum, c) => sum + (c.longitude / c.distance),
    0
  ) / totalWeight;

  return { latitude: weightedLatitude, longitude: weightedLongitude };
}

// Метод для запуска бесконечного сканирования
export async function startScanning(inputWhitelist) {
  if (isScanning) {
    console.warn('Scanning is already in progress');
    return;
  }

  whitelist = inputWhitelist;
  await requestPermissions();

  isScanning = true;

  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.error('BLE scan error:', error);
      isScanning = false;
      return;
    }

    if (device && device.manufacturerData) {
      const uuid = parseUUID(device.manufacturerData);

      if (uuid && whitelist.some(w => w.uuid === uuid)) {
        const existingIndex = devices.findIndex(d => d.uuid === uuid);

        if (existingIndex !== -1) {
          devices[existingIndex] = { uuid, rssi: device.rssi, lastSeen: Date.now() };
        } else {
          devices.push({ uuid, rssi: device.rssi, lastSeen: Date.now() });
        }

        if (devices.length >= 3) {
          readyForReturn = true;
          userLocation = calculateLocation(whitelist, devices);
        }
      }
    }

    removeOldDevices();
  });

  console.log('BLE scanning started...');
}

// Удаление старых устройств
function removeOldDevices(timeoutMs = 5000) {
  const now = Date.now();
  devices.forEach((device, index) => {
    if (now - device.lastSeen > timeoutMs) {
      devices.splice(index, 1);
    }
  });
}

// Остановка сканирования
export function stopScanning() {
  if (isScanning) {
    manager.stopDeviceScan();
    isScanning = false;
    devices.length = 0;
    userLocation = null;
    readyForReturn = false;
    console.log('BLE scanning stopped.');
  }
}

// Получение текущей локации
export function getUserLocation() {
  if (readyForReturn) {
    console.log("(La,Lo) Позиция по BLE = ", userLocation.latitude, ", ", userLocation.longitude);
    return userLocation;
  } else {
    console.warn('Not enough BLE beacons found to calculate location.');
    return null;
  }
}

// Проверка готовности
export function getBleReady() {
  return readyForReturn;
}