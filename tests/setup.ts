import '@testing-library/jest-dom';

// Mock environment variables
process.env.NEXT_PUBLIC_CITY_NAME = 'Los Angeles';
process.env.NEXT_PUBLIC_CITY_SHORT = 'LA';
process.env.NEXT_PUBLIC_MAX_CREWS = '20';
process.env.NEXT_PUBLIC_MAX_CREW_SIZE = '200';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;