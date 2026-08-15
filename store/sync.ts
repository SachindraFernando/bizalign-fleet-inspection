import { v4 as uuidv4 } from 'uuid';
import { useInspectionStore, Inspection } from './useInspectionStore';

const API_URL = 'http://localhost:4000';

// Called when a driver taps Submit on the inspection form.
// This is entirely local — it stamps a fresh client-generated UUID onto
// the inspection *before* any network involvement, then saves it to the
// store. No network call happens here, which is what makes submission
// work identically whether the device is online or not.
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

// Converts our internal Inspection shape into what mock-server.js actually
// expects on the wire. Found by reading the server's source directly rather
// than assuming the shape — the server wants the 6 checks nested under
// "items", and our client-generated id sent as "clientId" (since the server
// generates its own separate "id" for each stored record).
function toServerPayload(inspection: Inspection) {
  return {
    vehicleId: inspection.vehicleId,
    items: {
      tyres: inspection.tyres,
      lights: inspection.lights,
      fluidLevels: inspection.fluidLevels,
      mirrors: inspection.mirrors,
      brakes: inspection.brakes,
      bodywork: inspection.bodywork,
    },
    notes: inspection.notes,
    completedAt: new Date(inspection.createdAt).toISOString(),
    clientId: inspection.id,
  };
}

// Fetches what the server actually has, so we can check
// if an inspection already made it through before retrying.
async function getServerInspections(): Promise<{ id: string; clientId: string | null }[]> {
  const res = await fetch(`${API_URL}/inspections`);
  return res.json();
}

// Pure, easily testable: given the server's records and our client id,
// did this specific inspection actually make it through? Compares against
// clientId (what the server echoes back for us), not the server's own
// generated id — see __tests__/sync.test.ts for the bug this was fixing.
export function hasSyncedToServer(
  serverInspections: { clientId: string | null }[],
  clientId: string
): boolean {
  return serverInspections.some((i) => i.clientId === clientId);
}

// Attempts to sync a single inspection. Handles all three of the mock
// server's failure modes deliberately:
//   - 500 error: nothing was saved server-side, safe to just mark failed
//     and retry later.
//   - Successful response: straightforward, mark synced.
//   - Thrown error (covers both "timeout" and "phantom success" — from the
//     client's point of view these look identical, since neither returns a
//     usable response): rather than guessing, we ask the server directly
//     whether it actually has this inspection. This is what prevents a
//     phantom-success duplicate submission.
async function syncOne(inspection: Inspection) {
  const store = useInspectionStore.getState();
  store.updateInspectionStatus(inspection.id, 'syncing');

  try {
    const res = await fetch(`${API_URL}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toServerPayload(inspection)),
       // includes our client-generated id
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
    // fetch throws here for both a hung/timed-out request and a dropped
    // connection after a phantom success. We can't tell which happened
    // from the error alone, so we check the server's actual state.
    const serverInspections = await getServerInspections().catch(() => []);
    //const madeIt = serverInspections.some((i) => i.id === inspection.id);
    const madeIt = hasSyncedToServer(serverInspections, inspection.id);

    if (madeIt) {
      // Phantom success case: it was actually stored, we just never
      // received the confirmation. Mark synced, don't resubmit.
      store.updateInspectionStatus(inspection.id, 'synced');
    } else {
      store.updateInspectionStatus(inspection.id, 'failed');
    }
  }
}

// Attempts to sync every inspection that isn't yet confirmed synced.
// Runs sequentially (one at a time) — fine at this scale, but noted in
// the write-up as something that would need to become concurrent for a
// real fleet with large offline queues.
export async function syncAllPending() {
  const { inspections } = useInspectionStore.getState();
  const toSync = inspections.filter(
    (i) => i.status === 'pending' || i.status === 'failed'
  );

  for (const inspection of toSync) {
    await syncOne(inspection);
  }
}