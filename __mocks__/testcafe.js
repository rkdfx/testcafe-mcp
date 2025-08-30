// Mock TestCafe for Jest tests
const mockTestCafe = {
  createRunner: jest.fn(() => ({
    src: jest.fn().mockReturnThis(),
    browsers: jest.fn().mockReturnThis(),
    screenshots: jest.fn().mockReturnThis(),
    video: jest.fn().mockReturnThis(),
    reporter: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue(0)
  })),
  close: jest.fn().mockResolvedValue()
};

const createTestCafe = jest.fn().mockResolvedValue(mockTestCafe);

module.exports = createTestCafe;
module.exports.default = createTestCafe;
