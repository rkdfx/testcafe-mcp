// Mock for @modelcontextprotocol/sdk/server
const mockServer = {
  setRequestHandler: jest.fn(),
  setNotificationHandler: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  sendNotification: jest.fn(),
  sendRequest: jest.fn()
};

class Server {
  constructor() {
    Object.assign(this, mockServer);
  }
}

module.exports = {
  Server,
  __mockServer: mockServer
};
