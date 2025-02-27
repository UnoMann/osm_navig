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

function getFloor() {
  let maxRssi = Math.max(...devices.map(item => item.rssi))
  console.warn("MAX RSSI-"+maxRssi)
  const itemWithMaxFloor = devices.find(item => item.rssi === maxRssi);
  console.warn("ID-"+itemWithMaxFloor.id)
  const itemwhite = whitelist.find(item => item.mac === itemWithMaxFloor.id)
  console.warn("FLOOR-"+itemwhite.floor)
  return itemWithMaxFloor.floor;
}

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

function parseMacAddress(device) {
  let mac = null;

  // Попытка извлечь MAC-адрес из manufacturerData
  if (device.manufacturerData && device.manufacturerData.data) {
    const data = Array.from(device.manufacturerData.data);
    console.log('Decoded manufacturerData:', data);

    // Проверяем последние 6 байтов
    const macBytes = data.slice(-6);
    if (macBytes.length === 6) {
      mac = macBytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
      console.log('Parsed MAC from manufacturerData:', mac);
    }
  }

  // Если MAC-адрес не найден, используем device.id
  if (!mac && device.id) {
    // mac = device.id.toUpperCase(); // Приводим к верхнему регистру
    console.log('Using device.id as MAC:', mac);
  }

  return mac;
}

// Функция для декодирования Base64 в массив байтов
function decodeBase64ToBytes(base64String) {
  const binaryString = atob(base64String); // Декодируем Base64 в строку
  const bytes = [];
  for (let i = 0; i < binaryString.length; i++) {
    bytes.push(binaryString.charCodeAt(i)); // Преобразуем каждый символ в байт
  }
  return bytes;
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
  const MAX_DISTANCE = Infinity; // Максимальное расстояние
  const DEFAULT_TXPOWER = -59; // Стандартная мощность передатчика

  const userFloor = getFloor();
  console.log(userFloor)

  const beaconData = devices.map(device => {
    const beacon = whitelist.find(w => w.mac === device.mac);
    if (!beacon) {
      console.log(`Device ${device.mac} not found in whitelist.`);
      return null;
    }
  
    const txPower = beacon.txPower;
    if (!txPower) {
      console.log(`Device ${device.mac} has no txPower in whitelist.`);
      return null;
    }

    if(userFloor && userFloor != beacon.floor){
      console.log('Device '+beacon.floor+' has not on a ' + userFloor + '.');
      return null;
    }
  
    const distance = calculateDistance(txPower, device.rssi);
    // console.log(`Calculated distance for ${device.mac}: ${distance}`);
    if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
      console.log(`Device ${device.mac} skipped due to invalid distance: ${distance}`);
      return null;
    }
  
    const rLat = beacon.longitude;
    const rLon = beacon.latitude;
    return {
      latitude: rLat,
      longitude: rLon,
      distance,
    };
  }).filter(Boolean);
  
  console.log('Filtered beacon data:', beaconData);

  console.log(devices)
  console.log('Filtered beacon data:', beaconData);
  if (beaconData.length < 3) {
    console.log('Not enough beacons for triangulation');
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
      const mac = device.id;

      if (mac && whitelist.some(w => w.mac === mac)) {
        console.log(mac+"<mac (if),  " + device.rssi)
        const existingIndex = devices.findIndex(d => d.mac === mac);

        if (existingIndex !== -1) {
          devices[existingIndex] = { mac, rssi: device.rssi, lastSeen: Date.now() };
        } else {
          devices.push({ mac, rssi: device.rssi, lastSeen: Date.now() });
        }

        if (devices.length >= 3) {
          readyForReturn = true;
          userLocation = calculateLocation(whitelist, devices);
        }else{
          readyForReturn = false;
        }
      }
    }

    removeOldDevices();
  });

  console.log('BLE scanning started...');
}

// Удаление старых устройств
function removeOldDevices(timeoutMs = 6000) {
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
    console.log('Not enough BLE beacons found to calculate location.');
    return null;
  }
}

// Проверка готовности
export function getBleReady() {
  return readyForReturn;
}