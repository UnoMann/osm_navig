import React, { useEffect, useState } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, StyleSheet, Button, Text } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios'; // Добавьте axios для запросов
import { mapData } from './data'; // Импорт GeoJSON из вашего файла
import haversine from "haversine"; // Убедитесь, что у вас установлен модуль haversine для расчета расстояний

const filterGeojsonByFloor = (geojson, selectedFloor) => {
  return {
    type: "FeatureCollection",
    features: geojson.features.filter(
      feature => feature.properties.level === selectedFloor.toString() && feature.geometry.type === "LineString"
    ),
  };
};

// Функция для расчета расстояния между двумя координатами
const calculateDistance = (point1, point2) => {
  const R = 6371e3; // Радиус Земли в метрах
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Возвращает расстояние в метрах
};

// Функция для поиска ближайшей точки с тегом where
const findNearestPoint = (targetPoint, geojson) => {
  let nearest = null;
  let minDistance = Infinity;

  geojson.features.forEach((feature) => {
    if (
      feature.properties.where &&
      ["outdoor", "door", "indoor"].includes(feature.properties.where)
    ) {
      const { coordinates } = feature.geometry;
      const [longitude, latitude] = coordinates;
      const distance = haversine(targetPoint, { latitude, longitude });

      if (distance < minDistance) {
        minDistance = distance;
        nearest = { latitude, longitude, where: feature.properties.where };
      }
    }
  });

  return nearest;
};

const MapNavigator = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [indoorMapData, setIndoorMapData] = useState({ type: "FeatureCollection", features: [] });
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState([]);
  const [locationSubscription, setLocationSubscription] = useState(null);

  useEffect(() => {
    const getLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Разрешение на доступ к геолокации отклонено');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
        },
        (location) => {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );

      setLocationSubscription(subscription);
    };

    getLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    const filteredData = filterGeojsonByFloor(mapData, selectedFloor);
    setIndoorMapData(filteredData);
  }, [selectedFloor]);

  const handleLevelChange = (level, what) => {
    switch (what) {
      case "up":
        if (selectedFloor < 3) {
          setSelectedFloor(level === -1 ? 1 : level + 1);
        }
        break;
      case "down":
        if (selectedFloor > -1) {
          setSelectedFloor(level === 1 ? -1 : level - 1);
        }
        break;
    }
  };

  const handleSetStart = () => {
    setStartPoint(userLocation);
  };

  const handleSetEnd = (event) => {
    setEndPoint(event.nativeEvent.coordinate);
  };


  const buildRoute = async () => {
    if (!startPoint || !endPoint) {
      console.log("Начальная и/или конечная точка не установлены");
      return;
    }
  
    console.log("Построение маршрута от:", startPoint, "до:", endPoint);
  
    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}?geometries=geojson`);
      
      if (response.data.routes.length > 0) {
        const coordinates = response.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        }));
        setRoute(coordinates);
        console.log("Маршрут построен:", coordinates);
  
        // Конечная точка маршрута
        const routeEndPoint = coordinates[coordinates.length - 1];
        console.log("Конечная точка маршрута:", routeEndPoint);
  
        // Поиск ближайшей точки с тегом where
        const nearestPoint = findNearestPoint(routeEndPoint, mapData);
        if (nearestPoint) {
          console.log("Ближайшая точка с тегом where:", nearestPoint);
  
          // Расчет расстояний
          const distanceToRouteEnd = haversine(endPoint, routeEndPoint);
          const distanceToNearestWhere = haversine(endPoint, nearestPoint);
  
          // Сравнение и вывод в консоль ближайшей точки
          if (distanceToRouteEnd <= distanceToNearestWhere) {
            console.log("Ближайшая к конечной точке маршрута:", routeEndPoint);
          } else {
            console.log("Ближайшая к конечной точке с тегом where:", nearestPoint);
          }
        } else {
          console.log("Подходящая точка с тегом where не найдена.");
        }
      } else {
        console.log("Маршрут не найден");
      }
    } catch (error) {
      console.error("Ошибка при построении маршрута:", error);
    }
  };
  
  const clearRoute = () => {
    setRoute([]);
    setStartPoint(null);
    setEndPoint(null);
  };

  return (
    <View style={styles.container}>
      {userLocation ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleSetEnd}
        >
          <Marker coordinate={userLocation} title="Вы находитесь здесь" pinColor="blue" />
          {startPoint && <Marker coordinate={startPoint} title="Начальная точка" pinColor="green" />}
          {endPoint && <Marker coordinate={endPoint} title="Конечная точка" pinColor="red" />}
          {indoorMapData.features.map((feature) => (
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
      ) : (
        <Text>Получение местоположения...</Text>
      )}

      <View style={styles.levelControls}>
        <Button title="⬆️" onPress={() => handleLevelChange(selectedFloor, "up")} />
        <Text style={styles.levelText}>Этаж: {selectedFloor}</Text>
        <Button title="⬇️" onPress={() => handleLevelChange(selectedFloor, "down")} />
      </View>

      <View style={styles.routeControls}>
        <Button title="Установить Начальную Точку" onPress={handleSetStart} />
        <Button title="Построить Маршрут" onPress={buildRoute} disabled={!startPoint || !endPoint} />
        <Button title="Очистить" onPress={clearRoute} />
      </View>
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
  levelControls: {
    position: 'absolute',
    bottom: 80,
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
