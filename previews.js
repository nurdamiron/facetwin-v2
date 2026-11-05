// Feature 2: face and hair changes. One instruction per change, sent with the photo to an AI image editor,
// then shown on the 3D twin. The same texts are in PROMPTS.md for testing by hand in Google AI Studio.

export const BASE = (change) =>
  `Edit this photo of a real person. Change ONLY the following: ${change}. ` +
  `Keep everything else exactly the same: the same person and identity, identical face shape, eyes, nose, lips, ` +
  `skin tone, freckles, moles, expression, age, body, pose, camera angle, lighting, background, clothing and framing. ` +
  `Do not change ethnicity, age, weight or facial proportions. Photorealistic, natural, like a real photo taken a moment later, no beauty filter. ` +
  `Any new hair must look real: individual strands, natural density, growing from the skin or scalp, with correct shadows and lighting.`;

// Glow: natural retouch. Separate base text because the look base above forbids changing skin details.
export const BASE_RETOUCH = (change) =>
  `Retouch this photo of a real person like a skilled professional photo editor. Change ONLY the following: ${change}. ` +
  `Keep everything else exactly the same: the same person and identity, face shape, eyes, nose, lips, expression, age, ` +
  `hairstyle, hair color, body, pose, camera angle, background, clothing, framing and lighting. ` +
  `Keep real skin texture: visible pores and fine skin detail. No plastic or airbrushed skin, no beauty-filter look. ` +
  `Do not slim the face or change facial proportions. Photorealistic and natural, like a real photo taken a moment later.`;

export const GROUPS = ["Glow", "Hair color", "Hairstyle", "Braids", "Brows", "Beard & mustache", "Your idea"];

export const PREVIEWS = [
  // glow: natural retouch (the V2 editor). retouch:true switches the prompt base.
  { id: "onetap", group: "Glow", retouch: true, name: "One-tap natural", icon: "onetap",
    change: "do one natural, all-round retouch: clear small blemishes and red spots, soften under-eye bags and dark circles a little, even out the skin tone, and brighten the teeth by one shade if they are visible; keep it subtle and realistic" },
  { id: "clearskin", group: "Glow", retouch: true, name: "Acne & spots", icon: "clearskin",
    change: "remove acne, blemishes, red spots and small scars so the skin looks clear and even; keep natural skin texture, visible pores, freckles and moles; do not blur or smooth the skin" },
  { id: "undereye", group: "Glow", retouch: true, name: "Under-eye bags", icon: "undereye",
    change: "reduce the under-eye bags and dark circles so the person looks rested: gently lighten the area under the eyes and soften the puffiness; keep the same eye shape and natural skin texture" },
  { id: "wrinkles", group: "Glow", retouch: true, name: "Wrinkles", icon: "wrinkles",
    change: "soften the forehead lines, the lines between the eyebrows and the smile lines around the nose and mouth by about half; keep a natural, age-appropriate look and real skin texture, no plastic skin" },
  { id: "teeth", group: "Glow", retouch: true, name: "Teeth whitening", icon: "teeth",
    change: "whiten the teeth by two to three shades to a natural off-white, removing the yellow tint; keep each tooth's shape, gaps and realistic shading; if the teeth are not visible leave the photo unchanged" },
  { id: "frecklesOn", group: "Glow", retouch: true, name: "Freckles on", icon: "frecklesOn",
    change: "add light, natural freckles across the nose and cheeks that match the skin tone, randomly spread with realistic variation in size and density; keep everything else on the skin unchanged" },
  { id: "frecklesOff", group: "Glow", retouch: true, name: "Freckles off", icon: "frecklesOff",
    change: "remove the freckles and even out the skin tone while keeping natural skin texture and pores; keep moles" },
  { id: "glow", group: "Glow", retouch: true, name: "Glow", icon: "glow",
    change: "give the skin a soft studio-light glow: a slightly warmer, healthier tone and a subtle natural highlight on the cheekbones, nose bridge and forehead; keep real skin texture and the same light direction" },
  // hair color
  { id: "copper", group: "Hair color", name: "Copper", icon: "droplet", pick: true,
    change: "the hair color to a natural copper red with realistic shine, subtle darker roots and natural strand-level variation; keep the exact same haircut, length and hairstyle" },
  { id: "honey", group: "Hair color", name: "Honey balayage", icon: "droplet",
    change: "the hair color to a soft honey-blonde balayage: darker roots blending into lighter golden ends, realistic strands and shine; keep the exact same haircut, length and hairstyle" },
  { id: "espresso", group: "Hair color", name: "Espresso brown", icon: "droplet",
    change: "the hair color to a rich, glossy espresso brown with realistic shine; keep the exact same haircut, length and hairstyle" },
  { id: "platinum", group: "Hair color", name: "Platinum", icon: "droplet",
    change: "the hair color to a cool platinum blonde with slightly darker roots and realistic shine; keep the exact same haircut, length and hairstyle" },
  { id: "jet", group: "Hair color", name: "Jet black", icon: "droplet",
    change: "the hair color to a natural glossy jet black; keep the exact same haircut, length and hairstyle" },
  // hairstyle
  { id: "bangs", group: "Hairstyle", name: "Curtain bangs", icon: "scissors", pick: true,
    change: "add soft, natural curtain bangs parted in the middle that fall around the forehead and temples; keep the hair color and the rest of the haircut the same" },
  { id: "bob", group: "Hairstyle", name: "Chin-length bob", icon: "scissors", pick: true,
    change: "cut the hair into a soft, natural chin-length bob with slight movement; keep the same hair color" },
  { id: "long", group: "Hairstyle", name: "Long layers", icon: "hairdryer",
    change: "make the hair long, reaching below the shoulders, with soft face-framing layers and natural movement; keep the same hair color" },
  { id: "curls", group: "Hairstyle", name: "Curly", icon: "wave",
    change: "give the hair natural, defined medium curls with volume; keep the same hair color and roughly the same length" },
  { id: "pixie", group: "Hairstyle", name: "Short crop", icon: "scissors",
    change: "cut the hair into a short, textured crop: short on the sides and back, a little longer and tousled on top; keep the same hair color" },
  { id: "buzz", group: "Hairstyle", name: "Buzz cut", icon: "barber",
    change: "cut the hair into a very short, even buzz cut with a natural hairline and visible scalp shading; keep the same hair color" },
  { id: "slick", group: "Hairstyle", name: "Slicked back", icon: "barber",
    change: "style the hair slicked back away from the face with a light natural shine; keep the same hair color and length" },
  // braids
  { id: "braid", group: "Braids", name: "One long braid", icon: "braid", pick: true,
    change: "style the hair into one classic three-strand braid that comes over one shoulder, with realistic woven strands and a few loose face-framing strands; keep the same hair color" },
  { id: "dutch", group: "Braids", name: "Two Dutch braids", icon: "braid",
    change: "style the hair into two tight Dutch (boxer) braids running from the hairline back along each side of the head, with realistic woven strands; keep the same hair color" },
  { id: "crown", group: "Braids", name: "Crown braid", icon: "crown",
    change: "style the hair into a braided crown that wraps around the head like a headband, with realistic woven strands and a few soft loose strands; keep the same hair color" },
  { id: "boxbraids", group: "Braids", name: "Box braids", icon: "layers",
    change: "style the hair into long, neat box braids with clean square parts, falling past the shoulders; keep the same hair color" },
  // brows
  { id: "brows", group: "Brows", name: "Fuller brows", icon: "brush", pick: true,
    change: "make the eyebrows slightly fuller and more defined with natural hair-like strokes, the same color family and the same natural arch; nothing dramatic" },
  { id: "straight", group: "Brows", name: "Straight brows", icon: "pencil",
    change: "reshape the eyebrows into soft, straight brows with a very gentle arch, natural hair-like strokes and the same color" },
  { id: "arched", group: "Brows", name: "Lifted arch", icon: "pencil",
    change: "reshape the eyebrows with a clean, lifted arch, groomed and natural-looking, with hair-like strokes and the same color" },
  { id: "bold", group: "Brows", name: "Bold brows", icon: "brush",
    change: "make the eyebrows thick, bold and brushed up, with realistic individual hairs and the same color; keep the natural shape" },
  // beard & mustache
  { id: "mustache", group: "Beard & mustache", name: "Mustache", icon: "man", pick: true,
    change: "add a natural, neatly groomed mustache above the upper lip, matching the person's hair color, with realistic individual hairs that grow from the skin; do not cover the lips" },
  { id: "stubble", group: "Beard & mustache", name: "Stubble", icon: "man",
    change: "add short, even 3-day stubble on the cheeks, jaw, chin and upper lip, matching the person's hair color, with a natural shadow and realistic tiny hairs" },
  { id: "beard", group: "Beard & mustache", name: "Short beard", icon: "man", pick: true,
    change: "add a short, well-groomed full beard with mustache along the jaw, chin and cheeks, matching the person's hair color, with a clean cheek line and realistic hair density" },
  { id: "fullbeard", group: "Beard & mustache", name: "Full beard", icon: "man",
    change: "add a thick, full beard about 3 cm long with a mustache, matching the person's hair color, well shaped, with realistic hair texture and density" },
  { id: "goatee", group: "Beard & mustache", name: "Goatee", icon: "man",
    change: "add a neat goatee (mustache connected to a beard on the chin only), matching the person's hair color, with clean shaved cheeks and realistic hairs" },
  { id: "shaven", group: "Beard & mustache", name: "Clean-shaven", icon: "user",
    change: "remove all facial hair (beard, mustache and stubble) to show clean-shaven, natural skin with realistic texture and a slight shave shadow" },
  // free text
  { id: "custom", group: "Your idea", name: "Your idea", icon: "pencil", change: "" },
];

export const previewById = (id) => PREVIEWS.find((p) => p.id === id);
// text: her own words, only for the "Your idea" option.
export const promptFor = (id, text = "") => {
  const p = previewById(id);
  return (p && p.retouch ? BASE_RETOUCH : BASE)(id === "custom" ? cleanIdea(text) : p.change);
};
export const cleanIdea = (t) => String(t || "").replace(/[\r\n]+/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 200);
