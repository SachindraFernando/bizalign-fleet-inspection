import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { initApp } from './store/init';
import { Vehicle } from './store/useInspectionStore';
import VehicleListScreen from './screens/VehicleListScreen';
import InspectionFormScreen from './screens/InspectionFormScreen';

export default function App() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {selectedVehicle ? (
        <InspectionFormScreen
          vehicle={selectedVehicle}
          onDone={() => setSelectedVehicle(null)}
        />
      ) : (
        <VehicleListScreen onSelectVehicle={setSelectedVehicle} />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
});