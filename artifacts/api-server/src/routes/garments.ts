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
}

// --- Helpers ---

const LABEL_TO_CATEGORY: Record<string, GarmentCategory> = {
  "t-shirt": "tops",
  tshirt: "tops",
  shirt: "tops",
  blouse: "tops",
  top: "tops",
  jersey: "tops",
  sweater: "tops",
  hoodie: "tops",
  "tank top": "tops",
  polo: "tops",
  cardigan: "tops",
  jumper: "tops",
  vest: "tops",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",
  parka: "outerwear",
  puffer: "outerwear",
  anorak: "outerwear",
  raincoat: "outerwear",
  overcoat: "outerwear",
  dress: "dresses",
  gown: "dresses",
  sundress: "dresses",
  overalls: "dresses",
  jumpsuit: "dresses",
  romper: "dresses",
  skirt: "bottoms",
  trousers: "bottoms",
  jeans: "bottoms",
  pants: "bottoms",
  shorts: "bottoms",
  leggings: "bottoms",
  chinos: "bottoms",
  joggers: "bottoms",
  "cargo pants": "bottoms",
  shoe: "shoes",
  shoes: "shoes",
  sneaker: "shoes",
  sneakers: "shoes",
  boot: "shoes",
  boots: "shoes",
  heel: "shoes",
  heels: "shoes",
  sandal: "shoes",
  sandals: "shoes",
  loafer: "shoes",
  loafers: "shoes",
  trainer: "shoes",
  trainers: "shoes",
  bag: "accessories",
  handbag: "accessories",
  scarf: "accessories",
  hat: "accessories",
  cap: "accessories",
  belt: "accessories",
  gloves: "accessories",
  sunglasses: "accessories",
  watch: "accessories",
};

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
  // Sort by pixel fraction (coverage) and pick the most prominent non-white/near-white color
  const sorted = [...colors].sort((a, b) => b.pixelFraction - a.pixelFraction);
  for (const c of sorted) {
    const { red: r = 0, green: g = 0, blue: b = 0 } = c.color;
    const name = colorName(r, g, b);
    if (name !== "White" && name !== "Light Gray") return name;
  }
  // Fall back to the dominant color even if it's white
  const { red: r = 0, green: g = 0, blue: b = 0 } = sorted[0]!.color;
  return colorName(r, g, b);
}

function classifyFromLabels(
  labels: Array<{ description: string; score: number }>,
): { category: GarmentCategory; tags: string[]; confidence: number } {
  const tags: string[] = [];
  let category: GarmentCategory = "other";
  let confidence = 0;

  for (const { description, score } of labels) {
    const lower = description.toLowerCase();

    // Check for category match
    if (category === "other" && LABEL_TO_CATEGORY[lower]) {
      category = LABEL_TO_CATEGORY[lower]!;
      confidence = score;
    }

    // Collect useful tags (clothing-related terms, exclude generic)
    const skip = ["clothing", "fashion", "wear", "apparel", "textile", "fabric"];
    if (!skip.includes(lower) && score > 0.7) {
      tags.push(description.toLowerCase());
    }
  }

  return { category, tags: tags.slice(0, 6), confidence };
}

// --- Route ---

/**
 * POST /api/garments/classify
 *
 * Classifies a garment photo using Google Cloud Vision.
 * Accepts either a public imageUrl or raw imageBase64 (without data: prefix).
 * Returns category, dominant color, tags, and confidence.
 *
 * Free tier: 1,000 units/month.
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
                { type: "LABEL_DETECTION", maxResults: 25 },
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

    const { category, tags, confidence } = classifyFromLabels(labels);
    const color = pickDominantColor(colorData);

    const result: ClassifyResult = { category, color, tags, confidence };
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Garment classification failed");
    res.status(500).json({ error: "Classification failed. Please try again." });
  }
});

export default router;
