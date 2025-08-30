// Simple TestCafe mock for Jest tests
const mockRunner = {
  src: jest.fn().mockReturnThis(),
  browsers: jest.fn().mockReturnThis(),
  screenshots: jest.fn().mockReturnThis(),
  video: jest.fn().mockReturnThis(),
  reporter: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  run: jest.fn().mockResolvedValue(0), // 0 = no failed tests
  stop: jest.fn().mockResolvedValue(undefined)
};

const mockTestCafe = {
  createRunner: jest.fn(() => mockRunner),
  close: jest.fn().mockResolvedValue(undefined)
};

const createTestCafe = jest.fn().mockResolvedValue(mockTestCafe);

const Selector = jest.fn((selector) => ({
  selector,
  exists: true,
  count: 1
}));

// Export both named and default exports for maximum compatibility
module.exports = createTestCafe;
module.exports.createTestCafe = createTestCafe;
module.exports.Selector = Selector;
module.exports.default = createTestCafe;

// Export mocks for easy access in tests
module.exports.__mocks = {
  testCafe: mockTestCafe,
  runner: mockRunner
};
