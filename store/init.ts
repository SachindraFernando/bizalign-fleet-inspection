import NetInfo from '@react-native-community/netinfo';
import { useInspectionStore } from './useInspectionStore';
import { syncAllPending } from './sync';

const API_URL = 'http://localhost:4000';

// Silently continue if this fails — a driver opening the app fully
// offline for the first time will just see an empty vehicle list rather
// than a hard error. This is a known limitation, documented in the write-up.
export async function loadVehicles() {
  try {
    const res = await fetch(`${API_URL}/vehicles`);
    const vehicles = await res.json();
    useInspectionStore.getState().setVehicles(vehicles);
  } catch (error) {
    console.log('Could not load vehicles (likely offline):', error);
  }
}

export function initApp() {
  loadVehicles();
  syncAllPending();

  // Retry whenever the device's connection state changes.
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncAllPending();
    }
  });

  // ALSO retry every 10 seconds regardless — this covers the case where
  // the device has network, but our specific server was unreachable
  // (e.g. server restarted, temporary outage) rather than a real
  // device-level connectivity change.
  setInterval(() => {
    syncAllPending();
  }, 10000);
}