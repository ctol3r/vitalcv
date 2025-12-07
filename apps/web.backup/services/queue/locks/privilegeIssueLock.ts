export class PrivilegeIssueLock {
  private readonly active = new Set<string>();

  tryAcquire(privilegeGrantedId: string | null | undefined): boolean {
    if (!privilegeGrantedId) {
      return true;
    }

    if (this.active.has(privilegeGrantedId)) {
      return false;
    }

    this.active.add(privilegeGrantedId);
    return true;
  }

  release(privilegeGrantedId: string | null | undefined): void {
    if (!privilegeGrantedId) {
      return;
    }
    this.active.delete(privilegeGrantedId);
  }

  isLocked(privilegeGrantedId: string | null | undefined): boolean {
    if (!privilegeGrantedId) {
      return false;
    }
    return this.active.has(privilegeGrantedId);
  }
}

export const privilegeIssueLock = new PrivilegeIssueLock();

