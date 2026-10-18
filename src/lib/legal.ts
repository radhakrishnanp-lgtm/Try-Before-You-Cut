import { CONSENT_VERSION, RETENTION_HOURS } from "./config";

/** Read at request time (not build time) so the Docker image picks it up from .env. */
export function grievanceEmail(): string {
  return process.env.GRIEVANCE_EMAIL || "privacy@example.com";
}

export { AI_DISCLAIMER } from "./copy";

/** Points of the DPDP notice shown before capture. Hash of the full text is logged with consent. */
export function consentPoints(salonName: string, contact: string): { title: string; body: string }[] {
  return [
    { title: "What we use", body: `One photo of your face and hair, taken or uploaded by you or ${salonName}'s stylist.` },
    { title: "Why", body: "Only to create hairstyle previews for your consultation and to let you download or share them. Nothing else." },
    { title: "How long", body: `Your photo and previews are deleted automatically after ${RETENTION_HOURS} hours. You can delete them sooner at any time.` },
    { title: "Never", body: "Your photo is never sold, never used to train AI, never shown publicly and never used for face-swaps." },
    { title: "Who processes it", body: `${salonName} (your salon) and Try-Before-You-Cut, which runs this tool. The image is edited by Magnific (Freepik) and checked by an AI vision model, under terms that do not allow training; their copies are deleted with yours.` },
    { title: "Your rights", body: `Withdraw consent and erase your data with "Delete my data" at any time. Questions or grievances: ${contact}.` },
  ];
}

export function consentText(salonName: string): string {
  return [`Consent notice ${CONSENT_VERSION}`, ...consentPoints(salonName, grievanceEmail()).map((p) => `${p.title}: ${p.body}`)].join("\n");
}
