import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { CONSENT_VERSION, RETENTION_HOURS } from "@/lib/config";
import { GRIEVANCE_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="narrow flow prose">
        <div className="eyebrow">Notice version {CONSENT_VERSION}</div>
        <h1>Privacy policy</h1>
        <p className="muted">This policy explains how Keshkala and the salons that use it handle your photo under India's Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025. <em>Draft for legal review before launch.</em></p>

        <h2>Who is responsible</h2>
        <p>The salon you are visiting decides to offer the hairstyle preview and is the <strong>Data Fiduciary</strong>. Keshkala runs the software on the salon's behalf as a <strong>Data Processor</strong>. Our contract with each salon limits use of your data to the purpose below.</p>

        <h2>What we collect</h2>
        <ul>
          <li>The photo you take or upload, and the hairstyle previews created from it.</li>
          <li>A mathematical face template (embedding) used only to check that previews still look like you. It is deleted with your photo.</li>
          <li>A record that you consented: time, notice version, whether a guardian consented, and a one-way hash of your IP address.</li>
          <li>An optional note your stylist adds to your Stylist Board.</li>
        </ul>
        <p>We do not need your name, phone number or an account. If a stylist sends your board on WhatsApp, the number is used only on the salon's device to open WhatsApp and is not stored by us.</p>

        <h2>Why</h2>
        <p>Only to show you hairstyle previews during your consultation and to let you download or share them. We never sell your data, never use it to train AI models, never use it for advertising and never create images of other people's faces from it.</p>

        <h2>How long</h2>
        <p>Your photo, the previews, the face template and the stylist note are <strong>deleted automatically {RETENTION_HOURS} hours</strong> after your session starts. Any share link stops working at the same time. The consent record and an access log (which contain no images) are kept for one year so we can show the law was followed.</p>

        <h2>Who processes it</h2>
        <p>Images are stored in private, encrypted storage (Supabase) and sent over an encrypted connection to an AI image-editing provider (Google Gemini, or Black Forest Labs FLUX via Replicate as a fallback) and to our face-check service. These providers process the image to return the result and are not permitted to use it for training under the paid API terms we use.</p>

        <h2>Children</h2>
        <p>For anyone under 18, a parent or legal guardian must give consent on the consent screen.</p>

        <h2>Your rights</h2>
        <ul>
          <li><strong>Withdraw consent and erase:</strong> tap <em>Delete my data now</em> at the bottom of any try-on screen. Everything is erased immediately.</li>
          <li><strong>Access, correction, grievance and nomination:</strong> write to <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>. We respond within the time the DPDP Rules require. If you're not satisfied, you may complain to the Data Protection Board of India.</li>
        </ul>

        <h2>About the previews</h2>
        <p>Previews are AI-generated and labelled as such. They are an illustration to help your consultation; the actual result depends on your hair and your stylist.</p>
      </main>
    </>
  );
}
