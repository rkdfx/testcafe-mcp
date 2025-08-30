// Mock for @modelcontextprotocol/sdk/server/stdio
const mockTransport = jest.fn();

class StdioServerTransport {
  constructor() {
    return mockTransport();
  }
}

module.exports = {
  StdioServerTransport,
  __mockTransport: mockTransport
};
