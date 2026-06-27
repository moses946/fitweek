import { Garment, GarmentCategory } from "./types";
import {
  markWorn,
  sendToLaundry,
  markWashed,
  skipForSession,
  skipForWeek,
  softDelete,
  restore,
  purge,
} from "./garmentStatus";

// ── Repository + Classifier adapters ──────────────────────────────────────────

export interface GarmentRepository {
  getGarments(): Promise<Garment[]>;
  saveGarment(g: Garment): Promise<void>;
  saveGarments(g: Garment[]): Promise<void>;
  deleteGarment(id: string): Promise<void>;
}

export interface ClassifierAdapter {
  classifyImage(uri: string): Promise<{ category: GarmentCategory; description: string }>;
}

// ── Action types ───────────────────────────────────────────────────────────────

export type ActionType =
  | "skipSession"
  | "skipWeek"
  | "markWorn"
  | "sendToLaundry"
  | "markWashed"
  | "softDelete"
  | "restore"
  | "purge";

// ── SuggestionEngine (garment lifecycle + classification) ─────────────────────

/**
 * Garment domain facade. Outfit recommendations are computed server-side
 * via POST /api/outfit/suggest and POST /api/outfit/deck.
 */
export class SuggestionEngine {
  constructor(
    private repository: GarmentRepository,
    private classifier: ClassifierAdapter,
  ) {}

  async applyAction(garmentId: string, action: ActionType, today?: Date): Promise<void> {
    const garments = await this.repository.getGarments();
    let next: Garment[];

    switch (action) {
      case "markWorn":      next = markWorn(garments, garmentId); break;
      case "sendToLaundry": next = sendToLaundry(garments, garmentId); break;
      case "markWashed":    next = markWashed(garments, garmentId); break;
      case "skipSession":   next = skipForSession(garments, garmentId, today?.toISOString().split("T")[0]); break;
      case "skipWeek":      next = skipForWeek(garments, garmentId, today); break;
      case "softDelete":    next = softDelete(garments, garmentId); break;
      case "restore":       next = restore(garments, garmentId); break;
      case "purge":         next = purge(garments, garmentId); break;
      default:              return;
    }

    if (action === "purge") {
      await this.repository.deleteGarment(garmentId);
    } else {
      const updated = next.find((g) => g.id === garmentId);
      if (updated) await this.repository.saveGarment(updated);
    }
  }

  async classifyImage(uri: string) {
    return this.classifier.classifyImage(uri);
  }
}
