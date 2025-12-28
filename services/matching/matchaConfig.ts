import { loadSpecialtyDistanceMap } from './specialtyDistance';

export interface MatchaConfig {
  specialtyDistanceMap: ReturnType<typeof loadSpecialtyDistanceMap>;
}

export const MATCHA_CONFIG: MatchaConfig = {
  specialtyDistanceMap: loadSpecialtyDistanceMap(),
};
