// Watchlist alert e-mail. Rendered server-side via @react-email/components'
// render() in lib/notifications/watchlist-alerts.ts.

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type AlertListing = {
  title: string;
  priceEur: number | null;
  year: number | null;
  mileageKm: number | null;
  url: string;
};

export type AlertGroup = {
  watchLabel: string;
  listings: AlertListing[];
  extraCount: number;
};

const MAX_SHOWN = 10;

export function buildAlertGroups(
  raw: { watchLabel: string; listings: AlertListing[] }[],
): AlertGroup[] {
  return raw.map((g) => ({
    watchLabel: g.watchLabel,
    listings: g.listings.slice(0, MAX_SHOWN),
    extraCount: Math.max(0, g.listings.length - MAX_SHOWN),
  }));
}

export function alertSubject(totalListings: number): string {
  return `Nové inzeráty pre vaše sledovania (${totalListings})`;
}

export function WatchlistAlertEmail({
  groups,
  appUrl,
}: {
  groups: AlertGroup[];
  appUrl: string;
}) {
  const total = groups.reduce((s, g) => s + g.listings.length + g.extraCount, 0);
  return (
    <Html lang="sk">
      <Head />
      <Preview>{`${total} nových inzerátov zodpovedá vašim sledovaniam.`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f6', fontFamily: 'Arial, sans-serif' }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            margin: '24px auto',
            maxWidth: 560,
            padding: 24,
          }}
        >
          <Heading as="h1" style={{ fontSize: 20, margin: '0 0 4px' }}>
            Nové inzeráty pre vaše sledovania
          </Heading>
          <Text style={{ color: '#555', fontSize: 14, margin: '0 0 16px' }}>
            CPCProfit našiel {total} nových inzerátov zodpovedajúcich vašim kritériám.
          </Text>

          {groups.map((group) => (
            <Section key={group.watchLabel} style={{ marginBottom: 16 }}>
              <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px' }}>
                {group.watchLabel}
              </Heading>
              {group.listings.map((l) => (
                <Text key={l.url} style={{ fontSize: 13, margin: '0 0 6px' }}>
                  <Link href={l.url} style={{ color: '#2563eb' }}>
                    {l.title}
                  </Link>
                  {' — '}
                  {l.priceEur != null ? `${l.priceEur.toLocaleString('sk-SK')} €` : 'cena neuvedená'}
                  {l.year != null ? ` · ${l.year}` : ''}
                  {l.mileageKm != null ? ` · ${l.mileageKm.toLocaleString('sk-SK')} km` : ''}
                </Text>
              ))}
              {group.extraCount > 0 ? (
                <Text style={{ color: '#555', fontSize: 12, margin: 0 }}>
                  + {group.extraCount} ďalších v aplikácii
                </Text>
              ) : null}
            </Section>
          ))}

          <Hr style={{ borderColor: '#e5e5e5', margin: '16px 0' }} />
          <Text style={{ color: '#888', fontSize: 12, margin: 0 }}>
            Alerty si zapnete alebo vypnete pri každom sledovaní na{' '}
            <Link href={`${appUrl}/app/watchlist`} style={{ color: '#2563eb' }}>
              stránke Sledované modely
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
