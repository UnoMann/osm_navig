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

// Функция триангуляции
function calculateLocation(whitelist, devices) {
  // console.log('GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC ')
  const coordinates = devices.map(device => {
    const beacon = whitelist.find(w => w.uuid === device.uuid);
    if (!beacon) return null;

    const weight = 1 / Math.pow(10, Math.abs(device.rssi) / 10); // Вес по RSSI
    return { ...beacon, weight };
  }).filter(Boolean); // Убираем null-значения

  const totalWeight = coordinates.reduce((sum, c) => sum + c.weight, 0);

  if (totalWeight === 0) {
    throw new Error('Invalid weights, cannot calculate location');
  }

  const latitude = coordinates.reduce((sum, c) => sum + c.latitude * c.weight, 0) / totalWeight;
  const longitude = coordinates.reduce((sum, c) => sum + c.longitude * c.weight, 0) / totalWeight;
  // console.log({ latitude, longitude })
  return { latitude, longitude };
}

// Метод для запуска бесконечного сканирования
export async function startScanning(inputWhitelist) {
  if (isScanning) {
    console.warn('Scanning is already in progress');
    return;
  }
  
  whitelist = inputWhitelist; // Устанавливаем whitelist
  await requestPermissions();

  isScanning = true;

  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.error('BLE scan error:', error);
      isScanning = false; // Устанавливаем флаг в false
      return;
    }

    if (device && device.manufacturerData) {
      const uuid = parseUUID(device.manufacturerData);

      if (uuid && whitelist.some(w => w.uuid === uuid)) {
        // console.log(device.name+"<=name, "+uuid+"<=uuid.");
        const existingIndex = devices.findIndex(d => d.uuid === uuid);

        if (existingIndex !== -1) {
          devices[existingIndex] = { uuid, rssi: device.rssi };
        } else {
          devices.push({ uuid, rssi: device.rssi });
        }
        if(devices.length>=3){
          readyForReturn=true;
          // console.log("READY - "+readyForReturn)
          userLocation = calculateLocation(whitelist, devices);
        }
      }
    }
  });

  console.log('BLE scanning started...');
}

// Метод для остановки сканирования
export function stopScanning() {
  if (isScanning) {
    manager.stopDeviceScan();
    isScanning = false;
    devices.length = 0; // Очистка устройств
    userLocation = null; // Сброс локации
    readyForReturn = false; // Сброс флага готовности
    console.log('BLE scanning stopped.');
  }
}


// Метод для получения текущей локации
export function getUserLocation() {
  // console.log('GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC GETUSERLOC ')
  if (readyForReturn) {
    return userLocation;
  }else{
    // console.log('Not enough BLE beacons found to calculate location.');
    return null; // Возвращаем null вместо выбрасывания ошибки
  }
}
export function getBleReady() {
  // console.log("READY - "+readyForReturn)
  return readyForReturn;
}
