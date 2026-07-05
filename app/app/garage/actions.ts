'use server';

// Garage mutations. Same conventions as lib/auth/actions.ts: ActionResult
// with Slovak error strings for useActionState forms; `{ error: '' }` means
// success (the page revalidates in place, no redirect).

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/server';
import { canAddGarageEntry } from '@/lib/billing/quota';
import { effectivePlan, getUserSubscription } from '@/lib/billing/subscription';
import { getUsageSummary } from '@/lib/billing/usage';
import { getDb } from '@/lib/db';
import { garage, vehicleModels } from '@/lib/db/schema';
// NOTE: no type re-exports here — Turbopack treats every export of a
// 'use server' module as a server action. Import ActionResult from
// lib/forms/action-utils directly.
import { parseOptionalInt, type ActionResult } from '@/lib/forms/action-utils';

const CURRENT_YEAR = new Date().getFullYear();

export async function addGarageEntryAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Musíte byť prihlásený.' };

  // Quota first — the check + insert are not atomic, so two concurrent
  // submits can overshoot the limit by one. Accepted: the next check counts
  // real rows, so the state self-corrects and can't run away.
  const [sub, usage] = await Promise.all([
    getUserSubscription(user.id),
    getUsageSummary(user.id),
  ]);
  const quota = canAddGarageEntry(effectivePlan(sub), usage.garageCount);
  if (!quota.ok) {
    return {
      error: `Dosiahli ste limit ${quota.limit} vozidiel vo vašom pláne. Prejdite na vyšší plán v sekcii Predplatné.`,
    };
  }

  const label = String(formData.get('label') ?? '').trim();
  const modelIdRaw = String(formData.get('modelId') ?? '').trim();
  const modelId = modelIdRaw ? Number(modelIdRaw) : null;
  if (modelIdRaw && (!Number.isInteger(modelId) || modelId! <= 0)) {
    return { error: 'Neplatný model.' };
  }
  if (!modelId && !label) {
    return { error: 'Vyberte model alebo zadajte vlastný názov vozidla.' };
  }

  const year = parseOptionalInt(formData.get('year'), 1950, CURRENT_YEAR + 1);
  if (year === 'invalid') return { error: `Rok výroby musí byť 1950 až ${CURRENT_YEAR + 1}.` };
  const mileageKm = parseOptionalInt(formData.get('mileageKm'), 0, 2_000_000);
  if (mileageKm === 'invalid') return { error: 'Nájazd musí byť 0 až 2 000 000 km.' };
  const purchasePrice = parseOptionalInt(formData.get('purchasePriceEur'), 0, 2_000_000);
  if (purchasePrice === 'invalid') return { error: 'Nákupná cena musí byť 0 až 2 000 000 €.' };
  const targetMargin = parseOptionalInt(formData.get('targetMarginEur'), 0, 2_000_000);
  if (targetMargin === 'invalid') return { error: 'Cieľová marža musí byť 0 až 2 000 000 €.' };

  const vin = String(formData.get('vin') ?? '').trim().toUpperCase();
  if (vin.length > 17) return { error: 'VIN má najviac 17 znakov.' };
  const notes = String(formData.get('notes') ?? '').trim();
  if (notes.length > 2000) return { error: 'Poznámka je príliš dlhá (max 2000 znakov).' };

  try {
    const db = getDb();
    if (modelId) {
      const found = await db
        .select({ id: vehicleModels.id })
        .from(vehicleModels)
        .where(eq(vehicleModels.id, modelId))
        .limit(1);
      if (found.length === 0) return { error: 'Vybraný model neexistuje.' };
    }
    await db.insert(garage).values({
      userId: user.id,
      modelId,
      label: label || null,
      vin: vin || null,
      year: year.value,
      mileageKm: mileageKm.value,
      purchasePriceEur: purchasePrice.value != null ? String(purchasePrice.value) : null,
      targetMarginEur: targetMargin.value != null ? String(targetMargin.value) : null,
      notes: notes || null,
    });
  } catch (e) {
    console.error('garage_add_failed', e instanceof Error ? e.message : e);
    return { error: 'Uloženie zlyhalo. Skúste to znova.' };
  }

  revalidatePath('/app/garage');
  revalidatePath('/app/billing');
  return { error: '' };
}

export async function deleteGarageEntryAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Musíte byť prihlásený.' };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Chýba identifikátor.' };

  try {
    const db = getDb();
    // Ownership lives in the predicate — never delete by id alone.
    const deleted = await db
      .delete(garage)
      .where(and(eq(garage.id, id), eq(garage.userId, user.id)))
      .returning({ id: garage.id });
    if (deleted.length === 0) {
      revalidatePath('/app/garage');
      return { error: 'Záznam už neexistuje.' };
    }
  } catch (e) {
    console.error('garage_delete_failed', e instanceof Error ? e.message : e);
    return { error: 'Vymazanie zlyhalo. Skúste to znova.' };
  }

  revalidatePath('/app/garage');
  revalidatePath('/app/billing');
  return { error: '' };
}
