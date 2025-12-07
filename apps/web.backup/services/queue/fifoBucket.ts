export class ClinicianFifoBucket {
  private readonly running = new Set<string>();

  isLocked(clinicianId: string | null | undefined): boolean {
    if (!clinicianId) {
      return false;
    }
    return this.running.has(clinicianId);
  }

  tryAcquire(clinicianId: string | null | undefined): boolean {
    if (!clinicianId) {
      return true;
    }

    if (this.running.has(clinicianId)) {
      return false;
    }

    this.running.add(clinicianId);
    return true;
  }

  release(clinicianId: string | null | undefined): void {
    if (!clinicianId) {
      return;
    }
    this.running.delete(clinicianId);
  }
}

export const clinicianFifoBucket = new ClinicianFifoBucket();

