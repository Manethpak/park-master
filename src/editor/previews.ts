import { ASSETS, assetPreviewUrl } from '../game/assets.ts';

export const PREVIEWS: Record<string, string> = Object.fromEntries(Object.entries(ASSETS).map(([id, asset]) => [id, assetPreviewUrl(asset)]));
