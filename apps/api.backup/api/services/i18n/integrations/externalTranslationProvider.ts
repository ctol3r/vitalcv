/**
 * B241B-I18N-011: ExternalTranslationProvider integration
 *
 * Provides adapter for an external translation service (e.g., Google Cloud Translate)
 * - Implements batch translation
 * - Handles authentication
 * - Logs API calls
 * - Includes stub for offline mode
 */

export interface TranslationRequest {
  text: string;
  sourceLocale: string;
  targetLocale: string;
  context?: string;
}

export interface BatchTranslationRequest {
  texts: string[];
  sourceLocale: string;
  targetLocale: string;
  context?: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  confidence?: number;
}

export interface BatchTranslationResponse {
  translations: TranslationResponse[];
  sourceLocale: string;
  targetLocale: string;
}

export interface TranslationProviderConfig {
  apiKey?: string;
  projectId?: string;
  region?: string;
  enableOfflineMode?: boolean;
  offlineTranslations?: Record<string, Record<string, string>>;
  batchSize?: number;
  timeout?: number;
}

export interface ApiCallLog {
  timestamp: Date;
  method: string;
  sourceLocale: string;
  targetLocale: string;
  textCount: number;
  success: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * External translation provider adapter
 * Supports Google Cloud Translate and other providers
 */
export class ExternalTranslationProvider {
  private config: TranslationProviderConfig;
  private apiCallLogs: ApiCallLog[] = [];
  private offlineMode: boolean = false;

  constructor(config: TranslationProviderConfig) {
    this.config = {
      batchSize: 100,
      timeout: 30000,
      enableOfflineMode: false,
      ...config,
    };
    this.offlineMode = this.config.enableOfflineMode || !this.config.apiKey;
  }

  /**
   * Translate a single text
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    try {
      if (this.offlineMode) {
        return this.translateOffline(request);
      }

      const response = await this.callTranslationAPI([request.text], request.sourceLocale, request.targetLocale);

      const responseTime = Date.now() - startTime;
      this.logApiCall('translate', request.sourceLocale, request.targetLocale, 1, true, undefined, responseTime);

      return {
        translatedText: response.translations[0].translatedText,
        sourceLocale: request.sourceLocale,
        targetLocale: request.targetLocale,
        confidence: response.translations[0].confidence,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logApiCall('translate', request.sourceLocale, request.targetLocale, 1, false, errorMessage, responseTime);

      // Fallback to offline mode if enabled
      if (this.config.enableOfflineMode) {
        console.warn(`Translation API failed, falling back to offline mode: ${errorMessage}`);
        return this.translateOffline(request);
      }

      throw error;
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResponse> {
    const startTime = Date.now();
    const batchSize = this.config.batchSize || 100;
    const allTranslations: TranslationResponse[] = [];

    try {
      if (this.offlineMode) {
        return this.translateBatchOffline(request);
      }

      // Process in batches
      for (let i = 0; i < request.texts.length; i += batchSize) {
        const batch = request.texts.slice(i, i + batchSize);
        const batchResponse = await this.callTranslationAPI(
          batch,
          request.sourceLocale,
          request.targetLocale
        );
        allTranslations.push(...batchResponse.translations);
      }

      const responseTime = Date.now() - startTime;
      this.logApiCall(
        'translateBatch',
        request.sourceLocale,
        request.targetLocale,
        request.texts.length,
        true,
        undefined,
        responseTime
      );

      return {
        translations: allTranslations,
        sourceLocale: request.sourceLocale,
        targetLocale: request.targetLocale,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logApiCall(
        'translateBatch',
        request.sourceLocale,
        request.targetLocale,
        request.texts.length,
        false,
        errorMessage,
        responseTime
      );

      // Fallback to offline mode if enabled
      if (this.config.enableOfflineMode) {
        console.warn(`Translation API failed, falling back to offline mode: ${errorMessage}`);
        return this.translateBatchOffline(request);
      }

      throw error;
    }
  }

  /**
   * Call the actual translation API (Google Cloud Translate implementation)
   */
  private async callTranslationAPI(
    texts: string[],
    sourceLocale: string,
    targetLocale: string
  ): Promise<BatchTranslationResponse> {
    if (!this.config.apiKey) {
      throw new Error('Translation API key not configured');
    }

    // Google Cloud Translate API implementation
    // In a real implementation, this would call the actual API
    const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${this.config.apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: texts,
        source: sourceLocale,
        target: targetLocale,
        format: 'text',
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Translation API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      translations: data.data.translations.map((t: any) => ({
        translatedText: t.translatedText,
        sourceLocale,
        targetLocale,
        confidence: t.detectedSourceLanguage ? 0.95 : undefined,
      })),
      sourceLocale,
      targetLocale,
    };
  }

  /**
   * Offline translation stub
   * Returns the original text or a cached translation if available
   */
  private translateOffline(request: TranslationRequest): TranslationResponse {
    const cacheKey = `${request.sourceLocale}:${request.targetLocale}`;
    const cached = this.config.offlineTranslations?.[cacheKey]?.[request.text];

    if (cached) {
      return {
        translatedText: cached,
        sourceLocale: request.sourceLocale,
        targetLocale: request.targetLocale,
        confidence: 0.5, // Lower confidence for offline translations
      };
    }

    // Return original text as fallback
    console.warn(`No offline translation available for ${request.sourceLocale} -> ${request.targetLocale}`);
    return {
      translatedText: request.text,
      sourceLocale: request.sourceLocale,
      targetLocale: request.targetLocale,
      confidence: 0.0,
    };
  }

  /**
   * Batch offline translation
   */
  private translateBatchOffline(request: BatchTranslationRequest): BatchTranslationResponse {
    const translations = request.texts.map((text) =>
      this.translateOffline({
        text,
        sourceLocale: request.sourceLocale,
        targetLocale: request.targetLocale,
      })
    );

    return {
      translations,
      sourceLocale: request.sourceLocale,
      targetLocale: request.targetLocale,
    };
  }

  /**
   * Log API call for monitoring and debugging
   */
  private logApiCall(
    method: string,
    sourceLocale: string,
    targetLocale: string,
    textCount: number,
    success: boolean,
    error?: string,
    responseTime?: number
  ): void {
    const log: ApiCallLog = {
      timestamp: new Date(),
      method,
      sourceLocale,
      targetLocale,
      textCount,
      success,
      error,
      responseTime,
    };

    this.apiCallLogs.push(log);

    // Keep only last 1000 logs
    if (this.apiCallLogs.length > 1000) {
      this.apiCallLogs = this.apiCallLogs.slice(-1000);
    }

    // Log to console
    if (success) {
      console.log(
        `[TRANSLATION_API] ${method} ${sourceLocale}->${targetLocale} ${textCount} texts ${responseTime}ms`
      );
    } else {
      console.error(
        `[TRANSLATION_API] ${method} ${sourceLocale}->${targetLocale} ${textCount} texts FAILED: ${error}`
      );
    }
  }

  /**
   * Get API call logs
   */
  getApiCallLogs(limit?: number): ApiCallLog[] {
    const logs = this.apiCallLogs.slice();
    if (limit) {
      return logs.slice(-limit);
    }
    return logs;
  }

  /**
   * Clear API call logs
   */
  clearApiCallLogs(): void {
    this.apiCallLogs = [];
  }

  /**
   * Enable or disable offline mode
   */
  setOfflineMode(enabled: boolean): void {
    this.offlineMode = enabled;
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean {
    return this.offlineMode;
  }
}

