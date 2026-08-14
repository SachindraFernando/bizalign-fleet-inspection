import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

//Types
export type Vehicle = {
  id: string;
  registration: string;
  make: string;
  model: string;
};

export type InspectionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type Inspection = {
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


//The Zustand store with real state and functions
export const useInspectionStore = create<StoreState>()(
  persist(
    (set) => ({
      vehicles: [],
      inspections: [],

      setVehicles: (vehicles) => set({ vehicles }),

      addInspection: (inspection) =>
        set((state) => ({
          inspections: [...state.inspections, inspection],
        })),

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
      partialize: (state) => ({ inspections: state.inspections }),
    }
  )
);