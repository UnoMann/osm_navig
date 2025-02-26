import React, { useEffect, useState, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, StyleSheet, Button, Text } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { mapData } from './data';
import LoadingView from 'react-native-loading-view';
import haversine from "haversine";
import { startScanning, stopScanning, getUserLocation, getBleReady } from './components/getUserLocationBle';

let userLocation2 = null;
const humanSpeed = 5; // Скорость человека в км/ч

const whitelist = [
  { uuid: '02150190-7856-3412-3412-341234127856', latitude: 53.42205798418, longitude: 58.98129327977, txPower: -59  }, // 58.98129327977, 53.42205798418  "top": "mid" 1
  { uuid: '02150290-7856-3412-3412-341234127856', latitude: 53.42200937603, longitude: 58.98129338581, txPower: -59  }, // 58.98129338581, 53.42200937603  "bot": "mid" 2
  { uuid: '02150390-7856-3412-3412-341234127856', latitude: 53.42204882738, longitude: 58.98136283455, txPower: -59  }, // 58.98136283455, 53.42204882738  "top": "right" 3
  { uuid: '02150490-7856-3412-3412-341234127856', latitude: 53.42201872588, longitude: 58.98133879431, txPower: -59  }, // 58.98133879431, 53.42201872588  "bot": "right" ЭКРАН/4
];

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
  const bleRef = useRef(ble);

  useEffect(() => {
    bleRef.current = ble;
  }, [ble]);

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
    if (!isBuildingRoute) {
      setEndPoint(event.nativeEvent.coordinate);
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
    setRoute([]);
    setRouteDistance(null);
  };

  const handleRegionChange = (region) => {
    const zoom = Math.log2(360 / region.longitudeDelta);
    setZoomLevel(Math.round(zoom));
  };
  const buildRouteInsideBuilding = async (start, end) => {
    try {
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
        console.log("Не удалось найти ближайшие точки на линии");
        return;
      }
  
      // Определяем порядок точек на линии
      const startIndex = Math.min(startNearestPoint.index, endNearestPoint.index);
      const endIndex = Math.max(startNearestPoint.index, endNearestPoint.index);
  
      // Проверяем, какая точка ближе к пользователю
      const isStartCloserToUser =
        haversine(start, startLine[startIndex]) < haversine(start, startLine[endIndex]);
  
      // Строим маршрут в зависимости от близости точек
      const internalRoute = isStartCloserToUser
        ? [startNearestPoint, ...startLine.slice(startIndex, endIndex + 1),endNearestPoint]
        : [endNearestPoint, ...startLine.slice(startIndex + 1, endIndex + 1),startNearestPoint];
  
      // Устанавливаем маршрут
      setRoute(internalRoute);
  
      // Рассчитываем дистанцию
      const distance = calculateRouteDistance(internalRoute);
      setRouteDistance(distance);
    } catch (error) {
      console.error("Ошибка при построении маршрута внутри здания:", error);
    }
  };

  const buildRouteInsideToOutside = async (start, end) => {
    try   {
      // Шаг 1: Находим ближайший выход из здания
      const exits = mapData.features.filter(
        (feature) => feature.properties.entrance === "main"
      );
  
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
        `https://router.project-osrm.org/route/v1/foot/${nearestExit.longitude},${nearestExit.latitude};${end.longitude},${end.latitude}?geometries=geojson`
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
      const entrances = mapData.features.filter(
        (feature) => feature.properties.entrance === "main"
      );
  
      if (entrances.length === 0) {
        console.log("Не найдено входов в здание");
        return;
      }
  
      const nearestEntrance = {
        latitude: entrances[0].geometry.coordinates[1],
        longitude: entrances[0].geometry.coordinates[0],
      };
  
      // Шаг 2: Строим внешний маршрут до входа
      const response = await axios.get(
        `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${nearestEntrance.longitude},${nearestEntrance.latitude}?geometries=geojson`
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
      `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson`
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
    <View style={styles.container}>
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
        </View>
      ) : (
        <LoadingView loading={true} size={100} />
      )}
      {routeDistance !== null && (
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>
            Дистанция маршрута: {(routeDistance / 1000).toFixed(2)} км,
          </Text>
          <Text style={styles.distanceText}>
            примерное время: {(routeDistance / 1000 * humanSpeed * 6).toFixed(0)} мин
          </Text>
        </View>
      )}
      {userLocation &&
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
        </View>}
      {zoomLevel > 16 &&
        <View style={styles.levelControls}>
          <Button title="⬆️" onPress={() => handleLevelChange(selectedFloor, "up")} />
          <Text style={styles.levelText}>Этаж: {selectedFloor}</Text>
          <Button title="⬇️" onPress={() => handleLevelChange(selectedFloor, "down")} />
        </View>}
      {endPoint && (
        <View style={styles.routeControls}>
          <Button title="Построить Маршрут" onPress={buildRoute} />
          <Button title="Очистить" onPress={clearRoute} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  distanceContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  distanceText: {
    color: 'black',
    fontSize: 16,
  },
  levelControls: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  topRight: {
    position: 'absolute',
    start: 150,
    top: 10,
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
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
});

export default MapNavigator;