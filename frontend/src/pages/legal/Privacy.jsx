import { LegalPage } from './LegalPage.jsx';

const H = ({ children }) => <h2 className="mt-5 text-base font-bold">{children}</h2>;

export function Privacy() {
  return (
    <LegalPage titleKey="legal.privacyTitle">
      <p>
        This notice explains what personal data Product 31 collects, why, and your rights under
        India’s Digital Personal Data Protection Act, 2023. <em>Draft — pending legal review and
        Tamil translation.</em>
      </p>

      <H>What we collect</H>
      <ul className="list-disc pl-5">
        <li><b>Phone number</b> — required to create an account and verify you (OTP).</li>
        <li><b>Name, email</b> — optional, only if you provide them.</li>
        <li><b>Location</b> — only if you turn it on, to show nearby shops. Never stored in a URL.</li>
        <li><b>Orders</b> — items, quantities, price, pickup status, for the shop to fulfil.</li>
        <li><b>Device / security data</b> — IP, browser, and auth events, kept for security and to
          meet CERT-In log requirements.</li>
        <li><b>Voice</b> — if you use voice ordering, speech is processed by your browser’s speech
          service (on Android, Google’s). We store only the resulting text and what you ordered.</li>
      </ul>

      <H>Why we use it (purpose)</H>
      <p>Account and login; showing shops and prices; placing and tracking pickup orders;
        fraud and abuse prevention; legal and tax record-keeping. We do not sell your data.</p>

      <H>Consent</H>
      <p>You give consent when you sign up. Optional uses (location, marketing) are off by default
        and you can withdraw them any time in Account settings, without losing your account.</p>

      <H>Sharing</H>
      <p>With the shop you order from (so they can prepare your order); with service providers
        that run our infrastructure (database, SMS OTP, email, push). Some providers process data
        outside India; this is disclosed here and covered by data-processing agreements. We
        disclose data to authorities only where legally required.</p>

      <H>Retention</H>
      <p>OTP codes: purged within 24 hours. Security logs: kept at least 180 days (CERT-In),
        then purged. Order records: kept for the period required by tax and consumer-protection
        law, then anonymised. Account data: deleted or anonymised when you delete your account.</p>

      <H>Your rights</H>
      <ul className="list-disc pl-5">
        <li>Access / download your data — Account → “Download my data”.</li>
        <li>Correct your data — Account settings.</li>
        <li>Delete your account — Account → “Delete account”. We scrub your personal data and keep
          only anonymised transaction records for the legally-required period.</li>
        <li>Withdraw optional consents — Account settings.</li>
        <li>Complain — contact our Grievance Officer (details below) or the Data Protection Board
          of India.</li>
      </ul>

      <H>Children</H>
      <p>Product 31 is for adults (18+). We do not knowingly collect data from children.</p>

      <H>Grievance Officer</H>
      <p><b>[NAME]</b>, <b>[EMAIL]</b>, <b>[ADDRESS]</b>. We acknowledge complaints within 48 hours
        and aim to resolve them within one month.</p>

      <H>Changes</H>
      <p>If we change this notice materially, we will ask for your consent again. Version:
        <b> 2026-09-01 (draft)</b>.</p>
    </LegalPage>
  );
}
