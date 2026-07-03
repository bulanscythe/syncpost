import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";

export class GlobalLock {
  constructor(lockDirName, tmpDir) {
    this.lockDirPath = join(tmpDir, lockDirName);
    this.ownerFilePath = join(this.lockDirPath, "owner.json");
    this.hasLock = false;
  }

  acquire() {
    try {
      // mkdirSync is atomic. If it fails with EEXIST, someone else has the lock or it's stale.
      mkdirSync(this.lockDirPath, { recursive: false });
      this._writeOwnerFile();
      this.hasLock = true;
      return true;
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }

      // Lock directory exists, check if stale.
      if (this._isLockStale()) {
        try {
          // Reclaim lock
          rmSync(this.lockDirPath, { recursive: true, force: true });
          mkdirSync(this.lockDirPath, { recursive: false });
          this._writeOwnerFile();
          this.hasLock = true;
          return true;
        } catch (reclaimErr) {
          // It's possible another process reclaimed it just before we did.
          if (reclaimErr.code === "EEXIST" || reclaimErr.code === "ENOENT") {
            return false;
          }
          throw reclaimErr;
        }
      }
      return false;
    }
  }

  release() {
    if (this.hasLock) {
      try {
        rmSync(this.lockDirPath, { recursive: true, force: true });
        this.hasLock = false;
      } catch (err) {
        console.error("Failed to release lock:", err.message);
      }
    }
  }

  _writeOwnerFile() {
    const ownerData = {
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date().toISOString()
    };
    writeFileSync(this.ownerFilePath, JSON.stringify(ownerData), "utf8");
  }

  _isLockStale() {
    try {
      if (!existsSync(this.ownerFilePath)) {
        // If owner.json is missing, could be in the middle of creation.
        // Be conservative. Assume it is NOT stale.
        return false;
      }

      const data = JSON.parse(readFileSync(this.ownerFilePath, "utf8"));
      
      // Only verify and reclaim if the hostname matches. 
      // If hostname is different (e.g. shared NFS or copied dir), be conservative and don't reclaim.
      if (data.hostname !== hostname()) {
        return false; 
      }

      if (!data.pid) {
         return false; // Malformed
      }

      return !this._isPidAlive(data.pid);
    } catch (err) {
      // Malformed JSON or other read error: handle conservatively
      return false;
    }
  }

  _isPidAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      // ESRCH means process does not exist
      if (err.code === "ESRCH") {
        return false;
      }
      // EPERM means it exists but we don't have permission to signal it.
      return true;
    }
  }
}
