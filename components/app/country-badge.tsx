// Marks an advert that is not on the Slovak market.
//
// The price reference this product publishes is Slovak, but the deals list
// deliberately scores foreign cars against it — a Czech car well under the
// Slovak median is the arbitrage the product exists to find. That only works
// if the dealer can see the car is abroad: without this badge a Czech advert
// is indistinguishable from a local one, and "great deal" quietly means
// "and it is a 600 km drive away, in another tax jurisdiction".
//
// Nothing is rendered for Slovak rows, and nothing for rows whose country we
// have not established — an unknown country is not a claim that the car is
// foreign.
const LABELS: Readonly<Record<string, string>> = {
  CZ: 'ČR',
};

export function CountryBadge({ country }: { country: string | null | undefined }) {
  if (!country || country === 'SK') return null;
  const label = LABELS[country] ?? country;
  return (
    <span
      className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400"
      title="Vozidlo nie je na slovenskom trhu — cena je porovnaná so slovenským mediánom"
    >
      {label}
    </span>
  );
}
