import { test } from "node:test";
import assert from "node:assert";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { GlobalLock } from "../lib/lock.mjs";

test("GlobalLock acquires and releases successfully", () => {
  const tmpDir = join(process.cwd(), "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const lock = new GlobalLock("test-1.lock", tmpDir);
  
  // Ensure clean state
  rmSync(lock.lockDirPath, { recursive: true, force: true });

  assert.strictEqual(lock.acquire(), true);
  assert.strictEqual(lock.hasLock, true);
  
  // Second acquire should fail since first has it
  const lock2 = new GlobalLock("test-1.lock", tmpDir);
  assert.strictEqual(lock2.acquire(), false);

  lock.release();
  assert.strictEqual(lock.hasLock, false);
});

test("GlobalLock reclaims stale lock", () => {
  const tmpDir = join(process.cwd(), "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const lockName = "test-stale.lock";
  const lockPath = join(tmpDir, lockName);
  
  rmSync(lockPath, { recursive: true, force: true });
  mkdirSync(lockPath, { recursive: true });

  // Mock a dead PID (e.g. 9999999 is extremely unlikely to exist)
  const ownerData = {
    pid: 9999999,
    hostname: hostname(),
    startedAt: new Date().toISOString()
  };
  writeFileSync(join(lockPath, "owner.json"), JSON.stringify(ownerData));

  const lock = new GlobalLock(lockName, tmpDir);
  // Should successfully reclaim
  assert.strictEqual(lock.acquire(), true);
  lock.release();
});
