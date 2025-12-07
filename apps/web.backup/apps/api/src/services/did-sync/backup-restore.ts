export interface BackupPack {
  backupId: string;
  clinicianId: string;
  dids: Record<string, any>;
  encrypted: boolean;
  createdAt: string;
}

export const backupRestore = {
  async create(clinicianId: string): Promise<BackupPack> {
    return {
      backupId: `backup_${Date.now()}`,
      clinicianId,
      dids: {
        primary: `did:key:${Math.random().toString(36).substr(2, 9)}`,
        secondary: `did:web:${Math.random().toString(36).substr(2, 9)}`,
      },
      encrypted: true,
      createdAt: new Date().toISOString(),
    };
  },

  async restore(clinicianId: string, backupId: string): Promise<{ restored: boolean; dids: Record<string, any> }> {
    return {
      restored: true,
      dids: {
        primary: `did:key:${Math.random().toString(36).substr(2, 9)}`,
        secondary: `did:web:${Math.random().toString(36).substr(2, 9)}`,
      },
    };
  },
};








