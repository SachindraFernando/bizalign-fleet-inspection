// import NetInfo from '@react-native-community/netinfo';
// import { useInspectionStore } from './useInspectionStore';
// import { syncAllPending } from './sync';

// const API_URL = 'http://localhost:4000';

// // Fetches the vehicle list from the server and stores it.
// export async function loadVehicles() {
//   try {
//     const res = await fetch(`${API_URL}/vehicles`);
//     const vehicles = await res.json();
//     useInspectionStore.getState().setVehicles(vehicles);
//   } catch (error) {
//     // No connection at startup — that's fine, we just show an empty list
//     // until connection returns. Vehicles aren't critical to have offline
//     // since the brief doesn't require creating NEW vehicles offline.
//     console.log('Could not load vehicles (likely offline):', error);
//   }
// }

// // Call this once when the app starts.
// export function initApp() {
//   loadVehicles();
//   syncAllPending(); // try syncing anything left over from last time

//   // Whenever the connection comes back, try syncing again automatically.
//   NetInfo.addEventListener((state) => {
//     if (state.isConnected) {
//       syncAllPending();
//     }
//   });
// }

import NetInfo from '@react-native-community/netinfo';
import { useInspectionStore } from './useInspectionStore';
import { syncAllPending } from './sync';

const API_URL = 'http://localhost:4000';

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