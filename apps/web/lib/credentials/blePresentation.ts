/**
 * BlePresentationService — stub for Wave 11 build compatibility.
 * Full BLE credential broadcasting implementation pending Wave 12.
 */
export const BlePresentationService = {
  async startBroadcasting(_opts: { vpToken: unknown; presentationId: string }): Promise<void> {
    // stub
  },
  async stopBroadcasting(): Promise<void> {
    // stub
  },
};
