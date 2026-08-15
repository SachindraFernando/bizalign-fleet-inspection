import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
// A vehicle as returned by GET /vehicles.
export type Vehicle = {
  id: string;
  registration: string;
  make: string;
  model: string;
};

// Lifecycle of a single inspection, from creation to confirmed sync.
// 'failed' means "not yet synced" — it will be retried, not abandoned.
export type InspectionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type Inspection = {
  // Generated on-device, before any network call. This is our permanent
  // identity for this inspection, independent of whatever the server
  // decides to call it. It's what lets us safely check "did this specific
  // submission actually make it through?" after a failed/ambiguous request,
  // instead of blindly resubmitting and risking a duplicate.
  id: string;
  vehicleId: string;
  tyres: boolean;
  lights: boolean;
  fluidLevels: boolean;
  mirrors: boolean;
  brakes: boolean;
  bodywork: boolean;
  notes: string;
  status: InspectionStatus;
  createdAt: number;
};

type StoreState = {
  vehicles: Vehicle[];
  inspections: Inspection[];

  setVehicles: (vehicles: Vehicle[]) => void;
  addInspection: (inspection: Inspection) => void;
  updateInspectionStatus: (id: string, status: InspectionStatus) => void;
};


// The shared store. Any screen that reads from this automatically
// re-renders when the relevant data changes — no manual refresh needed.
export const useInspectionStore = create<StoreState>()(
  persist(
    (set) => ({
      vehicles: [],
      inspections: [],

      // Vehicles are always re-fetched fresh from the server on app start,
      // so there's no need to persist them locally (see partialize below).
      setVehicles: (vehicles) => set({ vehicles }),

      // Called the moment a driver taps Submit. Note this never touches
      // the network — it only writes to local state, which is what makes
      // the form work identically whether the device is online or not.
      addInspection: (inspection) =>
        set((state) => ({
          inspections: [...state.inspections, inspection],
        })),

      // Used by the sync logic to move an inspection through its lifecycle
      // (pending → syncing → synced/failed) as sync attempts happen.
      updateInspectionStatus: (id, status) =>
        set((state) => ({
          inspections: state.inspections.map((insp) =>
            insp.id === id ? { ...insp, status } : insp
          ),
        })),
    }),
    {
      name: 'bizalign-fleet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist inspections to disk. A driver's actual work (completed
      // inspections, including anything still waiting to sync) must survive
      // an app restart or the phone dying mid-shift. Vehicles don't need
      // this, since they're just reference data re-fetched from the server.
      partialize: (state) => ({ inspections: state.inspections }),
    }
  )
);