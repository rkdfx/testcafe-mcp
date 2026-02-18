/**
 * Tools module exports
 */

export { CreateTestTool } from './create-test-tool.js';
export { ExecuteTestTool } from './execute-test-tool.js';
export { ValidateTestTool } from './validate-test-tool.js';
export { InteractTool } from './interact-tool.js';
export { InspectPageTool } from './inspect-page-tool.js';
export { ConsoleLogsTool } from './console-logs-tool.js';

// New tools
export { AccessibilitySnapshotTool } from './accessibility-snapshot-tool.js';
export { TabManagementTool } from './tab-management-tool.js';
export { NetworkLogsTool } from './network-logs-tool.js';
export { DialogHandlingTool } from './dialog-handling-tool.js';

// Agentic browser control tools
export { BrowserNavigateTool } from './browser-navigate-tool.js';
export { BrowserSnapshotTool } from './browser-snapshot-tool.js';
export { BrowserClickTool } from './browser-click-tool.js';
export { BrowserTypeTool } from './browser-type-tool.js';
export { BrowserPressKeyTool } from './browser-press-key-tool.js';
export { BrowserEvaluateTool } from './browser-evaluate-tool.js';
export { BrowserScreenshotTool } from './browser-screenshot-tool.js';

export type {
  CreateTestInput
} from './create-test-tool.js';

export type {
  ExecuteTestInput
} from './execute-test-tool.js';

export type {
  ValidateTestInput,
  ValidationIssue,
  ComprehensiveValidationResult
} from './validate-test-tool.js';

export type {
  InteractInput,
  InteractionResult
} from './interact-tool.js';

export type {
  InspectPageInput,
  PageInspectionResult
} from './inspect-page-tool.js';

export type {
  ConsoleLogsInput,
  ConsoleLogEntry,
  ConsoleLogsResult
} from './console-logs-tool.js';

// New tool types
export type {
  AccessibilitySnapshotInput
} from './accessibility-snapshot-tool.js';

export type {
  TabManagementInput
} from './tab-management-tool.js';

export type {
  NetworkLogsInput
} from './network-logs-tool.js';

export type {
  DialogHandlingInput,
  DialogEntry,
  DialogHandlingResult,
  DialogHandlerConfig
} from './dialog-handling-tool.js';