import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'safer_theme';
  private currentTheme: Theme = 'light';

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.initTheme();
  }

  /** Initialize theme from localStorage or default */
  private initTheme(): void {
    const saved = localStorage.getItem(this.storageKey) as Theme | null;
    if (saved) {
      this.setTheme(saved, false);
    } else {
      this.applyTheme(this.currentTheme);
    }
  }

  /** Get current theme */
  getTheme(): Theme {
    return this.currentTheme;
  }

  /** Set theme and optionally persist */
  setTheme(theme: Theme, persist: boolean = true): void {
    this.currentTheme = theme;
    this.applyTheme(theme);
    if (persist) {
      localStorage.setItem(this.storageKey, theme);
    }
  }

  /** Apply theme by toggling body class */
  private applyTheme(theme: Theme): void {
    const body = this.document.body;
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  }
}
