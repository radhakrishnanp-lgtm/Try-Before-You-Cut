import type { Gender, Length, StyleArt, Texture } from "../types.ts";

/**
 * The curated global catalogue. Each prompt describes only the hair; the shared
 * identity-preservation instructions are added in lib/ai/prompt.ts.
 * Thumbnails are original line art generated from `art` (components/StyleArt).
 */
export interface CatalogueEntry {
  id: string;
  name: string;
  gender: Gender;
  length: Length;
  textures: Texture[];
  description: string;
  prompt: string;
  art: StyleArt;
}

const ALL: Texture[] = ["straight", "wavy", "curly"];

export const CATALOGUE: CatalogueEntry[] = [
  // ---------------------------------------------------------------- Men
  {
    id: "m-classic-side-part", name: "Classic Side Part", gender: "men", length: "short", textures: ["straight", "wavy"],
    description: "Neat, office-ready cut with a clean side parting.",
    prompt: "a classic short men's side part: hair 4-6 cm on top combed to one side with a crisp parting, tapered scissor-cut sides about 1.5 cm, tidy neckline, natural matte finish",
    art: { top: 0.45, sides: "short", fringe: "side" },
  },
  {
    id: "m-textured-crop", name: "Textured Crop", gender: "men", length: "short", textures: ALL,
    description: "Short choppy top pushed slightly forward, low-maintenance.",
    prompt: "a men's textured crop: 3-4 cm choppy, point-cut hair on top worn slightly forward with a short textured fringe, low fade on the sides, natural matte texture",
    art: { top: 0.4, sides: "faded", fringe: "textured" },
  },
  {
    id: "m-low-taper-fade", name: "Low Taper Fade", gender: "men", length: "short", textures: ALL,
    description: "Subtle taper at the temples and neckline, length kept on top.",
    prompt: "a men's low taper fade: hair gradually tapered from about 1 cm just above the ears and neckline down to skin at the very bottom, 4-5 cm natural length on top styled loosely back",
    art: { top: 0.45, sides: "faded", fringe: "none" },
  },
  {
    id: "m-mid-fade-quiff", name: "Mid Fade with Quiff", gender: "men", length: "short", textures: ["straight", "wavy"],
    description: "Volume at the front, sharp mid fade on the sides.",
    prompt: "a men's mid skin fade with a quiff: sides faded from skin at the temple line up to 1 cm, 6-7 cm on top blow-dried up and back at the front into a soft quiff with natural volume",
    art: { top: 0.6, sides: "faded", fringe: "none", extra: "quiff" },
  },
  {
    id: "m-crew-cut", name: "Crew Cut", gender: "men", length: "short", textures: ALL,
    description: "Short, clean and classic. Easy every day.",
    prompt: "a men's crew cut: about 2 cm on top, slightly longer at the front, sides and back clipped short to about 6 mm, clean natural hairline",
    art: { top: 0.25, sides: "short", fringe: "none" },
  },
  {
    id: "m-buzz-cut", name: "Buzz Cut", gender: "men", length: "short", textures: ALL,
    description: "Uniform clipper cut all over.",
    prompt: "a men's buzz cut: uniform clipper length of about 6 mm all over the head following the natural hairline, no styling",
    art: { top: 0.12, sides: "short", fringe: "none" },
  },
  {
    id: "m-pompadour", name: "Modern Pompadour", gender: "men", length: "short", textures: ["straight", "wavy"],
    description: "Swept-up front with height, tapered sides.",
    prompt: "a modern men's pompadour: 8-10 cm on top swept up and back with height at the front, tapered sides about 1.5 cm, light natural shine",
    art: { top: 0.75, sides: "short", fringe: "swept-back", extra: "quiff" },
  },
  {
    id: "m-slick-back-undercut", name: "Slick Back Undercut", gender: "men", length: "medium", textures: ["straight", "wavy"],
    description: "Long top combed back, short disconnected sides.",
    prompt: "a men's slick back undercut: 10-12 cm on top combed straight back with a medium-hold finish, sides and back clipped short to about 6 mm with a disconnected line",
    art: { top: 0.55, sides: "faded", fringe: "swept-back" },
  },
  {
    id: "m-curly-top-fade", name: "Curly Top Fade", gender: "men", length: "short", textures: ["curly", "wavy"],
    description: "Defined natural curls on top with a clean fade.",
    prompt: "a men's curly top with a high fade: 5-6 cm of defined natural curls on top, sides faded from skin to 1 cm, curls kept in their natural pattern",
    art: { top: 0.6, sides: "faded", fringe: "textured" },
  },
  {
    id: "m-wavy-flow", name: "Wavy Flow", gender: "men", length: "medium", textures: ["wavy", "straight"],
    description: "Relaxed, swept-back medium length that sits behind the ears.",
    prompt: "a men's medium wavy flow: 12-15 cm of hair swept back loosely, ends curling behind the ears and at the nape, soft natural waves",
    art: { top: 0.55, sides: "ear", fringe: "swept-back" },
  },
  {
    id: "m-messy-fringe", name: "Messy Fringe", gender: "men", length: "short", textures: ["straight", "wavy"],
    description: "Forward-styled textured fringe, youthful look.",
    prompt: "a men's messy fringe: 6-7 cm of textured hair brushed forward into a choppy fringe resting just above the eyebrows, tapered sides about 1.5 cm",
    art: { top: 0.5, sides: "short", fringe: "straight" },
  },
  {
    id: "m-shoulder-layers", name: "Shoulder-Length Layers", gender: "men", length: "long", textures: ["straight", "wavy"],
    description: "Long layered hair that falls around the jaw and shoulders.",
    prompt: "men's shoulder-length layered hair: layers falling from the cheekbones to the shoulders, centre or slight side parting, tucked naturally behind one ear",
    art: { top: 0.5, sides: "shoulder", fringe: "curtain" },
  },
  {
    id: "m-man-bun", name: "Man Bun", gender: "men", length: "long", textures: ALL,
    description: "Long hair tied up into a neat bun at the crown.",
    prompt: "long men's hair pulled back and tied into a neat bun at the crown, smooth sides, a few loose strands near the temples",
    art: { top: 0.4, sides: "short", fringe: "swept-back", extra: "bun" },
  },
  {
    id: "m-ivy-league", name: "Ivy League", gender: "men", length: "short", textures: ["straight"],
    description: "A slightly longer crew cut with a soft side part.",
    prompt: "a men's Ivy League cut: about 4 cm at the front tapering shorter towards the crown, light side parting, short tapered sides",
    art: { top: 0.35, sides: "short", fringe: "side" },
  },
  {
    id: "m-french-crop", name: "French Crop", gender: "men", length: "short", textures: ["straight", "wavy"],
    description: "Blunt short fringe with a skin fade.",
    prompt: "a men's French crop: 3-4 cm on top brushed forward into a short blunt fringe, high skin fade on the sides, matte textured finish",
    art: { top: 0.35, sides: "faded", fringe: "straight" },
  },
  {
    id: "m-tapered-curls", name: "Tapered Curls", gender: "men", length: "medium", textures: ["curly"],
    description: "Medium curls on top, tapered neatly at the sides.",
    prompt: "men's medium tapered curls: 8-10 cm of defined natural curls on top falling loosely forward, sides tapered short with scissors, curls kept in their natural pattern",
    art: { top: 0.7, sides: "short", fringe: "textured" },
  },
  {
    id: "m-spiky-texture", name: "Spiky Texture", gender: "men", length: "short", textures: ["straight"],
    description: "Short, piece-y spikes with a matte finish.",
    prompt: "a men's short spiky textured cut: 4-5 cm on top styled up into piece-y spikes with matte paste, short tapered sides",
    art: { top: 0.5, sides: "short", fringe: "none", extra: "hawk" },
  },
  {
    id: "m-curtains", name: "Middle Part Curtains", gender: "men", length: "medium", textures: ["straight", "wavy"],
    description: "Centre-parted curtain fringe framing the forehead.",
    prompt: "men's middle part curtain hairstyle: 10-12 cm on top parted in the centre with the fringe falling to both sides of the forehead down to the cheekbones, tapered sides",
    art: { top: 0.5, sides: "ear", fringe: "curtain" },
  },
  {
    id: "m-long-curls", name: "Long Curls", gender: "men", length: "long", textures: ["curly"],
    description: "Shoulder-grazing natural curls with shape.",
    prompt: "men's long natural curls: defined curls reaching the jaw and shoulders, shaped with layers so the volume sits evenly, curls kept in their natural pattern",
    art: { top: 0.75, sides: "shoulder", fringe: "textured" },
  },
  {
    id: "m-faux-hawk", name: "Faux Hawk", gender: "men", length: "short", textures: ALL,
    description: "Centre ridge of height with faded sides.",
    prompt: "a men's faux hawk: 6-7 cm of hair along the centre styled up into a ridge, sides faded short, clean neckline",
    art: { top: 0.6, sides: "faded", fringe: "none", extra: "hawk" },
  },

  // -------------------------------------------------------------- Women
  {
    id: "w-long-layers", name: "Long Layers", gender: "women", length: "long", textures: ALL,
    description: "Soft, long layers that add movement without losing length.",
    prompt: "women's long layered hair: chest-length hair with long soft layers starting below the chin, natural movement, healthy shine",
    art: { top: 0.45, sides: "chest", fringe: "none" },
  },
  {
    id: "w-step-cut", name: "Step Cut", gender: "women", length: "long", textures: ["straight", "wavy"],
    description: "Distinct layered steps through the length, a salon favourite.",
    prompt: "a women's step cut: long hair below the shoulders cut in distinct visible layered steps through the length, blow-dried smooth with slight bounce",
    art: { top: 0.5, sides: "chest", fringe: "side" },
  },
  {
    id: "w-u-cut", name: "U-Cut", gender: "women", length: "long", textures: ["straight", "wavy"],
    description: "Long hair with a rounded U-shaped back hemline.",
    prompt: "a women's U-cut: long straight hair below the shoulders with the back hemline shaped into a soft rounded U, light face-framing at the front",
    art: { top: 0.4, sides: "chest", fringe: "none" },
  },
  {
    id: "w-v-cut", name: "V-Cut Layers", gender: "women", length: "long", textures: ["straight"],
    description: "Long layers tapering to a V at the back.",
    prompt: "women's V-cut layers: long hair with layers tapering into a pointed V shape at the back, sleek straight blow-dry",
    art: { top: 0.4, sides: "chest", fringe: "side" },
  },
  {
    id: "w-face-framing", name: "Face-Framing Front Layers", gender: "women", length: "long", textures: ALL,
    description: "Long hair with front layers starting at the cheekbones.",
    prompt: "women's long hair with face-framing front layers that start at the cheekbones and sweep away from the face, rest of the length kept long",
    art: { top: 0.45, sides: "chest", fringe: "curtain" },
  },
  {
    id: "w-curtain-bangs", name: "Curtain Bangs", gender: "women", length: "long", textures: ["straight", "wavy"],
    description: "Soft centre-parted bangs that blend into long layers.",
    prompt: "women's long hair with soft curtain bangs: centre-parted fringe falling to the cheekbones on both sides, blending into long layers",
    art: { top: 0.45, sides: "chest", fringe: "curtain" },
  },
  {
    id: "w-butterfly", name: "Butterfly Cut", gender: "women", length: "long", textures: ["straight", "wavy"],
    description: "Voluminous short layers on top over long lengths.",
    prompt: "a women's butterfly cut: shorter voluminous layers around the face and crown over long lengths, blow-dried with bouncy curled-under ends",
    art: { top: 0.6, sides: "chest", fringe: "curtain" },
  },
  {
    id: "w-feathered", name: "Feathered Layers", gender: "women", length: "long", textures: ["straight"],
    description: "Light, feathery layers flicked away from the face.",
    prompt: "women's feathered layers: long hair with light wispy layers flicked outward away from the face, airy blow-dried finish",
    art: { top: 0.5, sides: "shoulder", fringe: "side" },
  },
  {
    id: "w-side-swept-bangs", name: "Side-Swept Bangs", gender: "women", length: "long", textures: ["straight", "wavy"],
    description: "A long fringe swept across the forehead to one side.",
    prompt: "women's long hair with side-swept bangs: a long fringe swept across the forehead to one side, ending near the cheekbone, smooth lengths",
    art: { top: 0.45, sides: "chest", fringe: "side" },
  },
  {
    id: "w-long-waves", name: "Middle Part Waves", gender: "women", length: "long", textures: ["wavy"],
    description: "Centre parting with soft, loose long waves.",
    prompt: "women's long hair with a centre parting and soft loose waves from the cheekbones down, natural undone texture",
    art: { top: 0.45, sides: "chest", fringe: "none" },
  },
  {
    id: "w-long-curls", name: "Layered Long Curls", gender: "women", length: "long", textures: ["curly"],
    description: "Shaped curls with layers so the volume sits evenly.",
    prompt: "women's long layered curls: defined natural curls below the shoulders, cut in layers so the volume is balanced, curls kept in their natural pattern",
    art: { top: 0.75, sides: "chest", fringe: "textured" },
  },
  {
    id: "w-lob", name: "Lob (Long Bob)", gender: "women", length: "medium", textures: ["straight", "wavy"],
    description: "A collarbone-length bob, polished or tousled.",
    prompt: "a women's lob: a long bob ending at the collarbone, slightly longer at the front, soft side parting, smooth with a slight bend",
    art: { top: 0.45, sides: "shoulder", fringe: "side" },
  },
  {
    id: "w-shag", name: "Modern Shag", gender: "women", length: "medium", textures: ["wavy", "curly"],
    description: "Choppy layers and a soft fringe with lots of texture.",
    prompt: "a women's modern shag: shoulder-length hair with choppy, piece-y layers through the crown, a soft wispy fringe and plenty of texture",
    art: { top: 0.65, sides: "shoulder", fringe: "textured" },
  },
  {
    id: "w-wolf-cut", name: "Wolf Cut", gender: "women", length: "medium", textures: ["wavy", "curly"],
    description: "Volume on top, wispy lengths. Edgy but wearable.",
    prompt: "a women's wolf cut: voluminous short layers on the crown, wispy thinner lengths past the shoulders, curtain fringe, tousled texture",
    art: { top: 0.7, sides: "shoulder", fringe: "curtain" },
  },
  {
    id: "w-shoulder-cut", name: "Textured Shoulder Cut", gender: "women", length: "medium", textures: ALL,
    description: "Blunt shoulder-length cut with light texture.",
    prompt: "a women's shoulder-length cut: hair ending just on the shoulders with a mostly blunt hemline and light internal texture, natural parting",
    art: { top: 0.45, sides: "shoulder", fringe: "none" },
  },
  {
    id: "w-curly-layers", name: "Defined Curly Layers", gender: "women", length: "medium", textures: ["curly"],
    description: "Rounded curly shape at shoulder length.",
    prompt: "women's shoulder-length defined curly layers: natural curls cut into a rounded shape with volume at the crown, curls kept in their natural pattern",
    art: { top: 0.8, sides: "shoulder", fringe: "textured" },
  },
  {
    id: "w-classic-bob", name: "Classic Bob", gender: "women", length: "short", textures: ["straight"],
    description: "Sleek chin-length bob with a crisp line.",
    prompt: "a women's classic bob: sleek straight hair cut to a crisp blunt line at the chin, side parting, smooth polished finish",
    art: { top: 0.4, sides: "jaw", fringe: "none" },
  },
  {
    id: "w-french-bob", name: "French Bob with Bangs", gender: "women", length: "short", textures: ["straight", "wavy"],
    description: "Jaw-length bob with a short, soft fringe.",
    prompt: "a women's French bob: jaw-length bob with soft texture and a short eyebrow-length fringe, effortlessly tousled",
    art: { top: 0.45, sides: "jaw", fringe: "straight" },
  },
  {
    id: "w-curly-bob", name: "Curly Bob", gender: "women", length: "short", textures: ["curly"],
    description: "Chin-length curls with rounded volume.",
    prompt: "a women's curly bob: chin-length natural curls cut into a rounded shape with even volume, curls kept in their natural pattern",
    art: { top: 0.75, sides: "jaw", fringe: "textured" },
  },
  {
    id: "w-pixie", name: "Pixie Cut", gender: "women", length: "short", textures: ["straight", "wavy"],
    description: "Cropped and chic with a soft side fringe.",
    prompt: "a women's pixie cut: very short cropped hair at the back and sides, slightly longer textured top with a soft side-swept fringe",
    art: { top: 0.35, sides: "short", fringe: "side" },
  },
];

export function catalogueById(id: string): CatalogueEntry | undefined {
  return CATALOGUE.find((s) => s.id === id);
}
