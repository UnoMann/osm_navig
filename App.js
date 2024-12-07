import React, { useEffect, useState, useRef  } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, StyleSheet, Button, TextInput, FlatList, TouchableOpacity, Text } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios'; // Добавьте axios для запросов
import { mapData } from './data'; // Импорт GeoJSON из вашего файла
import LoadingView from 'react-native-loading-view'
import haversine from "haversine"; // Убедитесь, что у вас установлен модуль haversine для расчета расстояний
import { startScanning, stopScanning, getUserLocation, getBleReady } from './components/getUserLocationBle';


let userLocation2 = null;
const humanSpeed = 5; // км/ч
const whitelist = [
  { uuid: '02150190-7856-3412-3412-341234127856', latitude: 53.42205406588, longitude: 58.98129668738 },
  { uuid: '02150290-7856-3412-3412-341234127856', latitude: 53.42208803109, longitude: 58.98130207040 },
  { uuid: '02150390-7856-3412-3412-341234127856', latitude: 53.42206192661, longitude: 58.98128455488 },
];

  const filterGeojsonByFloor = (geojson, selectedFloor) => {
    return {
      type: "FeatureCollection",
      features: geojson.features.filter(
        feature => feature.properties.level === selectedFloor.toString() && feature.geometry.type === "LineString"
      ),
    };
  };

const MapNavigator = () => {
  const [zoomLevel, setZoomLevel] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [indoorMapData, setIndoorMapData] = useState({ type: "FeatureCollection", features: [] });
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [endPoint, setEndPoint] = useState(null);  
  const [suggestions, setSuggestions] = useState([]);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [route, setRoute] = useState([]);
  const [ble,setBle] = useState(false);
  const [bool,setBool] = useState(false);
  const [bleReady,setBleReady] = useState(false);
  const bleRef = useRef(ble);

  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);

 
  

  useEffect(() => {
    bleRef.current = ble; // Синхронизация с состоянием
  }, [ble]);

  // GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS GPS
  const getLocation = async () => {

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Разрешение на доступ к геолокации отклонено');
      return;
    }
    await Location.enableNetworkProviderAsync();
    
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest, // Использует наивысшую доступную точность
        distanceInterval: 1,

      },
      (location) => { 
        if(!bleRef.current){
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
      if (bool && !isBuildingRoute) {
        setIsBuildingRoute(true); // Устанавливаем блокировку
        try {
          await buildRoute(); // Ждем выполнения маршрута
        } catch (error) {
          console.error("Ошибка при построении маршрута:", error);
        } finally {
          setIsBuildingRoute(false); // Снимаем блокировку
        }
      }
      // else{
      //   setEndPoint(null);
      //   setRoute([]);
      //   setRouteDistance(null); // Сброс расстояния
      // }
    };
  
    buildRouteAsync(); // Вызов асинхронной функции
  }, [userLocation, bool]); // bool добавлен для синхронизации с состоянием
  
  
  const SetReadyBle = async () => {
    if(!bleReady){
      try{
        const isReady = await getBleReady(); // Если getBleReady возвращает промис
        setBleReady(isReady);
        // console.log (bleReady+" / "+isReady)
        setTimeout(() => {
          SetReadyBle();
        }, 1000);
      } catch (error) {
        console.log('SetReadyBle: Error fSetReadyBle:', error.message);
      }
    }
  };
  const fetchLocation = async () => {
    try {
      // console.log("BLE =", bleRef.current); // Используем актуальное значение
      if (bleRef.current) {
        if (locationSubscription) {
          await locationSubscription.remove(); // Отключить GPS подписку
          setLocationSubscription(null);
        }
        const location = await getUserLocation();
        // console.log("////////////// BLE режим активирован");
        if (location) {
          setUserLocation(location);
          userLocation2 = location;
          // console.log(userLocation2);
        } else {
          console.log("BLE не возвращает корректную локацию");
        }
      } else {
        // console.log("////////////// GPS режим активирован");
        getLocation();
      }
      setTimeout(fetchLocation, 1000); // Запуск повторно
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
        if (selectedFloor > -1) {
          setSelectedFloor(level === 1 ? -1 : level - 1);
        }
        break;
    }
  };
  const handleSetEnd = async (event) => {
    if(!bool){
      setEndPoint(event.nativeEvent.coordinate)
    }
  };
  // Функция для поиска ближайшей точки с тегом custom
  const findNearestPoint = (targetPoint, geojson) => {
  let nearest = null;
  let minDistance = Infinity;
  geojson.features.forEach((feature) => {
    if (
      feature.properties.custom && feature.properties.custom === "footpath"
    ) {
      const { coordinates } = feature.geometry;
      const [longitude, latitude] = coordinates;
      const distance = haversine(targetPoint, { latitude, longitude });
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { latitude, longitude, custom: feature.properties.custom };
      }
    }
  });
  return nearest;
  };
  const calculateRouteDistance = (routeCoordinates) => {
    let distance = 0;
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[i + 1];
      distance += haversine(start, end, { unit: "meter" }); // Расстояние в метрах
    }

    return distance;
  };
  const buildRoute = async () => {
    if (!userLocation2 || !endPoint) {
      console.log("Начальная и/или конечная точка не установлены");
      return;
    }
  
    setBool(true);
    console.log("Построение маршрута от:", userLocation2, "до:", endPoint);
    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLocation2.longitude},${userLocation2.latitude};${endPoint.longitude},${endPoint.latitude}?geometries=geojson`);
  
      if (response.data.routes.length > 0) {
        const coordinates = response.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        }));
  
        const routeEndPoint = coordinates[coordinates.length - 1];
        console.log("Конечная точка маршрута:", routeEndPoint);
  
        // Поиск ближайшей точки с тегом where
        const nearestPoint = findNearestPoint(routeEndPoint, mapData);
        if (nearestPoint) {
          console.log("Ближайшая точка с тегом where:", nearestPoint);
  
          // Расчет расстояний
          const distanceToRouteEnd = haversine(endPoint, routeEndPoint);
          const distanceToNearestWhere = haversine(endPoint, nearestPoint);
  
          // Сравнение расстояний
          if (distanceToRouteEnd <= distanceToNearestWhere) {
            console.log("Используем маршрут от OSM");
  
            // Используем маршрут от OSM
            setRoute(coordinates); // Устанавливаем маршрут от OSM
            const distance = calculateRouteDistance(coordinates);
            setRouteDistance(distance); // Сохранение расстояния в состоянии
          } else {
            console.log("Построение маршрута по линиям");
  
            // Если расстояние больше, строим маршрут по линиям
            const lines = mapData.features.filter(feature => feature.geometry.type === "LineString" && feature.properties.custom === "footpath");
            const path = [];
  
            const endPointCoordinates = { latitude: endPoint.latitude, longitude: endPoint.longitude };
  
            const findNearestLinePoint = (point, lineCoordinates) => {
              let nearestPoint = null;
              let nearestDistance = Infinity;
  
              for (let i = 0; i < lineCoordinates.length - 1; i++) {
                const start = lineCoordinates[i];
                const end = lineCoordinates[i + 1];
  
                // Находим ближайшую точку на сегменте
                const projectedPoint = getNearestPointOnSegment(point, start, end);
                const distance = haversine(point, projectedPoint);
  
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestPoint = projectedPoint;
                }
              }
  
              return nearestPoint;
            };
  
            const getNearestPointOnSegment = (point, start, end) => {
              const A = { latitude: start.latitude, longitude: start.longitude };
              const B = { latitude: end.latitude, longitude: end.longitude };
              const P = { latitude: point.latitude, longitude: point.longitude };
  
              const AB = { latitude: B.latitude - A.latitude, longitude: B.longitude - A.longitude };
              const AP = { latitude: P.latitude - A.latitude, longitude: P.longitude - A.longitude };
  
              const ab2 = AB.latitude * AB.latitude + AB.longitude * AB.longitude;
              const ap_ab = AP.latitude * AB.latitude + AP.longitude * AB.longitude;
  
              const t = Math.max(0, Math.min(1, ap_ab / ab2));
  
              return {
                latitude: A.latitude + t * AB.latitude,
                longitude: A.longitude + t * AB.longitude,
              };
            };
  
            let closestLinePoint = null;
            let minDistance = Infinity;
  
            // Ищем ближайшую точку на всех линиях
            lines.forEach(line => {
              const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
                latitude,
                longitude,
              }));
  
              const nearestPoint = findNearestLinePoint(endPointCoordinates, lineCoordinates);
              const distance = haversine(endPointCoordinates, nearestPoint);
  
              if (distance < minDistance) {
                minDistance = distance;
                closestLinePoint = nearestPoint;
              }
            });
  
            if (closestLinePoint) {
              console.log("Ближайшая точка на линии к конечной точке:", closestLinePoint);
  
              // Теперь нужно построить маршрут до ближайшей точки на линии
              const linePath = [];
  
              // Снова проходим по всем линиям, чтобы составить маршрут
              lines.forEach(line => {
                const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
                  latitude,
                  longitude,
                }));
  
                // Ищем ближайшую точку на линии
                for (let i = 0; i < lineCoordinates.length - 1; i++) {
                  const start = lineCoordinates[i];
                  const end = lineCoordinates[i + 1];
  
                  if (getNearestPointOnSegment(closestLinePoint, start, end).latitude === closestLinePoint.latitude &&
                      getNearestPointOnSegment(closestLinePoint, start, end).longitude === closestLinePoint.longitude) {
                    // Добавляем все координаты линии до ближайшей точки
                    linePath.push(...lineCoordinates.slice(0, i + 1));
                    break;
                  }
                }
              });
  
              // Добавляем ближайшую точку как конечную
              linePath.push(closestLinePoint);        

              const response2 = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLocation2.longitude},${userLocation2.latitude};${linePath[0].longitude},${linePath[0].latitude}?geometries=geojson`);
              const coordinates2 = response2.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
                latitude,
                longitude,
              }));

              // Устанавливаем маршрут
              setRoute([...coordinates2,...linePath]); // Устанавливаем новый маршрут по линиям
              const distance = calculateRouteDistance([...coordinates2,...linePath]);
              setRouteDistance(distance); // Сохранение расстояния в состоянии
            } else {
              console.log("Не удалось найти ближайшую точку на линии.");
            }
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
    setBool(false);
    setEndPoint(null);
    setRoute([]);
    setRouteDistance(null); // Сброс расстояния
  };

  // Функция отслеживающая изменения региона карты и вычисляющая уровень зума
  const handleRegionChange = (region) => {
      const zoom = Math.log2(360 / region.longitudeDelta);
      setZoomLevel(Math.round(zoom));
      // console.log('Zoom:', zoomLevel);
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
            {zoomLevel>16 &&
              <View>
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
              </View>}
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
        <LoadingView loading={true} size={100} >
        </LoadingView> 
      )}
      {routeDistance !== null && (
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>
            Дистанция маршрута: {(routeDistance / 1000).toFixed(2)} км,
          </Text>
          <Text style={styles.distanceText}>
            примерное время: {(routeDistance/1000*humanSpeed*6).toFixed(0)} мин
          </Text>
        </View>
      )}
      {userLocation && 
      <View 
      style={styles.topRight}>
        <Button
          title={ble ? "BLE" : "GPS"}
          onPress={() => {    
            setBle((prevBle) => {
            if (locationSubscription) {
              locationSubscription.remove(); // Отключить GPS подписку
              setLocationSubscription(null);
            }
            console.log("BLE изменено на:", !prevBle); // Проверка
            return !prevBle;
            });
          }}
          disabled={!bleReady}
        />
      </View>}
      
      {zoomLevel>16 &&
        <View style={styles.levelControls}>
          <Button title="⬆️" onPress={() => handleLevelChange(selectedFloor, "up")} />
          <Text style={styles.levelText}>Этаж: {selectedFloor}</Text>
          <Button title="⬇️" onPress={() => handleLevelChange(selectedFloor, "down")} />
        </View>}
      {endPoint ? (
        <View style={styles.routeControls}>
          <Button title="Построить Маршрут" onPress={buildRoute}  />
          <Button title="Очистить" onPress={clearRoute} />
        </View>
      ): ( <View/> )}
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
  searchInput:{
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding:10,
    borderRadius:10,
    marginBottom:10,
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
    top:10,
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