import { hasSyncedToServer } from '../store/sync';

describe('hasSyncedToServer', () => {
  it('returns true when the server has a record with matching clientId', () => {
    const serverInspections = [
      { clientId: 'abc-123' },
      { clientId: 'xyz-789' },
    ];
    expect(hasSyncedToServer(serverInspections, 'abc-123')).toBe(true);
  });

  it('returns false when no server record matches', () => {
    const serverInspections = [{ clientId: 'xyz-789' }];
    expect(hasSyncedToServer(serverInspections, 'abc-123')).toBe(false);
  });

  it('returns false against the server\'s own id field, not clientId — this is the exact bug found during testing', () => {
    // This mirrors the real mock-server.js response shape: the server's own
    // generated `id` is different from the `clientId` it echoes back.
    const serverInspections = [{ id: 'server-generated-id', clientId: 'abc-123' } as any];
    expect(hasSyncedToServer(serverInspections, 'abc-123')).toBe(true);
    expect(hasSyncedToServer(serverInspections, 'server-generated-id')).toBe(false);
  });
});