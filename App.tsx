import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { initApp } from './store/init';
import { Vehicle } from './store/useInspectionStore';
import VehicleListScreen from './screens/VehicleListScreen';
import InspectionFormScreen from './screens/InspectionFormScreen';

export default function App() {
  // Simple two-screen navigation without a routing library — null means
  // "show the vehicle list", any vehicle means "show its inspection form".
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Runs once on app start: loads vehicles, attempts to sync anything left
  // over from a previous session, and starts listening for reconnection.
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