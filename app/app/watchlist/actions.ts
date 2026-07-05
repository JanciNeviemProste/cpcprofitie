'use server';

// Watchlist mutations. Same conventions as lib/auth/actions.ts: ActionResult
// with Slovak error strings; `{ error: '' }` means success.

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/server';
import { canCreateWatchlist } from '@/lib/billing/quota';
import { effectivePlan, getUserSubscription } from '@/lib/billing/subscription';
import { getUsageSummary } from '@/lib/billing/usage';
import { krajByName } from '@/lib/data/sk-regions';
import { getDb } from '@/lib/db';
import { fuelEnum, vehicleModels, watchlist } from '@/lib/db/schema';
// NOTE: no type re-exports here — Turbopack treats every export of a
// 'use server' module as a server action. Import ActionResult from
// lib/forms/action-utils directly.
import { parseOptionalInt, type ActionResult } from '@/lib/forms/action-utils';

const CURRENT_YEAR = new Date().getFullYear();
// Derived from the DB enum — a new fuel type added in the schema is accepted
// here automatically instead of failing Slovak validation.
const FUEL_VALUES = fuelEnum.enumValues;
type Fuel = (typeof FUEL_VALUES)[number];

export async function addWatchlistEntryAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Musíte byť prihlásený.' };

  // Quota check + insert are not atomic — concurrent submits can overshoot
  // by one. Accepted: the next check counts real rows and self-corrects.
  const [sub, usage] = await Promise.all([
    getUserSubscription(user.id),
    getUsageSummary(user.id),
  ]);
  const quota = canCreateWatchlist(effectivePlan(sub), usage.watchlistCount);
  if (!quota.ok) {
    return {
      error: `Dosiahli ste limit ${quota.limit} sledovaní vo vašom pláne. Prejdite na vyšší plán v sekcii Predplatné.`,
    };
  }

  const modelIdRaw = String(formData.get('modelId') ?? '').trim();
  const modelId = Number(modelIdRaw);
  if (!modelIdRaw || !Number.isInteger(modelId) || modelId <= 0) {
    return { error: 'Vyberte model, ktorý chcete sledovať.' };
  }

  const region = String(formData.get('region') ?? '').trim();
  if (region && !krajByName(region)) return { error: 'Neznámy kraj.' };

  const fuelRaw = String(formData.get('fuel') ?? '').trim();
  if (fuelRaw && !(FUEL_VALUES as readonly string[]).includes(fuelRaw)) {
    return { error: 'Neplatné palivo.' };
  }
  const fuel = (fuelRaw || null) as Fuel | null;

  const minPrice = parseOptionalInt(formData.get('minPriceEur'), 0, 2_000_000);
  if (minPrice === 'invalid') return { error: 'Minimálna cena musí byť 0 až 2 000 000 €.' };
  const maxPrice = parseOptionalInt(formData.get('maxPriceEur'), 0, 2_000_000);
  if (maxPrice === 'invalid') return { error: 'Maximálna cena musí byť 0 až 2 000 000 €.' };
  if (minPrice.value != null && maxPrice.value != null && minPrice.value > maxPrice.value) {
    return { error: 'Minimálna cena nemôže byť vyššia ako maximálna.' };
  }
  const minYear = parseOptionalInt(formData.get('minYear'), 1950, CURRENT_YEAR + 1);
  if (minYear === 'invalid') return { error: `Rok od musí byť 1950 až ${CURRENT_YEAR + 1}.` };
  const maxMileage = parseOptionalInt(formData.get('maxMileageKm'), 0, 2_000_000);
  if (maxMileage === 'invalid') return { error: 'Max. nájazd musí byť 0 až 2 000 000 km.' };

  const notifyByEmail = formData.get('notifyByEmail') === 'on';

  try {
    const db = getDb();
    const found = await db
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.id, modelId))
      .limit(1);
    if (found.length === 0) return { error: 'Vybraný model neexistuje.' };

    await db.insert(watchlist).values({
      userId: user.id,
      modelId,
      region: region || null,
      minPriceEur: minPrice.value != null ? String(minPrice.value) : null,
      maxPriceEur: maxPrice.value != null ? String(maxPrice.value) : null,
      minYear: minYear.value,
      maxMileageKm: maxMileage.value,
      fuel,
      notifyByEmail,
    });
  } catch (e) {
    console.error('watchlist_add_failed', e instanceof Error ? e.message : e);
    return { error: 'Uloženie zlyhalo. Skúste to znova.' };
  }

  revalidatePath('/app/watchlist');
  revalidatePath('/app/billing');
  return { error: '' };
}

export async function deleteWatchlistEntryAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Musíte byť prihlásený.' };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Chýba identifikátor.' };

  try {
    const db = getDb();
    // Ownership lives in the predicate — never delete by id alone.
    const deleted = await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, user.id)))
      .returning({ id: watchlist.id });
    if (deleted.length === 0) {
      revalidatePath('/app/watchlist');
      return { error: 'Záznam už neexistuje.' };
    }
  } catch (e) {
    console.error('watchlist_delete_failed', e instanceof Error ? e.message : e);
    return { error: 'Vymazanie zlyhalo. Skúste to znova.' };
  }

  revalidatePath('/app/watchlist');
  revalidatePath('/app/billing');
  return { error: '' };
}

export async function toggleWatchlistNotifyAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Musíte byť prihlásený.' };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Chýba identifikátor.' };
  const notify = String(formData.get('notify') ?? '') === '1';

  try {
    const db = getDb();
    const updated = await db
      .update(watchlist)
      .set({ notifyByEmail: notify })
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, user.id)))
      .returning({ id: watchlist.id });
    if (updated.length === 0) {
      // Stale card (deleted in another tab) — don't toast a false success.
      revalidatePath('/app/watchlist');
      return { error: 'Sledovanie už neexistuje.' };
    }
  } catch (e) {
    console.error('watchlist_toggle_failed', e instanceof Error ? e.message : e);
    return { error: 'Zmena nastavenia zlyhala. Skúste to znova.' };
  }

  revalidatePath('/app/watchlist');
  return { error: '' };
}
