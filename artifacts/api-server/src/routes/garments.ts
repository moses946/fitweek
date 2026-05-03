import { Router } from "express";

const router = Router();

// --- Types ---

type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "other";

interface ClassifyResult {
  category: GarmentCategory;
  color: string;
  tags: string[];
  confidence: number;
  /** The specific Vision label that matched the category, e.g. "T-shirt", "Blazer" */
  matchedLabel: string | null;
}

// --- Helpers ---

/**
 * Exact-match lookup for Vision label → garment category.
 * The classifier also does word-by-word partial matching as a fallback.
 */
const LABEL_TO_CATEGORY: Record<string, GarmentCategory> = {
  // Tops
  "t-shirt": "tops", tshirt: "tops", "t shirt": "tops", shirt: "tops",
  blouse: "tops", top: "tops", jersey: "tops", sweater: "tops",
  hoodie: "tops", "tank top": "tops", "tank tops": "tops", polo: "tops",
  cardigan: "tops", jumper: "tops", vest: "tops", sweatshirt: "tops",
  turtleneck: "tops", "crew neck": "tops", crewneck: "tops",
  "long sleeve": "tops", "long-sleeve": "tops", "short sleeve": "tops",
  "polo shirt": "tops", "dress shirt": "tops", "casual shirt": "tops",
  "button down": "tops", "button-down": "tops", flannel: "tops",
  henley: "tops", camisole: "tops", crop: "tops", "crop top": "tops",
  bralette: "tops", tube: "tops", halter: "tops",

  // Outerwear
  jacket: "outerwear", coat: "outerwear", blazer: "outerwear",
  parka: "outerwear", puffer: "outerwear", anorak: "outerwear",
  raincoat: "outerwear", overcoat: "outerwear", windbreaker: "outerwear",
  trench: "outerwear", "trench coat": "outerwear", "sport coat": "outerwear",
  "sports coat": "outerwear", "track jacket": "outerwear", fleece: "outerwear",
  "leather jacket": "outerwear", denim: "outerwear",

  // Dresses
  dress: "dresses", gown: "dresses", sundress: "dresses",
  overalls: "dresses", jumpsuit: "dresses", romper: "dresses",
  "maxi dress": "dresses", "midi dress": "dresses", "mini dress": "dresses",
  "bodycon": "dresses", "wrap dress": "dresses",

  // Bottoms
  skirt: "bottoms", trousers: "bottoms", jeans: "bottoms",
  pants: "bottoms", shorts: "bottoms", leggings: "bottoms",
  chinos: "bottoms", joggers: "bottoms", "cargo pants": "bottoms",
  sweatpants: "bottoms", "track pants": "bottoms", culottes: "bottoms",
  slacks: "bottoms", khakis: "bottoms", "athletic shorts": "bottoms",
  "board shorts": "bottoms", "bike shorts": "bottoms",
  "dress pants": "bottoms", "skinny jeans": "bottoms",

  // Shoes
  shoe: "shoes", shoes: "shoes", sneaker: "shoes", sneakers: "shoes",
  boot: "shoes", boots: "shoes", heel: "shoes", heels: "shoes",
  sandal: "shoes", sandals: "shoes", loafer: "shoes", loafers: "shoes",
  trainer: "shoes", trainers: "shoes", "running shoes": "shoes",
  "running shoe": "shoes", "athletic shoes": "shoes", "high heels": "shoes",
  "ankle boots": "shoes", "knee-high boots": "shoes", mule: "shoes",
  mules: "shoes", "flat shoes": "shoes", pump: "shoes", pumps: "shoes",
  slipper: "shoes", slippers: "shoes", clog: "shoes", clogs: "shoes",
  oxford: "shoes", oxfords: "shoes", derby: "shoes",

  // Accessories
  bag: "accessories", handbag: "accessories", scarf: "accessories",
  hat: "accessories", cap: "accessories", belt: "accessories",
  gloves: "accessories", sunglasses: "accessories", watch: "accessories",
  backpack: "accessories", "tote bag": "accessories", purse: "accessories",
  wallet: "accessories", necklace: "accessories", bracelet: "accessories",
  earrings: "accessories", ring: "accessories", tie: "accessories",
  "bow tie": "accessories", beanie: "accessories", beret: "accessories",
  visor: "accessories",
};

/**
 * Attempt to match a single Vision label to a garment category.
 * Strategy (in order):
 *   1. Exact lowercase match
 *   2. Word-by-word match (e.g. "Active Shirt" → word "shirt" → tops)
 *   3. Substring match on short well-known keywords
 */
function matchLabelToCategory(
  description: string,
): { category: GarmentCategory; matchedLabel: string } | null {
  const lower = description.toLowerCase();

  // 1. Exact match
  if (LABEL_TO_CATEGORY[lower]) {
    return {
      category: LABEL_TO_CATEGORY[lower]!,
      matchedLabel: description.replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }

  // 2. Word-by-word: split label into individual words and check each
  const words = lower.split(/[\s\-_/]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    if (LABEL_TO_CATEGORY[word]) {
      return {
        category: LABEL_TO_CATEGORY[word]!,
        matchedLabel: description.replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    }
  }

  // 3. Substring match: check if the label *contains* a known keyword
  //    Only for unambiguous, longer keywords (≥5 chars) to avoid false positives
  for (const [key, cat] of Object.entries(LABEL_TO_CATEGORY)) {
    if (key.length >= 5 && lower.includes(key)) {
      return {
        category: cat,
        matchedLabel: description.replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    }
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function colorName(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l > 88) return "White";
  if (l < 12) return "Black";
  if (s < 12) {
    if (l < 35) return "Charcoal";
    if (l < 65) return "Gray";
    return "Light Gray";
  }
  if (h < 20 || h >= 345) return l < 35 ? "Burgundy" : "Red";
  if (h < 40) return "Orange";
  if (h < 65) return s > 55 ? "Yellow" : "Khaki";
  if (h < 80) return "Olive";
  if (h < 155) return l < 30 ? "Forest Green" : "Green";
  if (h < 195) return "Teal";
  if (h < 225) return "Cyan";
  if (h < 260) return l < 28 ? "Navy" : l < 55 ? "Blue" : "Light Blue";
  if (h < 290) return "Purple";
  if (h < 340) return l > 65 ? "Pink" : "Magenta";
  return "Red";
}

function pickDominantColor(
  colors: Array<{ color: { red: number; green: number; blue: number }; pixelFraction: number }>,
): string {
  if (!colors.length) return "Unknown";
  const sorted = [...colors].sort((a, b) => b.pixelFraction - a.pixelFraction);
  for (const c of sorted) {
    const { red: r = 0, green: g = 0, blue: b = 0 } = c.color;
    const name = colorName(r, g, b);
    if (name !== "White" && name !== "Light Gray") return name;
  }
  const { red: r = 0, green: g = 0, blue: b = 0 } = sorted[0]!.color;
  return colorName(r, g, b);
}

function classifyFromLabels(
  labels: Array<{ description: string; score: number }>,
): { category: GarmentCategory; tags: string[]; confidence: number; matchedLabel: string | null } {
  const tags: string[] = [];
  let category: GarmentCategory = "other";
  let confidence = 0;
  let matchedLabel: string | null = null;

  for (const { description, score } of labels) {
    const lower = description.toLowerCase();

    // Try to match this label to a category
    if (category === "other") {
      const match = matchLabelToCategory(description);
      if (match) {
        category = match.category;
        confidence = score;
        matchedLabel = match.matchedLabel;
      }
    }

    // Collect useful tags (clothing-related terms, exclude generic noise)
    const skip = new Set([
      "clothing", "fashion", "wear", "apparel", "textile", "fabric",
      "sleeve", "collar", "pattern", "textile", "material", "active shirt",
    ]);
    if (!skip.has(lower) && score > 0.7) {
      tags.push(description.toLowerCase());
    }
  }

  return { category, tags: tags.slice(0, 6), confidence, matchedLabel };
}

// --- Route ---

/**
 * POST /api/garments/classify
 *
 * Classifies a garment photo using Google Cloud Vision.
 * Accepts either a public imageUrl or raw imageBase64 (without data: prefix).
 * Returns category, dominant color, tags, and confidence.
 */
router.post("/garments/classify", async (req, res) => {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    res.status(503).json({
      error: "Google Cloud Vision API key is not configured.",
      code: "VISION_NOT_CONFIGURED",
    });
    return;
  }

  const { imageBase64, imageUrl } = req.body as {
    imageBase64?: string;
    imageUrl?: string;
  };

  if (!imageBase64 && !imageUrl) {
    res.status(400).json({ error: "Provide imageBase64 or imageUrl." });
    return;
  }

  const imageSource = imageUrl
    ? { source: { imageUri: imageUrl } }
    : { content: imageBase64 };

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: imageSource,
              features: [
                { type: "LABEL_DETECTION", maxResults: 30 },
                { type: "IMAGE_PROPERTIES" },
              ],
            },
          ],
        }),
      },
    );

    if (!visionRes.ok) {
      const err = await visionRes.text();
      req.log.error({ status: visionRes.status, err }, "Vision API error");
      res.status(502).json({ error: "Vision API request failed.", detail: err });
      return;
    }

    const visionData = (await visionRes.json()) as {
      responses: Array<{
        labelAnnotations?: Array<{ description: string; score: number }>;
        imagePropertiesAnnotation?: {
          dominantColors: {
            colors: Array<{
              color: { red: number; green: number; blue: number };
              pixelFraction: number;
            }>;
          };
        };
      }>;
    };

    const response = visionData.responses[0];
    if (!response) {
      res.status(502).json({ error: "Empty response from Vision API." });
      return;
    }

    const labels = response.labelAnnotations ?? [];
    const colorData =
      response.imagePropertiesAnnotation?.dominantColors?.colors ?? [];

    const { category, tags, confidence, matchedLabel } = classifyFromLabels(labels);
    const color = pickDominantColor(colorData);

    req.log.info(
      { category, color, confidence, matchedLabel, labelCount: labels.length },
      "Garment classified",
    );

    const result: ClassifyResult = { category, color, tags, confidence, matchedLabel };
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Garment classification failed");
    res.status(500).json({ error: "Classification failed. Please try again." });
  }
});

export default router;
