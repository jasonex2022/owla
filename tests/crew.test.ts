import { getCrewAssignment } from '../lib/services/crews';

describe('Crew Assignment', () => {
  const mockSupabase = {
    rpc: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: {
          active_crews: 5,
          total_protesters: 750,
          zones_occupied: 5,
          next_rotation: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      }),
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            { crew_id: 1, estimated_size: 140, zone_id: 1 },
            { crew_id: 2, estimated_size: 160, zone_id: 2 },
            { crew_id: 3, estimated_size: 120, zone_id: 3 },
          ],
        }),
      }),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('assigns user to crew with space available', async () => {
    const assignment = await getCrewAssignment(mockSupabase);
    
    expect(assignment).toHaveProperty('crewId');
    expect(assignment.crewId).toBeGreaterThanOrEqual(1);
    expect(assignment.crewId).toBeLessThanOrEqual(20);
    expect(assignment).toHaveProperty('crewName');
    expect(assignment).toHaveProperty('estimatedSize');
    expect(assignment).toHaveProperty('zoneId');
  });

  test('assigns to crew with least members when all are near capacity', async () => {
    // Mock all crews near capacity
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            { crew_id: 1, estimated_size: 180, zone_id: 1 },
            { crew_id: 2, estimated_size: 190, zone_id: 2 },
            { crew_id: 3, estimated_size: 170, zone_id: 3 },
          ],
        }),
      }),
    });

    const assignment = await getCrewAssignment(mockSupabase);
    
    // Should assign to crew 3 (least full)
    expect(assignment.crewId).toBe(3);
  });

  test('creates consistent assignments within time bucket', async () => {
    // Mock Date.now to control time bucket
    const originalNow = Date.now;
    const mockTime = 1609459200000; // Fixed timestamp
    Date.now = jest.fn(() => mockTime);

    const assignment1 = await getCrewAssignment(mockSupabase);
    const assignment2 = await getCrewAssignment(mockSupabase);
    
    // Within same 10-second bucket, assignments should be similar
    expect(Math.abs(assignment1.crewId - assignment2.crewId)).toBeLessThanOrEqual(1);

    Date.now = originalNow;
  });
});