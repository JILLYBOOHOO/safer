import { Component, OnInit } from '@angular/core';
import { SecurityService } from '../../services/security.service';
import { AlertService } from '../../services/alert.service';

interface SavedLocation {
  name: string;
  label: string;
  lat: number | null;
  lng: number | null;
  address: string;
  savedAt: string;
}

@Component({
  selector: 'app-location-manager',
  template: `
    <main class="location-page">
      <header class="loc-header glass-panel">
        <div>
          <h1>📍 <span class="text-gradient">Location Profiles</span></h1>
          <p class="text-secondary">Save frequently visited locations for one-tap safe zone configuration.</p>
        </div>
      </header>

      <!-- Quick Add -->
      <section class="quick-add glass-panel">
        <h2>➕ Add New Location</h2>
        <div class="add-form">
          <div class="form-row">
            <div class="form-group">
              <label for="loc-name">Location Name</label>
              <input id="loc-name" type="text" class="input-accessible" [(ngModel)]="newName" placeholder="e.g. Home, Work, School" />
            </div>
            <div class="form-group">
              <label for="loc-category">Category</label>
              <select id="loc-category" class="input-accessible" [(ngModel)]="newLabel">
                <option value="home">🏠 Home</option>
                <option value="work">🏢 Work</option>
                <option value="school">🏫 School</option>
                <option value="gym">🏋️ Gym</option>
                <option value="restaurant">🍽️ Favorite Restaurant</option>
                <option value="family">👨‍👩‍👧 Family Member</option>
                <option value="church">⛪ Church</option>
                <option value="hospital">🏥 Hospital</option>
                <option value="other">📌 Other</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="loc-address">Address (optional)</label>
            <input id="loc-address" type="text" class="input-accessible" [(ngModel)]="newAddress" placeholder="e.g. 12 Mango Lane, Kingston" />
          </div>
          <div class="gps-row">
            <div class="gps-display" *ngIf="newLat !== null">
              <span class="gps-badge">📍 {{ newLat | number:'1.5-5' }}, {{ newLng | number:'1.5-5' }}</span>
            </div>
            <div class="gps-display" *ngIf="newLat === null">
              <span class="gps-badge empty">No coordinates yet</span>
            </div>
            <button class="btn-accessible btn-primary gps-btn" (click)="useCurrentLocation()" [disabled]="locating">
              {{ locating ? '📡 Locating...' : '📍 Use Current Location' }}
            </button>
          </div>
          <button class="btn-accessible btn-primary save-location-btn" (click)="addLocation()" [disabled]="!newName">
            💾 Save Location
          </button>
        </div>
      </section>

      <!-- Saved Locations -->
      <section class="saved-locations">
        <h2>Saved Locations ({{ locations.length }})</h2>
        <div class="locations-grid">
          <article *ngFor="let loc of locations; let i = index" class="location-card glass-panel">
            <div class="loc-card-header">
              <span class="loc-icon">{{ categoryIcon(loc.label) }}</span>
              <div class="loc-info">
                <strong class="loc-name">{{ loc.name }}</strong>
                <span class="loc-category">{{ loc.label | titlecase }}</span>
              </div>
              <button class="btn-accessible btn-danger btn-sm remove-btn" (click)="removeLocation(i)" aria-label="Remove location">✕</button>
            </div>
            <div class="loc-card-body">
              <div class="loc-detail" *ngIf="loc.address">
                <span class="detail-label">📫 Address</span>
                <span class="detail-value">{{ loc.address }}</span>
              </div>
              <div class="loc-detail" *ngIf="loc.lat !== null">
                <span class="detail-label">📍 GPS</span>
                <span class="detail-value">{{ loc.lat | number:'1.5-5' }}, {{ loc.lng | number:'1.5-5' }}</span>
              </div>
              <div class="loc-detail">
                <span class="detail-label">🕒 Saved</span>
                <span class="detail-value">{{ loc.savedAt | date:'mediumDate' }}</span>
              </div>
            </div>
          </article>
        </div>
        <div *ngIf="locations.length === 0" class="empty-state">
          <span class="empty-icon">🗺️</span>
          <p>No saved locations yet. Add your frequently visited places above.</p>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .location-page {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    .loc-header {
      padding: 24px;
      border-radius: 16px;
      margin-bottom: 24px;
    }
    .loc-header h1 { margin: 0; font-size: 1.6rem; }

    .quick-add {
      padding: 24px;
      border-radius: 16px;
      margin-bottom: 24px;
    }
    .quick-add h2 { margin: 0 0 16px; font-size: 1.2rem; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .form-group { margin-bottom: 14px; }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.6);
    }

    .gps-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .gps-badge {
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      background: rgba(74,222,128,0.1);
      color: #4ade80;
      font-family: 'Courier New', monospace;
    }
    .gps-badge.empty {
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.3);
    }
    .gps-btn { white-space: nowrap; }

    .save-location-btn { width: 100%; }

    .saved-locations { margin-bottom: 24px; }
    .saved-locations h2 {
      font-size: 1.1rem;
      margin-bottom: 16px;
      color: rgba(255,255,255,0.8);
    }

    .locations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .location-card {
      border-radius: 14px;
      overflow: hidden;
      transition: transform 0.15s;
    }
    .location-card:hover { transform: translateY(-2px); }

    .loc-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .loc-icon { font-size: 1.8rem; }
    .loc-info { flex: 1; }
    .loc-name { display: block; color: white; font-size: 1rem; }
    .loc-category { display: block; font-size: 0.8rem; color: rgba(255,255,255,0.4); }
    .remove-btn { padding: 4px 10px !important; font-size: 0.9rem; }

    .loc-card-body { padding: 14px 16px; }
    .loc-detail {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 0.85rem;
    }
    .detail-label { color: rgba(255,255,255,0.45); }
    .detail-value { color: rgba(255,255,255,0.8); text-align: right; }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: rgba(255,255,255,0.4);
    }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

    @media (max-width: 600px) {
      .location-page { padding: 16px; }
      .form-row { grid-template-columns: 1fr; }
      .gps-row { flex-direction: column; align-items: stretch; }
      .locations-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class LocationManagerComponent implements OnInit {
  locations: SavedLocation[] = [];
  newName = '';
  newLabel = 'home';
  newAddress = '';
  newLat: number | null = null;
  newLng: number | null = null;
  locating = false;

  constructor(
    private securityService: SecurityService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadLocations();
  }

  categoryIcon(label: string): string {
    const map: Record<string, string> = {
      home: '🏠', work: '🏢', school: '🏫', gym: '🏋️',
      restaurant: '🍽️', family: '👨‍👩‍👧', church: '⛪',
      hospital: '🏥', other: '📌'
    };
    return map[label] || '📌';
  }

  loadLocations(): void {
    const stored = localStorage.getItem('safer_locations');
    this.locations = stored ? JSON.parse(stored) : [];
  }

  async useCurrentLocation(): Promise<void> {
    this.locating = true;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      this.newLat = pos.coords.latitude;
      this.newLng = pos.coords.longitude;
      this.alertService.success('GPS coordinates captured!', 'Location');
    } catch {
      this.alertService.warning('Could not access GPS. Please check your browser permissions.', 'Location Error');
    }
    this.locating = false;
  }

  addLocation(): void {
    if (!this.newName.trim()) return;

    const loc: SavedLocation = {
      name: this.newName.trim(),
      label: this.newLabel,
      lat: this.newLat,
      lng: this.newLng,
      address: this.newAddress.trim(),
      savedAt: new Date().toISOString()
    };

    this.locations.unshift(loc);
    localStorage.setItem('safer_locations', JSON.stringify(this.locations));
    this.alertService.success(`"${loc.name}" saved to your location profiles!`, 'Location Saved');

    // Reset form
    this.newName = '';
    this.newLabel = 'home';
    this.newAddress = '';
    this.newLat = null;
    this.newLng = null;
  }

  removeLocation(index: number): void {
    const name = this.locations[index].name;
    this.locations.splice(index, 1);
    localStorage.setItem('safer_locations', JSON.stringify(this.locations));
    this.alertService.success(`"${name}" removed.`, 'Location Removed');
  }
}
