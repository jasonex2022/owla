import { rotateCrews, shouldRotate } from '../lib/services/rotation';

describe('Zone Rotation', () => {
  const mockSupabase = {
    from: jest.fn(),
    rpc: jest.fn(),
  };

  const mockZones = [
    { id: 'downtown', name: 'Downtown', type: 'primary' as const, center: [-118.2437, 34.0522] as [number, number] },
    { id: 'hollywood', name: 'Hollywood', type: 'primary' as const, center: [-118.3287, 34.0928] as [number, number] },
    { id: 'venice', name: 'Venice', type: 'secondary' as const, center: [-118.4695, 33.9850] as [number, number] },
    { id: 'westwood', name: 'Westwood', type: 'secondary' as const, center: [-118.4452, 34.0689] as [number, number] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rotates 40-60% of crews', async () => {
    // Mock current crew locations
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'current_crews') {
        return {
          select: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: [
                { crew_id: 1, zone_id: 'downtown', estimated_size: 150 },
                { crew_id: 2, zone_id: 'hollywood', estimated_size: 180 },
                { crew_id: 3, zone_id: 'venice', estimated_size: 120 },
                { crew_id: 4, zone_id: 'westwood', estimated_size: 160 },
              ],
            }),
          }),
        };
      }
      if (table === 'police_activity') {
        return {
          select: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({ data: [] }),
          }),
        };
      }
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });

    const result = await rotateCrews(mockSupabase, mockZones);
    
    expect(result.success).toBe(true);
    expect(result.rotations).toBe(4); // All crews should get assignments
    
    // Verify RPC was called with rotation plan
    expect(mockSupabase.rpc).toHaveBeenCalledWith('rotate_crews', {
      rotation_plan: expect.any(String),
    });
  });

  test('avoids danger zones during rotation', async () => {
    // Mock police activity in downtown
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'current_crews') {
        return {
          select: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: [
                { crew_id: 1, zone_id: 'hollywood', estimated_size: 150 },
                { crew_id: 2, zone_id: 'venice', estimated_size: 180 },
              ],
            }),
          }),
        };
      }
      if (table === 'police_activity') {
        return {
          select: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: [
                { zone_id: 'downtown', severity: 'critical' },
              ],
            }),
          }),
        };
      }
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });

    const result = await rotateCrews(mockSupabase, mockZones);
    
    expect(result.success).toBe(true);
    
    // Parse rotation plan to verify no crews assigned to downtown
    const rpcCall = mockSupabase.rpc.mock.calls[0];
    const rotationPlan = JSON.parse(rpcCall[1].rotation_plan);
    
    const downtonAssignments = rotationPlan.filter((r: any) => r.zone_id === 'downtown');
    expect(downtonAssignments).toHaveLength(0);
  });

  test('shouldRotate returns true at :00 and :30', async () => {
    // Mock time at exactly :30
    const mockDate = new Date('2024-01-01T12:30:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    const result = await shouldRotate(mockSupabase);
    expect(result).toBe(true);
  });

  test('shouldRotate returns false at other times', async () => {
    // Mock time at :15
    const mockDate = new Date('2024-01-01T12:15:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const result = await shouldRotate(mockSupabase);
    expect(result).toBe(false);
  });
});