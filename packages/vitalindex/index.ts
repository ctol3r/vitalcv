type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface VitalIndexDocument {
  id: string;
  type: string;
  payload: JsonObject;
  updatedAt: string;
}

export interface VitalIndexQuery {
  text?: string;
  filters?: Record<string, string | number | boolean>;
  limit?: number;
  cursor?: string;
}

export interface VitalIndexResult {
  hits: VitalIndexDocument[];
  total: number;
  nextCursor?: string | null;
}

export interface VitalIndexClient {
  search(query: VitalIndexQuery): Promise<VitalIndexResult>;
  upsert(documents: VitalIndexDocument[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
}
