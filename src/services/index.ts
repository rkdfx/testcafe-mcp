/**
 * Services module exports
 */

export { TestCafeService } from './testcafe-service.js';
export { BrowserInteractionService } from './browser-interaction-service.js';
export { PageInspectionService } from './page-inspection-service.js';
export { PerformanceMonitor, performanceMonitor } from './performance-monitor.js';

// New services
export { AccessibilityService } from './accessibility-service.js';
export { TabManagementService } from './tab-management-service.js';
export { NetworkMonitoringService } from './network-monitoring-service.js';

export type {
  TestStructure,
  TestExecutionResult,
  TestValidationResult
} from './testcafe-service.js';

export type {
  BrowserAction,
  ClickAction,
  TypeAction,
  NavigateAction,
  WaitAction,
  AssertAction,
  ElementInfo,
  SelectorSuggestion
} from './browser-interaction-service.js';

export type {
  PageInspectionOptions,
  ElementDiscoveryResult,
  PageStructureAnalysis
} from './page-inspection-service.js';

// New service types
export type {
  AccessibilityNode,
  AccessibilitySnapshotResult,
  AccessibilitySnapshotOptions
} from './accessibility-service.js';

export type {
  TabInfo,
  TabManagementResult,
  TabManagementOptions
} from './tab-management-service.js';

export type {
  NetworkRequest,
  NetworkLogsResult,
  NetworkMonitoringOptions
} from './network-monitoring-service.js';