import { streamText } from 'ai';
import { z } from 'zod';
import { DEFAULT_MODEL } from '@/lib/ai';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const InputSchema = z.object({
  make: z.string().min(1).max(64),
  model: z.string().min(1).max(96),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000),
  fuel: z.string().optional(),
  transmission: z.string().optional(),
  bodyType: z.string().optional(),
  features: z.string().max(1000).optional(),
  priceEur: z.coerce.number().int().min(0).max(2_000_000).optional(),
  tone: z.enum(['formal', 'sales', 'short']).default('sales'),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const system = buildSystemPrompt(input.tone);
  const userPrompt = buildUserPrompt(input);

  // Without an AI Gateway key, stream a deterministic mock so the UI is
  // demoable in local-only mode. Replace with a real call once env is wired.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return new Response(mockStream(input), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-cpcprofit-mode': 'mock',
      },
    });
  }

  const result = streamText({
    model: DEFAULT_MODEL,
    system,
    prompt: userPrompt,
    temperature: 0.7,
  });

  return result.toTextStreamResponse({
    headers: { 'x-cpcprofit-mode': 'live' },
  });
}

function mockStream(input: z.infer<typeof InputSchema>): ReadableStream<Uint8Array> {
  const fluff = {
    formal: 'Vozidlo je v stave zodpovedajúcom roku výroby a počtu najazdených kilometrov.',
    sales: 'Pripravené na okamžité prebratie s plnou servisnou históriou.',
    short: 'Ihneď k odberu.',
  }[input.tone];

  const text =
    `${input.make} ${input.model} ${input.year}\n\n` +
    `${input.make} ${input.model} z roku ${input.year} s nájazdom ${input.mileageKm} km. ` +
    `${input.fuel ? `Palivo ${input.fuel}. ` : ''}${input.transmission ? `Prevodovka ${input.transmission}. ` : ''}` +
    `${input.features ? `Výbava: ${input.features}. ` : ''}` +
    `${fluff} ` +
    `${input.priceEur ? `Cena ${input.priceEur} €.` : ''}\n\n` +
    `(Demo režim — nakonfigurujte AI_GATEWAY_API_KEY pre živé generovanie.)`;

  const encoder = new TextEncoder();
  const tokens = text.split(/(\s+)/);
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= tokens.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(tokens[i]!));
      i++;
      await new Promise<void>((r) => setTimeout(r, 35));
    },
  });
}
