import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

/**
 * DecoyService handles the 4‑digit decoy code logic.
 * It provides methods to store a hashed code locally (encrypted) and
 * verify user input against the stored hash. In a real implementation
 * the hash would also be sent to a backend for server‑side verification.
 */
@Injectable({
  providedIn: 'root'
})
export class DecoyService {
  private readonly storageKey = 'decoy_code_encrypted';

  /**
   * Store a plaintext 4‑digit code securely.
   * The code is hashed with SHA‑256 and then encrypted using AES.
   */
  setCode(code: string): void {
    const hash = CryptoJS.SHA256(code).toString();
    const encrypted = CryptoJS.AES.encrypt(hash, this.getSecret()).toString();
    localStorage.setItem(this.storageKey, encrypted);
  }

  /**
   * Verify a supplied code against the stored hash.
   * Returns true if the code matches, false otherwise.
   */
  verifyCode(code: string): boolean {
    const encrypted = localStorage.getItem(this.storageKey);
    if (!encrypted) { return false; }
    const decrypted = CryptoJS.AES.decrypt(encrypted, this.getSecret()).toString(CryptoJS.enc.Utf8);
    const hash = CryptoJS.SHA256(code).toString();
    return hash === decrypted;
  }

  /**
   * Generate a secret key for AES encryption. In production this should be
   * derived from a user‑specific secret or fetched securely from the backend.
   */
  private getSecret(): string {
    // Simple static secret for demo purposes – replace with a proper secret.
    return 'decoy_secret_key_123!@#';
  }
}
