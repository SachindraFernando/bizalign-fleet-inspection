import { v4 as uuidv4 } from 'uuid';
import { useInspectionStore, Inspection } from './useInspectionStore';

const API_URL = 'http://localhost:4000';

// Creates a new inspection locally — this is what "Submit" calls.
// No network involved at all, so it works fully offline.
export function createInspection(
  vehicleId: string,
  answers: {
    tyres: boolean;
    lights: boolean;
    fluidLevels: boolean;
    mirrors: boolean;
    brakes: boolean;
    bodywork: boolean;
    notes: string;
  }
) {
  const inspection: Inspection = {
    id: uuidv4(),
    vehicleId,
    ...answers,
    status: 'pending',
    createdAt: Date.now(),
  };

  useInspectionStore.getState().addInspection(inspection);
}



// Fetches what the server actually has, so we can check
// if an inspection already made it through before retrying.
async function getServerInspections(): Promise<{ id: string }[]> {
  const res = await fetch(`${API_URL}/inspections`);
  return res.json();
}

// Pure function, easy to test in isolation — given the server's records
// and our client ID, did our inspection actually make it through?
export function hasSyncedToServer(
  serverInspections: { clientId: string | null }[],
  clientId: string
): boolean {
  return serverInspections.some((i) => i.clientId === clientId);
}

// Attempts to sync a single inspection to the server.
async function syncOne(inspection: Inspection) {
  const store = useInspectionStore.getState();
  store.updateInspectionStatus(inspection.id, 'syncing');

  try {
    const res = await fetch(`${API_URL}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inspection), // includes our client-generated id
    });

    if (res.ok) {
      // Clean success — server confirmed it.
      store.updateInspectionStatus(inspection.id, 'synced');
      return;
    }

    // Server responded, but with an error (e.g. 500).
    // Nothing was saved server-side in this case, safe to mark failed and retry later.
    store.updateInspectionStatus(inspection.id, 'failed');
  } catch (error) {
    // fetch throws on timeout / dropped connection — this is the tricky case.
    // We don't actually know if the server saved it or not, so we check.
    const serverInspections = await getServerInspections().catch(() => []);
    //const madeIt = serverInspections.some((i) => i.id === inspection.id);
    const madeIt = hasSyncedToServer(serverInspections, inspection.id);

    if (madeIt) {
      // Phantom success case — it actually went through.
      store.updateInspectionStatus(inspection.id, 'synced');
    } else {
      store.updateInspectionStatus(inspection.id, 'failed');
    }
  }
}

// Syncs every pending or failed inspection. Call this whenever
// we detect a network connection (app open, connection regained, manual button).
export async function syncAllPending() {
  const { inspections } = useInspectionStore.getState();
  const toSync = inspections.filter(
    (i) => i.status === 'pending' || i.status === 'failed'
  );

  for (const inspection of toSync) {
    await syncOne(inspection);
  }
}