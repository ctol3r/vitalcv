// store.ts - Credential store service with proper error handling

export interface CredentialRecord {
  id: string;
  jwt: string;
  subjectId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialStore {
  private credentials: Map<string, CredentialRecord> = new Map();

  /**
   * Sets the status of a credential record by ID.
   * Throws an error if the credential is not found instead of creating incomplete records.
   *
   * @param id - The credential ID
   * @param status - The new status to set
   * @throws Error if credential with the given ID is not found
   */
  setStatus(id: string, status: string): CredentialRecord {
    const credential = this.credentials.get(id);

    if (!credential) {
      throw new Error(`Credential with ID '${id}' not found`);
    }

    // Update the existing credential record
    credential.status = status;
    credential.updatedAt = new Date();

    return credential;
  }

  /**
   * Creates a new credential record with all required fields.
   *
   * @param id - The credential ID
   * @param jwt - The JWT token
   * @param subjectId - The subject ID
   * @param status - The initial status
   */
  createCredential(
    id: string,
    jwt: string,
    subjectId: string,
    status: string = 'pending',
  ): CredentialRecord {
    const now = new Date();
    const credential: CredentialRecord = {
      id,
      jwt,
      subjectId,
      status,
      createdAt: now,
      updatedAt: now,
    };

    this.credentials.set(id, credential);
    return credential;
  }

  /**
   * Retrieves a credential record by ID.
   *
   * @param id - The credential ID
   * @returns The credential record or undefined if not found
   */
  getCredential(id: string): CredentialRecord | undefined {
    return this.credentials.get(id);
  }

  /**
   * Retrieves all credential records.
   *
   * @returns Array of all credential records
   */
  getAllCredentials(): CredentialRecord[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Deletes a credential record by ID.
   *
   * @param id - The credential ID
   * @returns True if the credential was deleted, false if not found
   */
  deleteCredential(id: string): boolean {
    return this.credentials.delete(id);
  }
}
