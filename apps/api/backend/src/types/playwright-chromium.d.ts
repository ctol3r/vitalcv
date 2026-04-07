declare module 'playwright-chromium' {
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<{
      newPage(): Promise<{
        setContent(html: string, options?: Record<string, unknown>): Promise<void>;
        emulateMedia(options: Record<string, unknown>): Promise<void>;
        pdf(options?: Record<string, unknown>): Promise<Buffer>;
        close(): Promise<void>;
      }>;
      close(): Promise<void>;
    }>;
  };
}
