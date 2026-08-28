import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceHost } from './workspace-host.js';

describe('normalizeWorkspaceHost', () => {
  it.each([
    ['workspace.cloud.databricks.com', 'https://workspace.cloud.databricks.com'],
    ['https://workspace.cloud.databricks.com', 'https://workspace.cloud.databricks.com'],
    ['  https://workspace.cloud.databricks.com///  ', 'https://workspace.cloud.databricks.com'],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeWorkspaceHost(input)).toBe(expected);
  });
});
