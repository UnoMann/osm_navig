import React, { useEffect, useState } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, StyleSheet, Button, Text, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios'; // Добавьте axios для запросов
import { mapData } from './data'; // Импорт GeoJSON из вашего файла
import LoadingView from 'react-native-loading-view'

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
  const [route, setRoute] = useState([]);
  const [bool,setBool] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);

  useEffect(() => {
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

  useEffect(() => {
    if(bool){
    buildRoute();
    }
  }, [userLocation]);

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
    setEndPoint(event.nativeEvent.coordinate)
  };


  const buildRoute = async () => {
    if (!userLocation || !endPoint) {
      // console.log("Начальная и/или конечная точка не установлены");
      return;
    }
  
    console.log("Построение маршрута от:", userLocation, "до:", endPoint);
    setBool(true);
    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${endPoint.longitude},${endPoint.latitude}?geometries=geojson`);
      
      if (response.data.routes.length > 0) {
        const coordinates = response.data.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        }));
        setRoute(coordinates);
        // console.log("Маршрут построен:", coordinates);
      } else {
        console.log("Маршрут не найден");
      }
    } catch (error) {
      console.error("Ошибка при построении маршрута:", error);
    }
  };
  
  const clearRoute = () => {
    setRoute([]);
    setEndPoint(null);
    setBool(false);
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
          <Marker coordinate={userLocation} title="Вы находитесь здесь" pinColor="blue" />
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
      ) : (      
        <LoadingView loading={true} size={100} >
        </LoadingView> 
      )}

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
