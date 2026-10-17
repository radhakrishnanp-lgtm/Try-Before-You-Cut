import { PLANS, type Salon, type Style } from "./types";

/** Fields of a salon that are safe to send to any browser. */
export function publicSalon(s: Salon) {
  const branding = PLANS[s.plan].branding;
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoUrl: branding ? s.logoUrl : null,
    accentColor: branding ? s.accentColor : "#b08d57",
    bookingUrl: s.bookingUrl,
    whatsappNumber: s.whatsappNumber,
    city: s.city,
  };
}
export type PublicSalon = ReturnType<typeof publicSalon>;

/** Style without its generation prompt. */
export function publicStyle(s: Style) {
  return {
    id: s.id,
    name: s.name,
    gender: s.gender,
    length: s.length,
    textures: s.textures,
    description: s.description,
    art: s.art,
    referenceImageUrl: s.referenceImageUrl,
    custom: s.salonId !== null,
  };
}
export type PublicStyle = ReturnType<typeof publicStyle>;
