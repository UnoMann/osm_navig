import { heightPercentageToDP, widthPercentageToDP } from "react-native-responsive-screen";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, StyleSheet, Button, Text, TextInput, FlatList, TouchableOpacity, Image, Alert, SafeAreaView  } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { mapData } from './data';
import LoadingView from 'react-native-loading-view';
import haversine from "haversine";
import { startScanning, stopScanning, getUserLocation, getBleReady, getFloor } from './components/getUserLocationBle';

let userLocation2 = null;
const humanSpeed = 5; // Скорость человека в км/ч

const whitelist = [
  { mac: "F8:1B:84:5F:93:D6", latitude: 60.6393003107993, longitude: 56.8173541446036, txPower: -12, floor: 1 },
  { mac: "CD:3F:8F:1F:06:34", latitude: 60.6394054093218, longitude: 56.8173440446855, txPower: -12, floor: 1 },
  { mac: "DD:8E:91:65:60:47", latitude: 60.6394197459161, longitude: 56.8173846548389, txPower: -12, floor: 1 },
  { mac: "E5:89:28:76:D0:94", latitude: 60.63945906848, longitude: 56.8173384901052, txPower: -12, floor: 1 },
  { mac: "D1:9C:66:4E:A6:50", latitude: 60.6395513430606, longitude: 56.8173341916922, txPower: -12, floor: 1 },
  { mac: "F3:ED:44:88:67:3F", latitude: 60.6396139257895, longitude: 56.8173638888858, txPower: -12, floor: 1 },
  { mac: "EB:88:43:C7:47:86", latitude: 60.6394901596189, longitude: 56.8174212672104, txPower: -12, floor: 1 },
  { mac: "D9:86:CF:A0:F9:19", latitude: 60.6395784900809, longitude: 56.8174111126818, txPower: -12, floor: 1 },
  { mac: "E6:5B:17:79:73:0D", latitude: 60.63967527064, longitude: 56.8173999353838, txPower: -12, floor: 1 },
  { mac: "E2:A1:40:57:40:17", latitude: 60.6397277054952, longitude: 56.8173509965051, txPower: -12, floor: 1 },
  { mac: "E0:90:C0:71:71:45", latitude: 60.6396469765704, longitude: 56.8173164885628, txPower: -12, floor: 1 },
  { mac: "E8:D7:7F:85:3A:CE", latitude: 60.639426463297, longitude: 56.8174097473751, txPower: -12, floor: 1 },
  { mac: "C2:6E:12:64:54:8B", latitude: 60.6394096064589, longitude: 56.8173613535366, txPower: -12, floor: 1 },
  { mac: "F6:5E:21:B0:67:34", latitude: 60.6393117770631, longitude: 56.8173961047646, txPower: -12, floor: 1.5 },
  { mac: "DD:90:CA:49:9D:B0", latitude: 60.6397335863644, longitude: 56.8173617755579, txPower: -12, floor: 1 },
  { mac: "F1:34:89:DB:A7:82", latitude: 60.6398369781833, longitude: 56.8173278601273, txPower: -12, floor: 1.5 },
  { mac: "E4:C7:1E:BC:81:BB", latitude: 60.6394261512748, longitude: 56.8174094704649, txPower: -12, floor: 2 },
  { mac: "С8:12:93:2A:BC:9D", latitude: 60.6394093630291, longitude: 56.817361176472, txPower: -12, floor: 2 },
  { mac: "E7:CC:1F:44:43:C1", latitude: 60.6394199558439, longitude: 56.8173841742843, txPower: -12, floor: 2 },
  { mac: "FE:0B:A3:DF:51:84", latitude: 60.6394481701012, longitude: 56.8174336535161, txPower: -12, floor: 2 },
  { mac: "EF:45:0C:66:A8:0B", latitude: 60.6397149315255, longitude: 56.8174036175095, txPower: -12, floor: 2 },
  { mac: "DE:CC:94:7B:FE:24", latitude: 60.6394119592347, longitude: 56.8173332380245, txPower: -12, floor: 2 },
  { mac: "E1:AE:CE:7B:2F:B8", latitude: 60.6395773158853, longitude: 56.817405021566, txPower: -12, floor: 2 },
  { mac: "C3:C4:4A:6C:10:E7", latitude: 60.6394970489153, longitude: 56.817376500832, txPower: -12, floor: 2 },
  { mac: "DF:D9:9B:37:FC:52", latitude: 60.6395523555097, longitude: 56.8173333321298, txPower: -12, floor: 2 },
  { mac: "EF:43:7F:F4:32:DF", latitude: 60.6396559263216, longitude: 56.8173589430911, txPower: -12, floor: 2 },
  { mac: "C6:CA:FD:32:9F:3C", latitude: 60.639736887485, longitude: 56.8173497659074, txPower: -12, floor: 2 },
  { mac: "F2:A5:4E:56:9A:C6", latitude: 60.639677861749, longitude: 56.8173035143455, txPower: -12, floor: 2 },
  { mac: "CF:08:29:A1:15:15", latitude: 60.6397414949666, longitude: 56.8173603155616, txPower: -12, floor: 2 },
  { mac: "FD:A0:FE:9F:EF:F3", latitude: 60.6392863141239, longitude: 56.8174004846505, txPower: -12, floor: 2.5 },
  { mac: "CD:DC:5E:45:1A:A0", latitude: 60.6398370751369, longitude: 56.8173282233033, txPower: -12, floor: 2.5 },
  { mac: "ED:3D:06:A3:72:38", latitude: 60.639503856753, longitude: 56.817346835359, txPower: -12, floor: 3 },
  { mac: "ED:6D:53:D1:C7:A3", latitude: 60.6395232246863, longitude: 56.8174026842016, txPower: -12, floor: 3 },
  { mac: "F4:BA:53:D6:3C:1B", latitude: 60.6396275868384, longitude: 56.8173909605497, txPower: -12, floor: 3 },
  { mac: "E4:AC:E8:DA:2D:96", latitude: 60.639607892787, longitude: 56.8173355325953, txPower: -12, floor: 3 },
  { mac: "C7:2A:02:A9:7D:0A", latitude: 60.6395510135791, longitude: 56.8173313357852, txPower: -12, floor: 3 },
  { mac: "F0:46:F3:84:07:7B", latitude: 60.6395787300311, longitude: 56.8174068221811, txPower: -12, floor: 3 },
  { mac: "FC:24:E1:4A:12:A5", latitude: 60.6394211059657, longitude: 56.8173844588397, txPower: -12, floor: 3 },
  { mac: "F8:F4:4D:AA:5C:86", latitude: 60.6394280678333, longitude: 56.8174089975643, txPower: -12, floor: 3 },
  { mac: "DD:FE:A5:2A:74:3A", latitude: 60.6394114724523, longitude: 56.8173614463291, txPower: -12, floor: 3 },
  { mac: "CE:2F:85:DF:09:7B", latitude: 60.6394075256815, longitude: 56.8173065955102, txPower: -12, floor: 3 },
  { mac: "E2:3B:B5:9D:12:E5", latitude: 60.6394479649511, longitude: 56.8174616700533, txPower: -12, floor: 3 },
  { mac: "CD:88:1D:32:71:E9", latitude: 60.6396560944651, longitude: 56.8173586506289, txPower: -12, floor: 3 },
  { mac: "E0:83:0E:14:30:A1", latitude: 60.6397376621334, longitude: 56.8173503061506, txPower: -12, floor: 3 },
  { mac: "FD:FE:BB:82:D7:FB", latitude: 60.6397256395492, longitude: 56.8174062180844, txPower: -12, floor: 3 },
  { mac: "E7:67:79:29:34:D3", latitude: 60.6396630297007, longitude: 56.8173045805598, txPower: -12, floor: 3 },
  { mac: "F8:CA:9D:EF:38:C8", latitude: 60.6397894391545, longitude: 56.8173718164588, txPower: -12, floor: 3 },
  { mac: "E3:12:76:E7:C4:4F", latitude: 60.6397726968228, longitude: 56.8173256421651, txPower: -12, floor: 3 }
];
console.log(Math.max(...whitelist.map(item => item.floor)));
// Фильтрация GeoJSON по этажу
const filterGeojsonByFloor = (geojson, selectedFloor) => {
  return {
    type: "FeatureCollection",
    features: geojson.features.filter(
      feature => feature.properties.level === selectedFloor.toString() && (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") && !feature.properties.custom
    ),
  };
};

const MapNavigator = () => {
  const [zoomLevel, setZoomLevel] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [indoorMapData, setIndoorMapData] = useState({ type: "FeatureCollection", features: [] });
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState([]);
  const [ble, setBle] = useState(false);
  const [bleReady, setBleReady] = useState(false);
  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [onNavig, setOnNavig] = useState(false)
    const [markers, setMarkers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isInvalid, setIsInvalid] = useState(false)
    const [isNormal, setIsNormal] = useState(true)
    const [isBagage, setIsBagage] = useState(false)
    const [category, setCategoty] = useState('normal') //normal, bagage, invalid
  
  
    const images = {
      house: require('./assets/images/house.png'),
      sputnik: require('./assets/images/sputnik.png'),
      flag: require('./assets/images/flag.png'),
      map: require('./assets/images/map.png'),
    };
    const [indicator, setIndicator] = useState(images.map)
    const bleRef = useRef(ble);
  const [endFloor,setEndFloor] = useState(1);
  const [userFloor,setUserFloor] = useState(1);
  const [elevatorBool, setElevatorBool] = useState(false)
  const [pandusBool, setPandusBool] = useState(true)

  useEffect(() => {
    bleRef.current = ble;
  }, [ble]); 
  useEffect(() => {
    console.log(route);
  }, [route]);
  
    // Поиск местоположения через Nominatim
    const handleSearch = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
        );
        const data = await response.json();
  
        if (data.length > 0) {
          const location = {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
          };
          const newMarker = {
            id: Date.now().toString(),
            latitude: location.latitude,
            longitude: location.longitude,
            title: searchQuery, // Теперь title корректно загружается
          };
          setIndicator(images.flag)
          setEndPoint({
            latitude: location.latitude,
            longitude: location.longitude,
            title: searchQuery,
          });
          setMarkers([newMarker])
          
  
          // mapRef.current.animateToRegion({
          //   latitude: location.latitude,
          //   longitude: location.longitude,
          //   latitudeDelta: 0.01,
          //   longitudeDelta: 0.01,
          // }, 1000);
        } else {
          Alert.alert('Объект не найден');
        }
      } catch (error) {
        Alert.alert('Ошибка при поиске');
      }
    };
  
    // Выбор подсказки из списка
    const handleSelectSuggestion = (suggestion) => {
      setSearchQuery(suggestion.display_name);
      setSuggestions([]);
      handleSearch;
    };
   // Получение подсказок для автозаполнения
    const fetchSuggestions = async (query) => {
      try {
        if (query.length > 2) {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
          );
          const data = await response.json();
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.log('Ошибка при получении подсказок', error);
      }
    };
    // Функция для получения названия через Nominatim
    const fetchLocationName = async (latitude, longitude) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
        );
        const data = await response.json();
    
        if (!data.address) return "Неизвестное место";
    
        // 🎯 Приоритет названия: Компания → Здание → POI → Улица → Город → Область → Страна
        const title =
          data.name || 
          data.address.building || 
          data.address.shop || 
          data.address.amenity || 
          data.address.tourism || 
          data.address.leisure || 
          data.address.road || 
          data.address.city || 
          data.address.town || 
          data.address.village || 
          data.address.state || 
          data.address.country || 
          "Без названия";
    
        return title;
      } catch (error) {
        console.error("Ошибка при запросе к Nominatim:", error);
        return "Ошибка";
      }
    };
    
    
  
  
    

  // Функция для проверки, находится ли точка внутри многоугольника
  const isPointInPolygon = (point, polygon) => {
    const x = point.latitude;
    const y = point.longitude;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  };

  // Функция для извлечения точек с тегами buildWall из GeoJSON
  const getBuildingVerticesFromGeoJSON = (geojson) => {
    const buildingVertices = [];

    // Проходим по всем объектам в GeoJSON
    geojson.features.forEach((feature) => {
      if (feature.properties && feature.properties.buildWall) {
        // Если у объекта есть свойство buildWall, добавляем его координаты
        const coordinates = feature.geometry.coordinates;
        buildingVertices.push({
          latitude: coordinates[1], // GeoJSON использует порядок [longitude, latitude]
          longitude: coordinates[0],
          buildWall: feature.properties.buildWall, // Сохраняем тег для отладки
        });
      }
    });

    // Сортируем точки по тегу buildWall (1, 2, 3, 4)
    buildingVertices.sort((a, b) => a.buildWall - b.buildWall);

    return buildingVertices;
  };

  // Проверка, находится ли пользователь внутри здания
  const isUserInsideBuilding = (userLocation, buildingVertices) => {
    if (!userLocation || !buildingVertices || buildingVertices.length < 3) {
      console.log("Недостаточно данных для проверки");
      return false;
    }

    // Проверяем, находится ли точка внутри многоугольника
    return isPointInPolygon(userLocation, buildingVertices);
  };

// // Пример вызова
// const userLocation = { latitude: 53.422030, longitude: 58.981320 }; // Пример координат пользователя
// const isInside = isUserInsideBuilding(userLocation, buildingVertices);

// console.log(isInside ? "Пользователь внутри здания" : "Пользователь снаружи здания");

  // Получение местоположения через GPS
  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Разрешение на доступ к геолокации отклонено');
      return;
    }
    await Location.enableNetworkProviderAsync();

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 1,
      },
      (location) => {
        if (!bleRef.current) {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          userLocation2 = {
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude,
          };
        }
      }
    );

    setLocationSubscription(subscription);
  };

  useEffect(() => {
    startScanning(whitelist);
    SetReadyBle();
    fetchLocation();

    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    const filteredData = filterGeojsonByFloor(mapData, selectedFloor);
    setIndoorMapData(filteredData);
  }, [selectedFloor]);

  useEffect(() => {
    const buildRouteAsync = async () => {
      if (userLocation2 && endPoint && !isBuildingRoute) {
        setIsBuildingRoute(true);
        try {
          await buildRoute();
        } catch (error) {
          console.error("Ошибка при построении маршрута:", error);
        } finally {
          setIsBuildingRoute(false);
        }
      }
    };

    buildRouteAsync();
  }, [userLocation2, endPoint]);

  const SetReadyBle = async () => {
    if (!bleReady) {
      try {
        const isReady = await getBleReady();
        setBleReady(isReady);
        setTimeout(() => {
          SetReadyBle();
        }, 1000);
      } catch (error) {
        console.log('SetReadyBle: Error:', error.message);
      }
    }
  };

  const fetchLocation = async () => {
    try {
      if (bleRef.current) {
        const location = await getUserLocation();
        if (location) {
          setUserLocation(location);
          userLocation2 = location;
        } else {
          console.log("BLE не возвращает корректную локацию");
        }
      } else {
        getLocation();
      }
      setTimeout(fetchLocation, 1000);
    } catch (error) {
      console.log("Ошибка получения локации:", error.message);
    }
  };

  const handleLevelChange = (level, what) => {
    switch (what) {
      case "up":
        if (selectedFloor < 3) {
          setSelectedFloor(level === -1 ? 1 : level + 1);
        }
        break;
      case "down":
        if (selectedFloor > 1) {
          setSelectedFloor(level === 1 ? -1 : level - 1);
        }
        break;
    }
  };

  const handleSetEnd = async (event) => {
    event.persist(); // предотвращает очистку события (можно убрать, если сохраняем данные в переменные)

    // Сохраняем координаты в переменные
    const latitude = event.nativeEvent.coordinate.latitude;
    const longitude = event.nativeEvent.coordinate.longitude;
  
    // Получаем название через API
    const title = await fetchLocationName(latitude, longitude);
  
    // Создаём новый маркер
    const newMarker = {
      id: Date.now().toString(),
      latitude,
      longitude,
      title, // Теперь title корректно загружается
    };
    if (!isBuildingRoute) {
      setEndPoint(event.nativeEvent.coordinate);
      setEndFloor(selectedFloor);
      setIndicator(images.flag)
      setMarkers([newMarker])
    }
  };

  const calculateRouteDistance = (routeCoordinates) => {
    let distance = 0;
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[i + 1];
      distance += haversine(start, end, { unit: "meter" });
    }
    return distance;
  };

  const buildRoute = async () => {
  if (!userLocation2 || !endPoint) {
    console.log("Начальная и/или конечная точка не установлены");
    return;
  }

  const buildingVertices = getBuildingVerticesFromGeoJSON(mapData);
  const isInside = isUserInsideBuilding(userLocation2, buildingVertices);
  const isEndInside = isUserInsideBuilding(endPoint, buildingVertices);

  try {
    if (isInside) {
      if (isEndInside) {
        await buildRouteInsideBuilding(userLocation2, endPoint);
      } else {
        await buildRouteInsideToOutside(userLocation2, endPoint);
      }
    } else {
      if (isEndInside) {
        await buildRouteOutsideToInside(userLocation2, endPoint);
      } else {
        await buildRouteOutside(userLocation2, endPoint);
      }
    }
  } catch (error) {
    console.error("Ошибка при построении маршрута:", error);
  }
};

  const clearRoute = () => {
    setEndPoint(null);
    setMarkers([])
    setRoute([]);
    setRouteDistance(null);
    setOnNavig(false)
  };

  const handleRegionChange = (region) => {
    const zoom = Math.log2(360 / region.longitudeDelta);
    setZoomLevel(Math.round(zoom));
  };
// Вспомогательная функция для построения маршрута на одном этаже
const buildSingleFloorRoute = async (start, end, floor) => {
  try {
    const lines = mapData.features.filter(
      (feature) =>
        feature.geometry.type === "LineString" &&
        feature.properties.custom === "footpath" &&
        Number(feature.properties.level) === floor
    );

    const findNearestPointOnLine = (point, lineCoordinates) => {
      let nearestPoint = null;
      let nearestDistance = Infinity;

      for (let i = 0; i < lineCoordinates.length - 1; i++) {
        const startCoord = lineCoordinates[i];
        const endCoord = lineCoordinates[i + 1];
        const projectedPoint = getNearestPointOnSegment(point, startCoord, endCoord);
        const distance = haversine(point, projectedPoint);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPoint = { ...projectedPoint, index: i };
        }
      }

      return nearestPoint;
    };

    let startLine = null;
    let endLine = null;
    let startNearestPoint = null;
    let endNearestPoint = null;

    for (const line of lines) {
      const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));

      const startPoint = findNearestPointOnLine(start, lineCoordinates);
      const endPoint = findNearestPointOnLine(end, lineCoordinates);

      if (startPoint && endPoint) {
        startLine = lineCoordinates;
        endLine = lineCoordinates;
        startNearestPoint = startPoint;
        endNearestPoint = endPoint;
        break;
      }
    }

    if (!startLine || !endLine || !startNearestPoint || !endNearestPoint) {
      console.log("Не удалось найти ближайшие точки на линии");
      return [];
    }

    const startIndex = Math.min(startNearestPoint.index, endNearestPoint.index);
    const endIndex = Math.max(startNearestPoint.index, endNearestPoint.index);

    const isStartCloserToUser =
      haversine(start, startLine[startIndex]) < haversine(start, startLine[endIndex]);

    const internalRoute = isStartCloserToUser
      ? [startNearestPoint, ...startLine.slice(startIndex, endIndex + 1), endNearestPoint]
      : [endNearestPoint, ...startLine.slice(startIndex + 1, endIndex + 1), startNearestPoint];

    return internalRoute;
  } catch (error) {
    console.error("Ошибка при построении маршрута на этаже:", error);
    return [];
  }
};

// Основная функция для построения маршрута внутри здания
const buildRouteInsideBuilding = async (start, end) => {
  try {
    // Если этаж пользователя и конечной точки разные
    if (userFloor !== endFloor) {
      // Ищем лифты на этаже пользователя
      let elevatorFeatures = null;
      if(elevatorBool){
        elevatorFeatures = mapData.features.filter(
          (feature) =>
            feature.geometry.type === "Point" &&
            feature.properties.custom === "elevator" &&
            Number(feature.properties.level) === userFloor
        );
      }else{
        elevatorFeatures = mapData.features.filter(
          (feature) =>
            feature.geometry.type === "Point" &&
            feature.properties.custom === "stairs" &&
            Number(feature.properties.level) === userFloor
        );
      }


      if (elevatorFeatures.length === 0) {
        console.error("Не найден лифт на этаже пользователя");
        return;
      }

      // Выбираем ближайший лифт к стартовой точке
      let nearestElevator = null;
      let minElevatorDistance = Infinity;
      elevatorFeatures.forEach((elevator) => {
        const elevatorPoint = {
          latitude: elevator.geometry.coordinates[1],
          longitude: elevator.geometry.coordinates[0],
        };
        const distance = haversine(start, elevatorPoint);
        if (distance < minElevatorDistance) {
          minElevatorDistance = distance;
          nearestElevator = elevatorPoint;
        }
      });

      // Строим маршрут от пользователя до лифта на этаже пользователя
      const routeToElevator = await buildSingleFloorRoute(start, nearestElevator, userFloor);
      if (!routeToElevator.length) {
        console.error("Не удалось построить маршрут до лифта");
        return;
      }

      // Строим маршрут от лифта до конечной точки на целевом этаже
      const routeFromElevator = await buildSingleFloorRoute(nearestElevator, end, endFloor);
      if (!routeFromElevator.length) {
        console.error("Не удалось построить маршрут от лифта до конечной точки");
        return;
      }

      // Объединяем оба маршрута
      const combinedRoute = [...routeFromElevator,  nearestElevator, ...routeToElevator];
      setRoute(combinedRoute);

      // Рассчитываем общую дистанцию маршрута
      const distance = calculateRouteDistance(combinedRoute);
      setRouteDistance(distance);

      return combinedRoute;
    } else {
      // Если этажи совпадают — строим маршрут на одном этаже
      const route = await buildSingleFloorRoute(start, end, userFloor);
      setRoute(route);
      const distance = calculateRouteDistance(route);
      setRouteDistance(distance);
      return route;
    }
  } catch (error) {
    console.error("Ошибка при построении маршрута внутри здания:", error);
  }
};


  const buildRouteInsideToOutside = async (start, end) => {
    try   {
      // Шаг 1: Находим ближайший выход из здания
      let exits = null;
      if(pandusBool){
        exits = mapData.features.filter(
          (feature) => feature.properties.entrance === "invalid"
        );
      }else{
        exits = mapData.features.filter(
          (feature) => feature.properties.entrance === "main"
        );
      }
  
      if (exits.length === 0) {
        console.log("Не найдено выходов из здания");
        return;
      }
  
      const nearestExit = {
        latitude: exits[0].geometry.coordinates[1],
        longitude: exits[0].geometry.coordinates[0],
      };
  
      // Шаг 2: Строим маршрут внутри здания до выхода
      const internalRoute = await buildInternalRoute(start, nearestExit);
  
      if (!internalRoute) {
        console.log("Не удалось построить внутренний маршрут");
        return;
      }
  
      // Шаг 3: Строим внешний маршрут от выхода до конечной точки
      const response = await axios.get(
        `https://router.project-osrm.org/route/v1/foot/${nearestExit.longitude},${nearestExit.latitude};${end.longitude},${end.latitude}?steps=true&geometries=geojson`
      );
  
      if (response.data.routes.length === 0) {
        console.log("OSRM не вернул маршрут");
        return;
      }
  
      const externalRoute = response.data.routes[0].geometry.coordinates.map(
        ([longitude, latitude]) => ({ latitude, longitude })
      );
  
      // Объединяем внутренний и внешний маршруты
      const fullRoute = [...internalRoute, ...externalRoute];
      setRoute(fullRoute);
  
      // Рассчитываем дистанцию
      const distance = calculateRouteDistance(fullRoute);
      setRouteDistance(distance);
    } catch (error) {
      console.error("Ошибка при построении маршрута изнутри наружу:", error);
    }
  };
  const buildRouteOutsideToInside = async (start, end) => {
    try {
      // Шаг 1: Находим ближайший вход в здание
      let exits = null;
      if(pandusBool){
        exits = mapData.features.filter(
          (feature) => feature.properties.entrance === "invalid"
        );
      }else{
        exits = mapData.features.filter(
          (feature) => feature.properties.entrance === "main"
        );
      }
  
      if (exits.length === 0) {
        console.log("Не найдено входов в здание");
        return;
      }
  
      const nearestEntrance = {
        latitude: exits[0].geometry.coordinates[1],
        longitude: exits[0].geometry.coordinates[0],
      };
  
      // Шаг 2: Строим внешний маршрут до входа
      const response = await axios.get(
        `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${nearestEntrance.longitude},${nearestEntrance.latitude}?steps=true&geometries=geojson`
      );
  
      if (response.data.routes.length === 0) {
        console.log("OSRM не вернул маршрут");
        return;
      }
  
      const externalRoute = response.data.routes[0].geometry.coordinates.map(
        ([longitude, latitude]) => ({ latitude, longitude })
      );
  
      // Шаг 3: Находим ближайшую линию с тегом custom=footpath
      const lines = mapData.features.filter(
        (feature) =>
          feature.geometry.type === "LineString" &&
          feature.properties.custom === "footpath"
      );
  
      const findNearestLineToPoint = (point, lines) => {
        let nearestLine = null;
        let nearestPointOnLine = null;
        let minDistance = Infinity;
  
        lines.forEach((line) => {
          const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
            latitude,
            longitude,
          }));
  
          for (let i = 0; i < lineCoordinates.length - 1; i++) {
            const startCoord = lineCoordinates[i];
            const endCoord = lineCoordinates[i + 1];
            const projectedPoint = getNearestPointOnSegment(point, startCoord, endCoord);
            const distance = haversine(point, projectedPoint);
  
            if (distance < minDistance) {
              minDistance = distance;
              nearestLine = lineCoordinates;
              nearestPointOnLine = projectedPoint;
            }
          }
        });
  
        return { nearestLine, nearestPointOnLine };
      };
  
      const { nearestLine, nearestPointOnLine } = findNearestLineToPoint(end, lines);
  
      if (!nearestLine || !nearestPointOnLine) {
        console.log("Не удалось найти ближайшую линию или точку на линии");
        return;
      }
  
      // Шаг 4: Строим маршрут по линии от входа до ближайшей точки
      const internalRoute = [];
      let foundNearestPoint = false;
  
      for (let i = 0; i < nearestLine.length - 1; i++) {
        const startCoord = nearestLine[i];
        const endCoord = nearestLine[i + 1];
  
        if (
          getNearestPointOnSegment(nearestPointOnLine, startCoord, endCoord).latitude === nearestPointOnLine.latitude &&
          getNearestPointOnSegment(nearestPointOnLine, startCoord, endCoord).longitude === nearestPointOnLine.longitude
        ) {
          internalRoute.push(...nearestLine.slice(0, i + 1));
          foundNearestPoint = true;
          break;
        }
      }
  
      if (!foundNearestPoint) {
        console.log("Не удалось построить маршрут по линии");
        return;
      }
  
      internalRoute.push(nearestPointOnLine);
  
      // Шаг 5: Объединяем внешний и внутренний маршруты
      const fullRoute = [...externalRoute, ...internalRoute];
      setRoute(fullRoute);
  
      // Рассчитываем дистанцию
      const distance = calculateRouteDistance(fullRoute);
      setRouteDistance(distance);
    } catch (error) {
      console.error("Ошибка при построении маршрута:", error);
    }
  };

  const buildRouteOutside = async (start, end) => {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?steps=true&geometries=geojson`
    );
  
    if (response.data.routes.length > 0) {
      const coordinates = response.data.routes[0].geometry.coordinates.map(
        ([longitude, latitude]) => ({ latitude, longitude })
      );
  
      setRoute(coordinates);
      const distance = calculateRouteDistance(coordinates);
      setRouteDistance(distance);
    }
  };

  const getNearestPointOnSegment = (point, start, end) => {
    const A = { latitude: start.latitude, longitude: start.longitude };
    const B = { latitude: end.latitude, longitude: end.longitude };
    const P = { latitude: point.latitude, longitude: point.longitude };
  
    const AB = {
      latitude: B.latitude - A.latitude,
      longitude: B.longitude - A.longitude,
    };
    const AP = {
      latitude: P.latitude - A.latitude,
      longitude: P.longitude - A.longitude,
    };
  
    const ab2 = AB.latitude * AB.latitude + AB.longitude * AB.longitude;
    const ap_ab = AP.latitude * AB.latitude + AP.longitude * AB.longitude;
  
    const t = Math.max(0, Math.min(1, ap_ab / ab2));
  
    return {
      latitude: A.latitude + t * AB.latitude,
      longitude: A.longitude + t * AB.longitude,
    };
  };


  
  // Вспомогательная функция для построения внутреннего маршрута
  const buildInternalRoute = async (start, end) => {
    const lines = mapData.features.filter(
      (feature) =>
        feature.geometry.type === "LineString" &&
        feature.properties.custom === "footpath"
    );
  
    const findNearestPointOnLine = (point, lineCoordinates) => {
      let nearestPoint = null;
      let nearestDistance = Infinity;
  
      for (let i = 0; i < lineCoordinates.length - 1; i++) {
        const startCoord = lineCoordinates[i];
        const endCoord = lineCoordinates[i + 1];
        const projectedPoint = getNearestPointOnSegment(point, startCoord, endCoord);
        const distance = haversine(point, projectedPoint);
  
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPoint = { ...projectedPoint, index: i };
        }
      }
  
      return nearestPoint;
    };
  
    // Находим ближайшие точки на линии для начальной и конечной точек
    let startLine = null;
    let endLine = null;
    let startNearestPoint = null;
    let endNearestPoint = null;
  
    for (const line of lines) {
      const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));
  
      const startPoint = findNearestPointOnLine(start, lineCoordinates);
      const endPoint = findNearestPointOnLine(end, lineCoordinates);
  
      if (startPoint && endPoint) {
        startLine = lineCoordinates;
        endLine = lineCoordinates;
        startNearestPoint = startPoint;
        endNearestPoint = endPoint;
        break;
      }
    }
  
    if (!startLine || !endLine || !startNearestPoint || !endNearestPoint) {
      return null;
    }
  
    // Определяем порядок точек на линии
    const startIndex = Math.min(startNearestPoint.index, endNearestPoint.index);
    const endIndex = Math.max(startNearestPoint.index, endNearestPoint.index);
  
    // Проверяем, какая точка ближе к пользователю
    const isStartCloserToUser = haversine(start, startLine[startIndex]) < haversine(start, startLine[endIndex]);
  
    // Строим маршрут в зависимости от близости точек
    return isStartCloserToUser
      ? [start, ...startLine.slice(startIndex, endIndex + 1), end]
      : [start, ...startLine.slice(endIndex, startIndex - 1 || 0).reverse(), end];
  };


  return (
    <SafeAreaView style={styles.container}>
      {userLocation ? (
        <View>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onRegionChangeComplete={handleRegionChange}
            onPress={handleSetEnd}
          >
            <Marker coordinate={userLocation2} title="Вы находитесь здесь" pinColor="blue" />
            {endPoint && <Marker coordinate={endPoint} title="Конечная точка" pinColor="red" />}
            {zoomLevel > 16 &&
              indoorMapData.features.map((feature) => (
                feature.geometry && feature.geometry.type === "LineString" && (
                  <Polyline
                    key={feature.geometry.coordinates.toString()}
                    coordinates={feature.geometry.coordinates.map(([longitude, latitude]) => ({
                      latitude,
                      longitude,
                    }))}
                    strokeColor="#000"
                    strokeWidth={3}
                  />
                )
              ))}
            {route.length > 0 && (
              <Polyline
                coordinates={route}
                strokeColor="#FF0000"
                strokeWidth={5}
                lineDashPattern={[5, 5]}
              />
            )}
          </MapView>
          <View style={styles.header}>
        <TouchableOpacity onPress={()=>{
          Alert.alert('🤙 Обойдёшься', 'Данная функция ещё не реализована', [
            {text: 'OK', onPress: () => console.log('OK Pressed')},
          ]);
      }}>
         <View style={styles.square}>
          <Image source={require('./assets/images/profile.png')} style={[styles.profile]}></Image>
          </View> 
        </TouchableOpacity>
       {/* Поле поиска и кнопки */}
       <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск"
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            fetchSuggestions(text); // Автозаполнение
          }}
        />
        <TouchableOpacity onPress={handleSearch}>
         <View style={styles.searchButton}>
          <Image source={require('./assets/images/search.png')} style={[styles.profile]}></Image>
          </View> 
        </TouchableOpacity>
      </View>
      <View style={[styles.square ,{marginLeft:widthPercentageToDP(1.3)}]}>
          <Image source={indicator} style={[styles.profile]}></Image>
      </View> 
      {/*  */}
      {/* Список подсказок */}
      {suggestions.length > 0 && (
        <FlatList
          style={styles.suggestionsList}
          data={suggestions}
          keyExtractor={(item) => item.place_id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleSelectSuggestion(item)}>
              <View style={styles.suggestionItem}>
                <Text>{item.display_name}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
    <View style={styles.topRight}>
          <Button
            title={ble ? "BLE" : "GPS"}
            onPress={() => {
              setBle((prevBle) => {
                if (locationSubscription) {
                  locationSubscription.remove();
                  setLocationSubscription(null);
                }
                return !prevBle;
              });
            }}
            disabled={!bleReady}
          />
        </View>
        </View>
      ) : (
        <LoadingView loading={true} size={100} />
      )}
      {zoomLevel > 16 &&
        <View style={styles.levelControls}>
          <TouchableOpacity onPress={() => handleLevelChange(selectedFloor, "up")}  style={styles.floorSquare}><Text style={styles.floorText}>⬆️</Text></TouchableOpacity>
          <View onPress={() => handleLevelChange(selectedFloor, "up")}  style={styles.floorSquare}><Text style={styles.floorText}>{selectedFloor}</Text></View>
          <TouchableOpacity onPress={() => handleLevelChange(selectedFloor, "down")}  style={styles.floorSquare}><Text style={styles.floorText}>⬇️</Text></TouchableOpacity>
        </View>}
      {/* {endPoint && (
        <View style={styles.routeControls}>
          <Button title="Построить Маршрут" onPress={buildRoute} />
          <Button title="Очистить" onPress={clearRoute} />
        </View>
      )} */}
          {endPoint && (
        <View style={[styles.routeControls, {height: onNavig ? '15%':'40%'}]}>
          {!onNavig ? (
            <View>
            <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              Время маршурта: {(routeDistance / 1000 * humanSpeed * 6).toFixed(0)} мин
            </Text>
            <Text style={styles.distanceText}>
              Расстояние: {(routeDistance / 1000).toFixed(2)} км,
            </Text>
            <TouchableOpacity onPress={()=>{
              setIndicator(images.map);
              clearRoute()
            }}>
            <Image source={require('./assets/images/cross.png')} style={[styles.profile]}></Image>
            </TouchableOpacity>
            </View>
             {/* FlatList со списком маркеров */}
             <View style={styles.pointsContainer}>
              <View style={styles.pointsItem}>
                <Image source={require('./assets/images/location.png')} style={styles.locationImg}/>
                <Text style={styles.locationText}>Моё местоположение</Text>
              </View>
      <FlatList
        data={markers}
        keyExtractor={(item) => item.id}
        style={{}}
        renderItem={({ item }) => (
          <View style={styles.pointsItem}>
            <Image style={styles.locationImg} source={require('./assets/images/location.png')}/>
            <Text style={styles.locationText}>{item.title}</Text>
          </View>
        )}
      />
      </View>
      <TouchableOpacity style={[styles.button, {backgroundColor:'white', borderColor:'black', borderWidth:1, marginTop:heightPercentageToDP(1)}]} onPress={()=>{
          Alert.alert('🤙 Обойдёшься', 'Данная функция ещё не реализована', [
            {text: 'OK', onPress: () => console.log('OK Pressed')},
          ]);
      }}>
        <Text style={{}}>Добавить точку!</Text>
      </TouchableOpacity>
      <View style={styles.chooseCategory}>
          <TouchableOpacity style={[styles.categoryItem, {backgroundColor: isNormal ? 'white' : '#f6f6f6'}]} onPress={()=>{
            setElevatorBool(false)
            setPandusBool(false)
            setIsNormal(true),
            setIsBagage(false),
            setIsInvalid(false),
            setCategoty('normal')
          }}>
            <Text style={{}}>Без багажа</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryItem, {backgroundColor: isBagage ? 'white' : '#f6f6f6'}]} onPress={()=>{
            setElevatorBool(true)
            setPandusBool(false)
            setIsBagage(true),
            setIsNormal(false),
            setIsInvalid(false),
            setCategoty('bagage')
          }}>
            <Text style={{}}>С багажом</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryItem, {backgroundColor: isInvalid ? 'white' : '#f6f6f6'}]} onPress={()=>{
            setElevatorBool(true)
            setPandusBool(true)
            setIsInvalid(true),
            setIsBagage(false),
            setIsNormal(false),
            setCategoty('invalid')
          }}>
            <Text style={{}}>На коляске</Text>
          </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.button, {backgroundColor:'#4F9BFF', marginTop:heightPercentageToDP(1)}]} onPress={()=>{
              if(ble){
                setIndicator(images.house)
              }else{
                setIndicator(images.sputnik)
              }
              buildRoute,
              setOnNavig(true)
      }}>
              <Text style={{color:'white'}}>Погнали!</Text>
      </TouchableOpacity>
          </View>    
            ) : (
              <View>
                <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              Время маршурта: {(routeDistance / 1000 * humanSpeed * 6).toFixed(0)} мин
            </Text>
            <Text style={styles.distanceText}>
              Расстояние: {(routeDistance / 1000).toFixed(2)} км,
            </Text>
            <TouchableOpacity onPress={()=>{
              setIndicator(images.map);
              clearRoute()
            }}>
            <Image source={require('./assets/images/cross.png')} style={[styles.profile]}></Image>
            </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.button, {backgroundColor:'#FF5A4F', marginTop:heightPercentageToDP(1)}]} onPress={()=>{
              setIndicator(images.map);
              clearRoute()
      }}>
              <Text style={{color:'white'}}>Завершить!</Text>
      </TouchableOpacity>
            </View>
            )}
        </View>
      )}

      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
    zIndex:-1,    
    },
  distanceContainer: {
    width: '90%',
    padding: 10,
    flexDirection:'row',
    alignItems:'center'
  },
  distanceText: {
    color: 'black',
    fontSize: 16,
    width: widthPercentageToDP(45),
    fontSize:widthPercentageToDP(3)
  },
  levelControls: {
    position: 'absolute',
    width: '100%',
    marginLeft:widthPercentageToDP(85),
    marginTop:heightPercentageToDP(30)
  },
  topRight: {
    position: 'absolute',
    start: 150,
    marginTop:heightPercentageToDP(7.8),
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  levelText: {
    fontSize: 18,
  },
  routeControls: {
    position: 'absolute',
    width: '100%',
    backgroundColor:'#fff',
    height:'40%',
    bottom:0,
    borderTopEndRadius:15,
    borderTopStartRadius:15
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 10,
    elevation: 10,
    width:widthPercentageToDP(66),
    height:widthPercentageToDP(12),
    marginLeft:widthPercentageToDP(1.3),
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 5,
    marginLeft:widthPercentageToDP(2),
    marginRight:widthPercentageToDP(1.3)

  },
  suggestionsList: {
    position: 'absolute',
    top: 80,
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 5,
    elevation: 10,
    maxHeight: 150,
    zIndex: 1,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  header:{
    flexDirection:'row',
    zIndex:1,
    marginTop:heightPercentageToDP(1.8),
    marginLeft:widthPercentageToDP(4),
    position: 'absolute',
  },
  square:{
    backgroundColor:'white',
    borderRadius:15,
    width:widthPercentageToDP(12),
    height:widthPercentageToDP(12),
    justifyContent:'center',
    alignItems:'center',
  },
  floorSquare:{
    backgroundColor:'white',
    borderRadius:15,
    width:widthPercentageToDP(12),
    height:widthPercentageToDP(12),
    justifyContent:'center',
    alignItems:'center',
    marginTop:heightPercentageToDP(1)
  },
  floorText:{
    fontSize:widthPercentageToDP(4.4)
  },
  profile:{
    width:widthPercentageToDP(4),
    height:widthPercentageToDP(4)
  },
  searchButton:{
    justifyContent:'center',
    alignItems:'center',
    borderRadius:12,
    width:widthPercentageToDP(8),
    height:widthPercentageToDP(8),
    backgroundColor:'#F6F6F6'
    },
    pointsContainer:{
      backgroundColor:'#F6F6F6',
      width:widthPercentageToDP(93),
      alignSelf:'center',
      borderRadius: 15,
      height:heightPercentageToDP(12.5)
    },
    pointsItem:{
      backgroundColor:'white',
      flexDirection:'row',
      alignSelf:'center',
      width:widthPercentageToDP(90),
      marginTop:heightPercentageToDP(0.5),
      height:heightPercentageToDP(4.2),
      borderRadius:15,
      alignItems:'center'
    },
    locationImg:{
      width:widthPercentageToDP(2.8),
    height:widthPercentageToDP(3.5),
    marginLeft:widthPercentageToDP(4)
    },
    locationText:{
      marginLeft:widthPercentageToDP(2)
    },
    button:{
      alignSelf:'center',
      alignItems:'center',
      justifyContent:'center',
      width:widthPercentageToDP(93),
      height:heightPercentageToDP(4.7),
      borderRadius:15
    },
    chooseCategory:{
      alignSelf:'center',
      alignItems:'center',
      justifyContent:'center',
      width:widthPercentageToDP(93),
      height:heightPercentageToDP(4.7),
      borderRadius:15,
      backgroundColor:'#F6F6F6',
      marginTop:heightPercentageToDP(2),
      flexDirection:'row'
    },
    categoryItem:{
      height:heightPercentageToDP(3.5),
      alignItems:'center',
      justifyContent:'center',
      width:widthPercentageToDP(30),
      borderRadius:10
    }
});

export default MapNavigator;