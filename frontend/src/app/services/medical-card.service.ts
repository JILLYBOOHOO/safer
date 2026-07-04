import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { MedicalCard } from '../models/medical-card.model';

/**
 * Service to handle encrypted storage of the user's medical card data.
 * Uses AES encryption with a static secret (replace with secure secret in prod).
 */
@Injectable({
  providedIn: 'root'
})
export class MedicalCardService {
  private readonly storageKey = 'safer_medical_card';

  /** Store a medical card object securely. */
  saveCard(card: MedicalCard): void {
    const json = JSON.stringify(card);
    const encrypted = CryptoJS.AES.encrypt(json, this.getSecret()).toString();
    localStorage.setItem(this.storageKey, encrypted);
  }

  /** Retrieve and decrypt the stored medical card, or null if none. */
  getCard(): MedicalCard | null {
    const encrypted = localStorage.getItem(this.storageKey);
    if (!encrypted) { return null; }
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, this.getSecret());
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted) as MedicalCard;
    } catch (e) {
      console.error('Failed to decrypt medical card:', e);
      return null;
    }
  }

  /** Clear stored medical card data. */
  clearCard(): void {
    localStorage.removeItem(this.storageKey);
  }

  private getSecret(): string {
    // In a real app, derive this from a user‑specific key or fetch from backend.
    return 'medical_card_secret_!@#123';
  }
}
