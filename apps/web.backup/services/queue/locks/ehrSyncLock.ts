export class EhrSyncLock {
  private readonly activeOrgIds = new Set<string>();

  tryAcquire(orgId: string | null | undefined): boolean {
    if (!orgId) {
      return true;
    }

    if (this.activeOrgIds.has(orgId)) {
      return false;
    }

    this.activeOrgIds.add(orgId);
    return true;
  }

  release(orgId: string | null | undefined): void {
    if (!orgId) {
      return;
    }
    this.activeOrgIds.delete(orgId);
  }

  isLocked(orgId: string | null | undefined): boolean {
    if (!orgId) {
      return false;
    }
    return this.activeOrgIds.has(orgId);
  }
}

export const ehrSyncLock = new EhrSyncLock();

