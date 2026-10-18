import { grievanceEmail } from "./legal";
import type { Salon, Style } from "./types";

/** Fields of a salon that are safe to send to any browser. */
export function publicSalon(s: Salon) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl,
    accentColor: s.accentColor,
    bookingUrl: s.bookingUrl,
    whatsappNumber: s.whatsappNumber,
    city: s.city,
    grievanceEmail: grievanceEmail(),
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
