import { LegalPage } from './LegalPage.jsx';

const H = ({ children }) => <h2 className="mt-5 text-base font-bold">{children}</h2>;

export function Security() {
  return (
    <LegalPage titleKey="legal.securityTitle">
      <p><em>Draft — pending review.</em></p>

      <H>Reporting a vulnerability</H>
      <p>If you believe you have found a security issue in Product 31, email
        <b> security@[DOMAIN]</b> with steps to reproduce. Please do not disclose it publicly
        until we have had a chance to fix it. We aim to acknowledge within 3 working days.</p>

      <H>Scope</H>
      <p>The Product 31 web application and API. Out of scope: denial-of-service, social
        engineering, and issues in third-party services we do not control.</p>

      <H>What we do</H>
      <ul className="list-disc pl-5">
        <li>Signed, short-lived access tokens; revocable refresh tokens hashed at rest.</li>
        <li>OTP codes hashed at rest; never logged in plaintext; strict rate limits.</li>
        <li>Parameterised database queries and schema-validated inputs everywhere.</li>
        <li>Security headers, CORS allow-list, request size limits.</li>
        <li>Auth and security events logged and retained per CERT-In guidance.</li>
        <li>Dependencies audited; no known vulnerabilities at release.</li>
      </ul>

      <p className="text-xs text-ink-soft">
        A machine-readable version is served at <code>/.well-known/security.txt</code>.
      </p>
    </LegalPage>
  );
}
