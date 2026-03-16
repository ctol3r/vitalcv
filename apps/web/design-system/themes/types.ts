import type { SemanticColorScale } from '../tokens/colors';

export interface VdsThemeDefinition {
  name: 'light' | 'dark' | 'midnight' | 'graphite';
  label: string;
  colors: SemanticColorScale;
}
