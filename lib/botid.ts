// Vercel BotID wrapper. The real BotID SDK is loaded server-side at the
// platform layer; here we keep a small façade so app code calls a single
// helper and we can swap implementations without touching call sites.
//
// In the local dev / pre-deploy mode, this always reports "human". Once the
// project is linked to Vercel and BotID is enabled, replace the body with
// `import { checkBotId } from 'botid/server'` and forward the request.

export type BotIdVerdict = {
  isBot: boolean;
  reason: string | null;
};

export async function checkBotIdSafe(request: Request): Promise<BotIdVerdict> {
  void request; // signature parity with the future BotID implementation
  if (process.env.VERCEL_BOTID_ENABLED !== '1') {
    return { isBot: false, reason: null };
  }
  // TODO swap for real BotID call once `botid` package is available in this
  // environment. Until then, treat all requests as human in production too,
  // so we never block legitimate users due to a missing dependency.
  return { isBot: false, reason: null };
}
