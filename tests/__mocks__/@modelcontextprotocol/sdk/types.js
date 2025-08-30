// Mock for @modelcontextprotocol/sdk/types
class McpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'McpError';
  }
}

const ErrorCode = {
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
};

class CallToolResult {
  constructor(content = [], isError = false) {
    this.content = content;
    this.isError = isError;
  }
}

class TextContent {
  constructor(text = '') {
    this.type = 'text';
    this.text = text;
  }
}

module.exports = {
  McpError,
  ErrorCode,
  CallToolResult,
  TextContent
};
