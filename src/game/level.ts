import courtyard from './levels/004-courtyard.json';
import { parseMap, resolveMap } from './maps.ts';

export const COURTYARD_MAP = parseMap(courtyard);
export const COURTYARD = resolveMap(COURTYARD_MAP);
