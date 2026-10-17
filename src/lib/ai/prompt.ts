/**
 * Prompt construction for hairstyle edits. The guardrails here are the main
 * defence against identity drift; the embedding check in lib/identity is the
 * second line.
 */

export const GUARDRAILS = [
  "Edit ONLY the hair. This is a realistic salon consultation preview of the same real person.",
  "Keep the person's face exactly the same: identity, face shape, jawline, eyes, nose, lips, eyebrows, facial hair, skin tone, skin texture, age, expression and head pose must not change.",
  "Do not lighten, darken, smooth or retouch the skin. Do not add makeup, jewellery or accessories.",
  "Keep the clothing, background, lighting, camera angle, framing and image size unchanged.",
  "Keep the person's natural hair colour unless the style explicitly says otherwise.",
  "The new hair must look like real hair photographed in the same light: correct hairline, natural density, realistic strands, believable shadows where hair meets the forehead, ears and neck.",
  "Respect the person's natural hair texture and density; a stylist must be able to achieve this cut on this person's hair.",
  "Photorealistic. No illustration, no filters, no text, no watermark.",
].join(" ");

export interface PromptInput {
  stylePrompt: string;
  texture?: string | null;
  strict?: boolean; // used on the identity retry
}

export function buildHairPrompt({ stylePrompt, texture, strict }: PromptInput): string {
  const parts = [
    `Change this person's hairstyle to ${stylePrompt}.`,
    texture ? `Their natural hair texture is ${texture}; render the cut in that texture.` : "",
    GUARDRAILS,
    strict
      ? "IMPORTANT: a previous attempt changed the face. This time leave every pixel of the face, skin and background untouched and change only the hair region."
      : "",
  ];
  return parts.filter(Boolean).join(" ");
}
