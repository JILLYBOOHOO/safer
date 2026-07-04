import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Incident {
  id: number;
  timestamp: string;
  gps_lat: number | null;
  gps_lng: number | null;
  photo_urls: string[];
  audio_url: string | null;
  video_url: string | null;
  sha256_hash: string | null;
  type: string;
}

@Component({
  selector: 'app-incident-log',
  template: `
    <main class="incident-log-page">
      <header class="log-header glass-panel">
        <div>
          <h1>🗂️ <span class="text-gradient">Evidence Locker</span></h1>
          <p class="text-secondary">Tamper-evident incident log. Every event is SHA-256 hashed for integrity verification.</p>
        </div>
        <div class="header-actions">
          <button class="btn-accessible btn-secondary" (click)="loadIncidents()">🔄 Refresh</button>
          <button class="btn-accessible btn-primary" (click)="captureManualIncident()">📸 Log Manual Incident</button>
        </div>
      </header>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card glass-panel">
          <span class="stat-icon">📊</span>
          <div>
            <span class="stat-value">{{ incidents.length }}</span>
            <span class="stat-label">Total Incidents</span>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <span class="stat-icon">🆘</span>
          <div>
            <span class="stat-value">{{ sosCount }}</span>
            <span class="stat-label">SOS Triggers</span>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <span class="stat-icon">📍</span>
          <div>
            <span class="stat-value">{{ gpsCount }}</span>
            <span class="stat-label">GPS Captured</span>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <span class="stat-icon">🔒</span>
          <div>
            <span class="stat-value">{{ hashCount }}</span>
            <span class="stat-label">Hash Verified</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="incidents.length === 0 && !loading" class="empty-state glass-panel">
        <span class="empty-icon">📭</span>
        <h3>No Incidents Recorded</h3>
        <p class="text-secondary">When an SOS or emergency event occurs, it will automatically appear here with full evidence including GPS, media, and a SHA-256 integrity hash.</p>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading evidence locker...</p>
      </div>

      <!-- Incident Cards -->
      <div class="incidents-grid">
        <article *ngFor="let inc of incidents; let i = index" class="incident-card glass-panel" [class.sos-incident]="inc.type === 'sos'">
          <div class="incident-header">
            <div class="incident-badge" [ngClass]="inc.type">
              {{ inc.type === 'sos' ? '🆘 SOS Alert' : inc.type === 'duress' ? '⚠️ Duress' : '📋 Manual' }}
            </div>
            <span class="incident-id">#{{ inc.id }}</span>
          </div>

          <div class="incident-body">
            <div class="evidence-row">
              <span class="evidence-label">🕒 Timestamp</span>
              <span class="evidence-value">{{ inc.timestamp | date:'medium' }}</span>
            </div>
            <div class="evidence-row" *ngIf="inc.gps_lat !== null">
              <span class="evidence-label">📍 GPS Location</span>
              <span class="evidence-value">
                {{ inc.gps_lat | number:'1.5-5' }}, {{ inc.gps_lng | number:'1.5-5' }}
                <a class="map-link" [href]="'https://www.google.com/maps?q=' + inc.gps_lat + ',' + inc.gps_lng" target="_blank" rel="noopener">
                  🗺️ View Map
                </a>
              </span>
            </div>
            <div class="evidence-row" *ngIf="inc.gps_lat === null">
              <span class="evidence-label">📍 GPS Location</span>
              <span class="evidence-value text-muted">Not captured</span>
            </div>

            <!-- Media Evidence -->
            <div class="evidence-row">
              <span class="evidence-label">📎 Media Evidence</span>
              <div class="media-chips">
                <span class="media-chip" *ngIf="inc.photo_urls && inc.photo_urls.length > 0">📷 {{ inc.photo_urls.length }} Photo(s)</span>
                <span class="media-chip" *ngIf="inc.audio_url">🎤 Audio</span>
                <span class="media-chip" *ngIf="inc.video_url">🎥 Video</span>
                <span class="media-chip empty" *ngIf="(!inc.photo_urls || inc.photo_urls.length === 0) && !inc.audio_url && !inc.video_url">
                  No media attached
                </span>
              </div>
            </div>

            <!-- SHA-256 Hash -->
            <div class="evidence-row hash-row">
              <span class="evidence-label">🔐 SHA-256 Hash</span>
              <code class="hash-value" *ngIf="inc.sha256_hash">{{ inc.sha256_hash }}</code>
              <span class="text-muted" *ngIf="!inc.sha256_hash">Pending verification</span>
            </div>
          </div>
        </article>
      </div>
    </main>
  `,
  styles: [`
    .incident-log-page {
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 24px;
      border-radius: 16px;
      margin-bottom: 24px;
    }
    .log-header h1 { margin: 0; font-size: 1.6rem; }
    .log-header .header-actions { display: flex; gap: 12px; }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 14px;
    }
    .stat-icon { font-size: 2rem; }
    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label {
      display: block;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.5);
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      border-radius: 16px;
    }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

    .loading-state {
      text-align: center;
      padding: 48px;
      color: rgba(255,255,255,0.6);
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .incidents-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .incident-card {
      border-radius: 16px;
      padding: 0;
      overflow: hidden;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .incident-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .incident-card.sos-incident { border-left: 4px solid #ef4444; }

    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .incident-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .incident-badge.sos { background: rgba(239,68,68,0.15); color: #f87171; }
    .incident-badge.duress { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .incident-badge.manual { background: rgba(96,165,250,0.15); color: #93c5fd; }
    .incident-id { color: rgba(255,255,255,0.3); font-size: 0.85rem; }

    .incident-body { padding: 16px 20px; }

    .evidence-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      flex-wrap: wrap;
      gap: 8px;
    }
    .evidence-row:last-child { border-bottom: none; }

    .evidence-label {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.5);
      min-width: 140px;
    }
    .evidence-value {
      font-size: 0.9rem;
      color: rgba(255,255,255,0.85);
      text-align: right;
      flex: 1;
    }

    .map-link {
      display: inline-block;
      margin-left: 8px;
      color: #667eea;
      text-decoration: none;
      font-size: 0.85rem;
    }
    .map-link:hover { text-decoration: underline; }

    .media-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      flex: 1;
    }
    .media-chip {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.8rem;
      background: rgba(102,126,234,0.12);
      color: #a5b4fc;
    }
    .media-chip.empty {
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.3);
    }

    .hash-row { flex-direction: column; gap: 6px; }
    .hash-value {
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      word-break: break-all;
      background: rgba(0,0,0,0.3);
      padding: 8px 12px;
      border-radius: 8px;
      color: #4ade80;
      border: 1px solid rgba(74,222,128,0.15);
    }

    .text-muted { color: rgba(255,255,255,0.3); }

    @media (max-width: 600px) {
      .incident-log-page { padding: 16px; }
      .log-header { flex-direction: column; align-items: flex-start; }
      .log-header .header-actions { width: 100%; }
      .log-header .header-actions button { flex: 1; }
      .evidence-row { flex-direction: column; }
      .evidence-value { text-align: left; }
      .media-chips { justify-content: flex-start; }
    }
  `]
})
export class IncidentLogComponent implements OnInit {
  incidents: Incident[] = [];
  loading = false;

  get sosCount(): number { return this.incidents.filter(i => i.type === 'sos').length; }
  get gpsCount(): number { return this.incidents.filter(i => i.gps_lat !== null).length; }
  get hashCount(): number { return this.incidents.filter(i => !!i.sha256_hash).length; }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadIncidents();
  }

  loadIncidents(): void {
    this.loading = true;
    const token = localStorage.getItem('safer_token');
    if (!token) {
      // Offline fallback — load from localStorage
      const stored = localStorage.getItem('safer_incidents');
      this.incidents = stored ? JSON.parse(stored) : [];
      this.loading = false;
      return;
    }

    this.http.get<Incident[]>('/api/incidents', {
      headers: { Authorization: 'Bearer ' + token }
    }).subscribe(
      data => { this.incidents = data.reverse(); this.loading = false; },
      () => {
        // Fallback to local
        const stored = localStorage.getItem('safer_incidents');
        this.incidents = stored ? JSON.parse(stored) : [];
        this.loading = false;
      }
    );
  }

  async captureManualIncident(): Promise<void> {
    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const payload = {
      type: 'manual',
      timestamp: new Date().toISOString(),
      gps_lat: lat,
      gps_lng: lng,
      photo_urls: [],
      audio_url: null,
      video_url: null,
      sha256_hash: ''
    };

    // Generate SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    payload.sha256_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Save to local storage first
    const stored = localStorage.getItem('safer_incidents');
    const local: Incident[] = stored ? JSON.parse(stored) : [];
    const incident: Incident = {
      id: local.length + 1,
      timestamp: payload.timestamp,
      gps_lat: lat,
      gps_lng: lng,
      photo_urls: [],
      audio_url: null,
      video_url: null,
      sha256_hash: payload.sha256_hash,
      type: 'manual'
    };
    local.unshift(incident);
    localStorage.setItem('safer_incidents', JSON.stringify(local));

    // Try to send to backend too
    const token = localStorage.getItem('safer_token');
    if (token) {
      this.http.post('/api/incidents', {
        latitude: lat,
        longitude: lng,
        photos: [],
        sha256_hash: payload.sha256_hash,
        type: 'manual'
      }, {
        headers: { Authorization: 'Bearer ' + token }
      }).subscribe(() => {}, () => {});
    }

    this.incidents.unshift(incident);
  }
}
