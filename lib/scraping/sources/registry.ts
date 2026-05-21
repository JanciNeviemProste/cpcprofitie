import { autobazarSk } from './autobazar-sk';
import { autobazarEu } from './autobazar-eu';
import { bazosSk } from './bazos-sk';
import type { ScraperSource } from './source-interface';
import type { Source } from '../types';

export const SOURCES: Record<Source, ScraperSource> = {
  'autobazar.sk': autobazarSk,
  'autobazar.eu': autobazarEu,
  'bazos.sk': bazosSk,
};

export function getSource(id: Source): ScraperSource {
  const s = SOURCES[id];
  if (!s) throw new Error(`Unknown source: ${id}`);
  return s;
}
