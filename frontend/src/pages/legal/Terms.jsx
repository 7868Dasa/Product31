import { LegalPage } from './LegalPage.jsx';

const H = ({ children }) => <h2 className="mt-5 text-base font-bold">{children}</h2>;

export function Terms() {
  return (
    <LegalPage titleKey="legal.termsTitle">
      <p><em>Draft — pending legal review and Tamil translation.</em></p>

      <H>What Product 31 is</H>
      <p>Product 31 is a platform that lets you order ahead from a local shop and collect in
        person. Product 31 is an <b>intermediary</b> — the shop is the seller. Product 31 does not
        buy, sell, own, or deliver the goods, and does not handle payment. You pay the shop in
        cash when you collect.</p>

      <H>Your account</H>
      <p>You must be 18+ and give accurate information. Keep your phone and device secure. You are
        responsible for orders placed from your account.</p>

      <H>Orders and cancellation</H>
      <ul className="list-disc pl-5">
        <li>Placing an order is a request. The shop accepts or rejects it within its stated time
          (default 5 minutes); if it does not respond, the order expires.</li>
        <li>An accepted order is held for the shop’s pickup window (default 90 minutes). If you do
          not collect, it is marked no-show and the stock is released.</li>
        <li>No money changes hands through Product 31, so there is nothing to refund. Rejected,
          expired, and no-show orders simply close.</li>
        <li>Prices shown come from the shop. The final amount is confirmed at the counter.</li>
      </ul>

      <H>Acceptable use</H>
      <p>No fraudulent, abusive, or automated ordering; no attempts to disrupt or probe the
        service; no misuse of another person’s account.</p>

      <H>Shops</H>
      <p>Shops onboard under a separate Merchant Agreement and are responsible for their listings,
        stock, prices, and fulfilment.</p>

      <H>Liability</H>
      <p>Product 31 provides the platform “as is”. To the extent permitted by law, Product 31 is
        not liable for the quality, safety, or availability of goods, or for disputes between you
        and a shop. Nothing here limits rights you have under the Consumer Protection Act, 2019.</p>

      <H>Grievances</H>
      <p>Contact our Grievance Officer: <b>[NAME]</b>, <b>[EMAIL]</b>. Acknowledged within
        48 hours, resolved within one month.</p>

      <H>Governing law</H>
      <p>These terms are governed by the laws of India. Courts at <b>[CITY], Tamil Nadu</b> have
        jurisdiction.</p>

      <p className="text-xs text-ink-soft">Version 2026-09-01 (draft).</p>
    </LegalPage>
  );
}
