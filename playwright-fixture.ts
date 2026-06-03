// Re-export Playwright's standard test/expect fixture.
// This avoids relying on Lovable's private Playwright helper package when running locally.
export { test, expect } from "@playwright/test";
