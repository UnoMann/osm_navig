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
  { uuid: '02150190-7856-3412-3412-341234127856', latitude: 53.42205798418, longitude: 58.98129327977, txPower: -59  }, // 58.98129327977, 53.42205798418  "top": "mid"
  { uuid: '02150290-7856-3412-3412-341234127856', latitude: 53.42200937603, longitude: 58.98129338581, txPower: -59  }, // 58.98129338581, 53.42200937603  "bot": "mid"
  { uuid: '02150390-7856-3412-3412-341234127856', latitude: 53.42204882738, longitude: 58.98136283455, txPower: -59  }, // 58.98136283455, 53.42204882738  "top": "right"
  { uuid: '02150490-7856-3412-3412-341234127856', latitude: 53.42201872588, longitude: 58.98133879431, txPower: -59  }, // 58.98133879431, 53.42201872588  "bot": "right"
];

// Фильтрация GeoJSON по этажу
const filterGeojsonByFloor = (geojson, selectedFloor) => {
  return {
    type: "FeatureCollection",
    features: geojson.features.filter(
      feature => feature.properties.level === selectedFloor.toString() && (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon")
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
        if (selectedFloor > -1) {
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

  const findNearestPoint = (targetPoint, geojson) => {
    let nearest = null;
    let minDistance = Infinity;
    geojson.features.forEach((feature) => {
      if (feature.properties.custom && feature.properties.custom === "footpath") {
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
      distance += haversine(start, end, { unit: "meter" });
    }
    return distance;
  };

  const buildRoute = async () => {
    if (!userLocation2 || !endPoint) {
      console.log("Начальная и/или конечная точка не установлены");
      return;
    }

    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLocation2.longitude},${userLocation2.latitude};${endPoint.longitude},${endPoint.latitude}?geometries=geojson`);

      if (response.data.routes.length > 0) {
        const coordinates = response.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        }));

        const routeEndPoint = coordinates[coordinates.length - 1];
        const nearestPoint = findNearestPoint(routeEndPoint, mapData);

        if (nearestPoint) {
          const distanceToRouteEnd = haversine(endPoint, routeEndPoint);
          const distanceToNearestWhere = haversine(endPoint, nearestPoint);

          if (distanceToRouteEnd <= distanceToNearestWhere) {
            setRoute(coordinates);
            const distance = calculateRouteDistance(coordinates);
            setRouteDistance(distance);
          } else {
            const lines = mapData.features.filter(feature => feature.geometry.type === "LineString" && feature.properties.custom === "footpath");
            const path = [];
            const endPointCoordinates = { latitude: endPoint.latitude, longitude: endPoint.longitude };

            const findNearestLinePoint = (point, lineCoordinates) => {
              let nearestPoint = null;
              let nearestDistance = Infinity;

              for (let i = 0; i < lineCoordinates.length - 1; i++) {
                const start = lineCoordinates[i];
                const end = lineCoordinates[i + 1];
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
              const linePath = [];

              lines.forEach(line => {
                const lineCoordinates = line.geometry.coordinates.map(([longitude, latitude]) => ({
                  latitude,
                  longitude,
                }));

                for (let i = 0; i < lineCoordinates.length - 1; i++) {
                  const start = lineCoordinates[i];
                  const end = lineCoordinates[i + 1];

                  if (getNearestPointOnSegment(closestLinePoint, start, end).latitude === closestLinePoint.latitude &&
                    getNearestPointOnSegment(closestLinePoint, start, end).longitude === closestLinePoint.longitude) {
                    linePath.push(...lineCoordinates.slice(0, i + 1));
                    break;
                  }
                }
              });

              linePath.push(closestLinePoint);

              const response2 = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLocation2.longitude},${userLocation2.latitude};${linePath[0].longitude},${linePath[0].latitude}?geometries=geojson`);
              const coordinates2 = response2.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
                latitude,
                longitude,
              }));

              setRoute([...coordinates2, ...linePath]);
              const distance = calculateRouteDistance([...coordinates2, ...linePath]);
              setRouteDistance(distance);
            }
          }
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