import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { RETENTION_HOURS } from "@/lib/config";

export const metadata: Metadata = { title: "Salon terms" };

export default function Terms() {
  return (
    <>
      <SiteHeader />
      <main className="narrow flow prose">
        <div className="eyebrow">For salons</div>
        <h1>Salon terms (summary)</h1>
        <p className="muted"><em>Plain-language summary for pilots. The full agreement and Data Processing Addendum must be reviewed by counsel before paid launch.</em></p>
        <h2>Roles</h2>
        <p>The salon is the Data Fiduciary for customer photos captured through its link or tablet. Keshkala is the salon's Data Processor and processes photos only on the salon's documented instructions: generating hairstyle previews for that customer.</p>
        <h2>The salon agrees to</h2>
        <ul>
          <li>Only photograph a customer after they've accepted the consent screen themselves (or their guardian has, for under-18s).</li>
          <li>Never upload photos of people who are not present and consenting, celebrities or other third parties.</li>
          <li>Not download customer photos for marketing without separate written consent from the customer.</li>
          <li>Keep staff logins personal and remove staff who leave.</li>
        </ul>
        <h2>Keshkala agrees to</h2>
        <ul>
          <li>Delete photos and previews within {RETENTION_HOURS} hours, and immediately on a customer's request.</li>
          <li>Never use customer photos to train models, and only use AI providers whose terms forbid training on API inputs.</li>
          <li>Keep consent records and access logs for one year, and notify the salon of any personal data breach without delay.</li>
        </ul>
        <h2>Plans and billing</h2>
        <p>Plans include a monthly number of try-ons (one try-on = one generated look). Looks that fail or are rejected by the identity check are not counted. Pilots are invoiced manually; Razorpay subscriptions will follow.</p>
        <h2>AI output</h2>
        <p>Previews are illustrative, labelled AI-generated, and carry an "actual results may vary" disclaimer. The salon should not promise customers an identical result.</p>
      </main>
    </>
  );
}
