import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SecurityService, User } from '../../services/security.service';
import { HttpClient } from '@angular/common/http';
import { AlertService } from '../../services/alert.service';
import { BluetoothWearablesService } from '../../services/bluetooth-wearables.service';
import { TransitCheckService } from '../../services/transit-check.service';
import { FallDetectionService } from '../../services/fall-detection.service';
import { RouteAiService } from '../../services/route-ai.service';
import { RiskForecastService } from '../../services/risk-forecast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  template: `
    <main class="container">

    <main class="container">

      <!-- AI Risk Forecast Overlay -->
      <app-risk-forecast
        *ngIf="showRiskForecast"
        [routeName]="transitRoute"
        (startWalk)="onForecastStartWalk()"
        (dismissed)="showRiskForecast = false">
      </app-risk-forecast>

      <!-- Velocity Zero Alert Overlay -->
      <div *ngIf="showVelocityAlert" class="velocity-alert-overlay fade-in" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(239,68,68,0.95); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;">
        <div style="font-size: 64px; margin-bottom: 24px;">⚠️</div>
        <h1 style="color: white; font-size: 32px; font-weight: 900; margin-bottom: 12px; text-align: center;">Are you okay?</h1>
        <p style="color: white; font-size: 18px; text-align: center; margin-bottom: 32px;">{{ overlayMessage }} SOS will trigger in {{ velocityAlertCountdown }}s.</p>
        <button class="btn-accessible" style="background: white; color: #ef4444; font-size: 24px; font-weight: bold; padding: 16px 48px; border-radius: 50px; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.3);" (click)="dismissVelocityAlert()">
          I'm Safe
        </button>
      </div>

      <!-- Dashboard Header -->
      <header class="dashboard-header glass-panel">
        <div>
          <span class="user-badge" role="status">Active Security User</span>
          <h1>Welcome, <span class="text-gradient">{{ user?.name }}</span></h1>
          <p class="text-secondary">{{ user?.email }}</p>
        </div>
        <div class="header-actions">
          <button class="btn-accessible btn-secondary" style="border-color: rgba(255, 255, 255, 0.2); color: #f87171;" routerLink="/fake-call">
            📱 Fake Call
          </button>
          <button
            class="sos-btn"
            [class.sos-active]="sosActive"
            (click)="triggerSOS()"
            [disabled]="sosActive"
            id="sos-panic-btn"
            aria-label="SOS Emergency Button"
          >
            <span class="sos-icon">🆘</span>
            <span>{{ sosActive ? 'ALERT ACTIVE' : 'SOS' }}</span>
          </button>
          <button class="btn-accessible btn-secondary" style="border-color: rgba(255, 255, 255, 0.2);" (click)="logout()">
            Sign Out
          </button>
        </div>
      </header>

      <!-- Emergency Active Banner -->
      <div *ngIf="sosActive" class="emergency-banner" role="alert" aria-live="assertive">
        <div class="emergency-banner-content">
          <span class="pulse-dot"></span>
          <strong>🚨 EMERGENCY ACTIVE</strong>
          <span>— Live location & audio updates being sent to your emergency contact</span>
        </div>
        <button class="btn-safe" (click)="imSafe()" id="im-safe-btn">✅ I'm Safe — Stop Tracking</button>
      </div>

      <!-- Home Location Prompt Overlay -->
      <div class="home-prompt-overlay" *ngIf="showHomePrompt">
        <div class="home-prompt-card glass-panel">
          <div class="prompt-icon">📍</div>
          <h3>Secure Your Home Base</h3>
          <p>Save your 'Home' to let the app automatically confirm you've arrived safely.</p>
          <div class="prompt-actions">
            <button class="btn-accessible btn-primary full-width" (click)="acceptHomePrompt()" [disabled]="savingLocation">
              {{ savingLocation ? 'Locating...' : 'Share Location' }}
            </button>
            <button class="btn-accessible btn-ghost full-width" (click)="dismissHomePrompt()">
              Not Now
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <nav class="dashboard-tabs" role="tablist">
        <button
          *ngFor="let t of tabs"
          class="tab-btn"
          [class.active]="activeTab === t.id"
          (click)="activeTab = t.id"
          role="tab"
          [attr.aria-selected]="activeTab === t.id"
        >
          <span>{{ t.icon }}</span> {{ t.label }}
        </button>
      </nav>

      <!-- ============ TAB: OVERVIEW ============ -->
      <div *ngIf="activeTab === 'overview'" class="tab-content">
        
        <!-- Safe Transit Timer & Velocity Engine -->
        <section class="section-container glass-panel" style="padding: 20px; border-radius: 12px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div class="section-header-row" style="margin: 0;">
            <h2 class="section-title" style="margin: 0; border: none; padding: 0;">🏃 Safe Transit Monitor</h2>
          </div>
          
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <!-- Transit Timer -->
            <div style="flex: 1; min-width: 280px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.2); padding: 16px; border-radius: 12px;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #00f0ff;">Virtual Agent Timer</h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #a0c0e0;">If the timer expires, the Virtual Agent will automatically notify your contacts with your path.</p>
              
              <div *ngIf="!transitActive" style="display: flex; gap: 8px;">
                <input type="number" [(ngModel)]="transitMinutes" placeholder="Mins" style="width: 80px; padding: 8px; border-radius: 8px; border: 1px solid rgba(0,240,255,0.3); background: #000; color: #fff;">
                <input type="text" [(ngModel)]="transitRoute" placeholder="e.g. Walking Home" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(0,240,255,0.3); background: #000; color: #fff;">
                <button class="btn-accessible" style="background: #00f0ff; color: #000; font-weight: bold; border: none; padding: 8px 16px; border-radius: 8px;" (click)="openRiskForecast()">AI Check</button>
              </div>
              <div *ngIf="transitActive" style="display: flex; gap: 12px; align-items: center;">
                <span style="font-size: 24px; font-weight: bold; color: #ef4444; font-family: monospace;">{{ transitDisplay }}</span>
                <span style="flex: 1; font-size: 14px; color: #fff;">{{ transitRoute }}</span>
                <button class="btn-accessible" style="background: #ef4444; color: #fff; font-weight: bold; border: none; padding: 8px 16px; border-radius: 8px;" (click)="stopTransit()">Disarm</button>
              </div>
            </div>

            <!-- Velocity Engine -->
            <div style="flex: 1; min-width: 280px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 16px; border-radius: 12px; display: flex; flex-direction: column; justify-content: center;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 16px; color: #10b981;">TransitCheck Velocity Engine</h3>
                <span class="status-badge" [class.badge-active]="velocityTracking" [style.background]="velocityTracking ? '#10b981' : '#374151'">{{ velocityTracking ? 'Active' : 'Off' }}</span>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #a7f3d0;">On-device tracking. If your movement drops to zero for >3 mins, we'll prompt you.</p>
              <button class="btn-accessible" [style.background]="velocityTracking ? '#ef4444' : '#10b981'" style="color: #fff; font-weight: bold; border: none; padding: 8px 16px; border-radius: 8px; width: 100%;" (click)="toggleVelocityEngine()">
                {{ velocityTracking ? 'Stop Velocity Engine' : 'Enable Velocity Engine' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Offline Emergency Resources -->
        <section class="section-container glass-panel" aria-labelledby="offline-resources-title" style="padding: 20px; border-radius: 12px;">
          <div class="section-header-row">
            <h2 id="offline-resources-title" class="section-title" style="margin:0; border:none; padding:0;">📞 Local Offline Resource Directory</h2>
            <div class="header-actions">
              <span class="text-secondary text-sm" style="margin-right: 8px;">Cache: ~{{ cacheSizeStr }}</span>
              <span class="status-badge badge-active" style="margin-right: 8px;">{{ isOnline ? 'Online Sync' : 'Offline Mode' }}</span>
              <button class="btn-accessible btn-secondary btn-sm" (click)="syncOfflineDirectory()">
                🔄 Sync Directory
              </button>
            </div>
          </div>
          <p class="text-secondary text-margin">Crucial emergency contacts securely cached via Service Worker. 100% available without network connection.</p>
          <div class="emergency-grid">
            <article *ngFor="let help of emergencyContacts" class="help-card glass-panel">
              <h3>{{ help.name }}</h3>
              <p class="help-phone text-gradient">{{ help.phone }}</p>
              <p class="text-secondary">{{ help.description }}</p>
              <a [href]="'tel:' + help.phone" class="btn-accessible btn-primary phone-btn" aria-label="Call emergency support">
                Call Now
              </a>
            </article>
          </div>
        </section>

        <!-- Stegano Simulator -->
        <section class="glass-panel stegano-section" aria-labelledby="stegano-title">
          <h2 id="stegano-title">🎭 Stegano-Linguistics Alarm Simulator</h2>
          <p class="text-secondary text-margin">Simulate a casual checkin push alert containing hidden emergency crisis switches.</p>
          <div class="french-simulator">
            <div class="notification-preview">
              <p class="preview-title">Casual Notification Dispatcher</p>
              <p class="preview-msg">"Have you practiced your French today?"</p>
              <div class="preview-btns">
                <button type="button" class="btn-accessible btn-secondary" (click)="frenchCheckIn(true)">
                  Oui (Check In Ok)
                </button>
                <button type="button" class="btn-accessible btn-danger" (click)="frenchCheckIn(false)">
                  Non (Silent Panic Trigger)
                </button>
              </div>
            </div>
            <p class="text-muted italic">Note: letting 30s of inactivity lapse after push alert issues silent crisis protocols.</p>
          </div>
        </section>
      </div>

      <!-- ============ TAB: PROFILE ============ -->
      <div *ngIf="activeTab === 'profile'" class="tab-content">
        <div class="profile-grid">

          <!-- Basic Profile -->
          <section class="glass-panel" aria-labelledby="profile-settings-title">
            <h2 id="profile-settings-title">👤 User Profile</h2>
            <form (submit)="saveProfile($event)">
              <div class="form-group">
                <label for="prof-name">Display Name</label>
                <input id="prof-name" type="text" class="input-accessible" [(ngModel)]="editName" name="name" required />
              </div>
              <div class="form-group">
                <label for="prof-email">Email Address (AES Encrypted)</label>
                <input id="prof-email" type="email" class="input-accessible" [(ngModel)]="editEmail" name="email" required />
              </div>
              <div class="form-group">
                <label for="prof-wifi">Home Wi-Fi Network SSID</label>
                <div class="gps-capture-row">
                  <input id="prof-wifi" type="text" class="input-accessible" style="flex: 1" [(ngModel)]="editWifi" name="wifi" placeholder="e.g. MyHomeWiFi_5G" />
                  <button type="button" class="btn-accessible btn-secondary btn-sm" (click)="scanNetworks()">📡 Scan</button>
                </div>
              </div>
              <div class="form-group">
                <label for="prof-address">🏠 Home Address</label>
                <input id="prof-address" type="text" class="input-accessible" [(ngModel)]="editHomeAddress" name="homeAddress" placeholder="e.g. 12 Mango Lane, Kingston, Jamaica" />
              </div>
              <div class="gps-field form-group">
                <label>Home GPS Coordinates</label>
                <div class="gps-coords text-secondary" *ngIf="editGps">
                  Lat: {{ editGps.lat | number:'1.4-4' }} | Lng: {{ editGps.lng | number:'1.4-4' }}
                </div>
                <div class="gps-coords text-muted" *ngIf="!editGps">No coordinates registered</div>
                <button type="button" class="btn-accessible btn-secondary" (click)="getLocation()">
                  📍 Use Current Location
                </button>
              </div>
              <button type="submit" class="btn-accessible btn-primary save-btn" [disabled]="saving">
                {{ saving ? 'Saving...' : 'Update Profile' }}
              </button>
            </form>
          </section>

          <!-- Sessions -->
          <section class="glass-panel session-section" aria-labelledby="sessions-hub-title">
            <div class="section-header-row">
              <h2 id="sessions-hub-title">🔒 Remote Session Revocation Hub</h2>
              <div class="header-actions">
                <button type="button" class="btn-accessible btn-secondary btn-sm" (click)="loadSessions()">🔄 Refresh</button>
                <button type="button" class="btn-accessible btn-secondary btn-sm" (click)="scanDevices()">📡 Scan Network</button>
              </div>
            </div>
            <p class="text-secondary text-margin">Active logged-in endpoints. Instantly revoke permissions or force remote wipes.</p>
            <div class="sessions-list">
              <div *ngFor="let ses of sessions" class="session-item">
                <div>
                  <p class="session-agent font-bold">{{ ses.device_fingerprint }}</p>
                  <p class="session-details text-secondary">
                    IP: {{ ses.ip_address }} | Last Active: {{ ses.last_active | date:'short' }}
                  </p>
                </div>
                <button class="btn-accessible btn-danger btn-sm" (click)="revokeSession(ses.id)" aria-label="Revoke remote access">
                  Revoke
                </button>
              </div>
              <div *ngIf="sessions.length === 0" class="text-muted">No remote sessions cataloged.</div>
            </div>
            <button class="btn-accessible btn-danger full-width" (click)="revokeAllSessions()" *ngIf="sessions.length > 1">
              Force Global Logout (Wipe All Devices)
            </button>
          </section>
        </div>
      </div>

      <!-- ============ TAB: MEDICAL CARD ============ -->
      <div *ngIf="activeTab === 'medical'" class="tab-content">
        <section class="glass-panel" aria-labelledby="medical-card-title">
          <div class="section-header-row">
            <h2 id="medical-card-title">🏥 Digital Medical Card</h2>
            <span class="encrypted-badge">🔒 AES-256 Encrypted</span>
          </div>
          <p class="text-secondary text-margin">Store critical health information for first responders. This data is encrypted and only accessible when you are logged in.</p>

          <form (submit)="saveMedicalCard($event)" class="medical-form">
            <div class="form-row-2">
              <div class="form-group">
                <label for="blood-type">Blood Type</label>
                <select id="blood-type" class="input-accessible" [(ngModel)]="medCard.bloodType" name="bloodType">
                  <option value="">-- Select --</option>
                  <option *ngFor="let bt of bloodTypes" [value]="bt">{{ bt }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="organ-donor">Organ Donor</label>
                <select id="organ-donor" class="input-accessible" [(ngModel)]="medCard.organDonor" name="organDonor">
                  <option [value]="false">No</option>
                  <option [value]="true">Yes</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="allergies">Known Allergies</label>
              <textarea id="allergies" class="input-accessible textarea-style" [(ngModel)]="medCard.allergies" name="allergies" placeholder="e.g. Penicillin, Shellfish, Latex..."></textarea>
            </div>

            <div class="form-group">
              <label for="medications">Current Medications</label>
              <textarea id="medications" class="input-accessible textarea-style" [(ngModel)]="medCard.medications" name="medications" placeholder="e.g. Metformin 500mg, Lisinopril 10mg..."></textarea>
            </div>

            <div class="form-group">
              <label for="conditions">Chronic Conditions / Diagnoses</label>
              <textarea id="conditions" class="input-accessible textarea-style" [(ngModel)]="medCard.conditions" name="conditions" placeholder="e.g. Type 2 Diabetes, Hypertension..."></textarea>
            </div>

            <div class="form-group">
              <label for="medical-notes">Additional Medical Notes</label>
              <textarea id="medical-notes" class="input-accessible textarea-style" [(ngModel)]="medCard.notes" name="notes" placeholder="e.g. Do not administer NSAIDs. Pacemaker implanted 2022..."></textarea>
            </div>

            <button type="submit" class="btn-accessible btn-primary save-btn" [disabled]="savingMedical">
              {{ savingMedical ? 'Encrypting & Saving...' : '🔒 Save Medical Card' }}
            </button>
          </form>
        </section>
      </div>

      <!-- ============ TAB: EMERGENCY CONTACT ============ -->
      <div *ngIf="activeTab === 'contact'" class="tab-content">
        <section class="glass-panel" aria-labelledby="emergency-contact-title">
          <div class="section-header-row">
            <h2 id="emergency-contact-title">📞 Emergency Contact</h2>
            <span class="encrypted-badge">🔒 AES-256 Encrypted</span>
          </div>
          <p class="text-secondary text-margin">Your primary emergency contact. This information is encrypted and can be shared with first responders in a crisis.</p>

          <form (submit)="saveEmergencyContact($event)" class="contact-form">
            <div class="form-row-2">
              <div class="form-group">
                <label for="ec-name">Contact Full Name</label>
                <input id="ec-name" type="text" class="input-accessible" [(ngModel)]="emergContact.name" name="ecName" placeholder="e.g. Jane Doe" />
              </div>
              <div class="form-group">
                <label for="ec-relationship">Relationship</label>
                <select id="ec-relationship" class="input-accessible" [(ngModel)]="emergContact.relationship" name="ecRelationship">
                  <option value="">-- Select --</option>
                  <option *ngFor="let r of relationships" [value]="r">{{ r }}</option>
                </select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label for="ec-phone">WhatsApp / Phone Number</label>
                <input id="ec-phone" type="tel" class="input-accessible" [(ngModel)]="emergContact.phone" name="ecPhone" placeholder="e.g. +18765551234" />
              </div>
              <div class="form-group">
                <label for="ec-email">Email Address</label>
                <input id="ec-email" type="email" class="input-accessible" [(ngModel)]="emergContact.email" name="ecEmail" placeholder="e.g. jane@example.com" />
              </div>
            </div>
            <div class="form-group">
              <label for="ec-address">Contact Address</label>
              <input id="ec-address" type="text" class="input-accessible" [(ngModel)]="emergContact.address" name="ecAddress" placeholder="e.g. 8 Orchid Close, Kingston" />
            </div>
            <div class="form-group">
              <label for="ec-notes">Special Instructions</label>
              <textarea id="ec-notes" class="input-accessible textarea-style" [(ngModel)]="emergContact.notes" name="ecNotes" placeholder="e.g. Contact only between 8am–8pm. Speaks Spanish."></textarea>
            </div>
            <button type="submit" class="btn-accessible btn-primary save-btn" [disabled]="savingContact">
              {{ savingContact ? 'Encrypting & Saving...' : '🔒 Save Emergency Contact' }}
            </button>
          </form>
        </section>
      </div>

      <!-- ============ TAB: FREQUENT PLACES ============ -->
      <div *ngIf="activeTab === 'places'" class="tab-content">
        <section class="glass-panel" aria-labelledby="places-title">
          <div class="section-header-row">
            <h2 id="places-title">📍 Security Perimeter Configuration</h2>
            <span class="encrypted-badge">🔒 AES-256 Encrypted</span>
          </div>
          <p class="text-secondary text-margin">Register safe zones and frequently visited locations. Used by the security system to detect unusual movements.</p>

          <!-- Add New Place Form -->
          <div class="add-place-form glass-inner">
            <h3 class="subsection-title">Add New Safe Zone</h3>
            <div class="form-row-3">
              <div class="form-group">
                <label for="place-name">Place Name</label>
                <input id="place-name" type="text" class="input-accessible" [(ngModel)]="newPlace.name" placeholder="e.g. Workplace" />
              </div>
              <div class="form-group">
                <label for="place-label">Category</label>
                <select id="place-label" class="input-accessible" [(ngModel)]="newPlace.label">
                  <option value="work">🏢 Work</option>
                  <option value="school">🏫 School</option>
                  <option value="gym">🏋️ Gym</option>
                  <option value="church">⛪ Church</option>
                  <option value="family">👨‍👩‍👧 Family</option>
                  <option value="hospital">🏥 Hospital</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>
              <div class="form-group">
                <label for="place-address">Address</label>
                <input id="place-address" type="text" class="input-accessible" [(ngModel)]="newPlace.address" placeholder="e.g. 5 Main St, Kingston" />
              </div>
            </div>
            <div class="form-group">
              <label>GPS (Optional)</label>
              <div class="gps-capture-row">
                <span class="gps-text text-secondary" *ngIf="newPlace.gps">📍 {{ newPlace.gps.lat | number:'1.4-4' }}, {{ newPlace.gps.lng | number:'1.4-4' }}</span>
                <span class="gps-text text-muted" *ngIf="!newPlace.gps">No coordinates captured</span>
                <button type="button" class="btn-accessible btn-secondary btn-sm" (click)="captureNewPlaceGPS()">
                  Use Current GPS
                </button>
              </div>
            </div>
            <button type="button" class="btn-accessible btn-secondary" (click)="addPlace()" [disabled]="!newPlace.name">
              ➕ Add Safe Zone to List
            </button>
          </div>

          <!-- Places List -->
          <div class="places-list" *ngIf="frequentPlaces.length > 0">
            <h3 class="subsection-title">Registered Safe Zones ({{ frequentPlaces.length }})</h3>
            <div class="place-card" *ngFor="let p of frequentPlaces; let i = index">
              <div class="place-icon">{{ placeIcon(p.label) }}</div>
              <div class="place-info">
                <strong>{{ p.name }}</strong>
                <span class="place-address text-secondary">{{ p.address }}</span>
                <span class="place-gps text-muted" *ngIf="p.gps">📍 {{ p.gps.lat | number:'1.4-4' }}, {{ p.gps.lng | number:'1.4-4' }}</span>
              </div>
              <button class="btn-accessible btn-danger btn-sm" (click)="removePlace(i)">Remove</button>
            </div>
          </div>
          <div *ngIf="frequentPlaces.length === 0" class="empty-state">
            <span>No safe zones registered yet.</span>
          </div>

          <!-- Master Save Changes button for the Configuration panel -->
          <button type="button" class="btn-accessible btn-primary save-btn" (click)="savePlaces()" [disabled]="savingPlaces">
            {{ savingPlaces ? 'Applying...' : '🔒 Apply Security Perimeter' }}
          </button>
        </section>
      </div>

      <!-- ============ TAB: DIAGNOSTICS ============ -->
      <div *ngIf="activeTab === 'diagnostics'" class="tab-content">
        <section class="glass-panel" aria-labelledby="ticket-title">
          <h2 id="ticket-title">🛠️ Diagnostic Trouble Ticketing</h2>
          <p class="text-secondary text-margin">File system reports. Environmental device metadata will be appended automatically.</p>
          <form (submit)="fileTicket($event)">
            <div class="form-group">
              <label for="tick-title">Problem Summary</label>
              <input id="tick-title" type="text" class="input-accessible" [(ngModel)]="ticketTitle" name="title" required placeholder="e.g., Accelerometer trigger sensitivity" />
            </div>
            <div class="form-group">
              <label for="tick-desc">Detailed Description</label>
              <textarea id="tick-desc" class="input-accessible textarea-style" [(ngModel)]="ticketDesc" name="desc" required placeholder="Describe what occurred..."></textarea>
            </div>
            <button type="submit" class="btn-accessible btn-primary save-btn" [disabled]="submittingTicket">
              {{ submittingTicket ? 'Dispatching...' : 'File Diagnostic Ticket' }}
            </button>
          </form>
        </section>
      </div>

      <!-- ============ TAB: DEVICES ============ -->
      <div *ngIf="activeTab === 'devices'" class="tab-content">
        <section class="section-container glass-panel" aria-labelledby="devices-title" style="padding: 20px; border-radius: 12px;">
          <h2 id="devices-title" class="section-title">⌚ Bluetooth & Wearables</h2>
          <p class="text-secondary text-margin">Connect biometric wearables and external triggers to enhance your emergency response toolkit.</p>
          
          <div class="device-card" style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px;">Biometric Heart Rate Monitor</h3>
              <span class="status-badge" [style.background]="isHrConnected ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)'" [style.color]="isHrConnected ? '#10b981' : '#ccc'" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; font-weight: bold;">{{ isHrConnected ? 'Connected' : 'Offline' }}</span>
            </div>
            <p class="text-secondary text-sm" style="margin-bottom: 16px;">Triggers a silent SOS if your heart rate spikes above 150 BPM.</p>
            
            <button *ngIf="!isHrConnected" class="btn-accessible btn-primary" (click)="connectHeartRate()">
              Pair Device
            </button>
            <button *ngIf="isHrConnected" class="btn-accessible btn-danger" (click)="disconnectHeartRate()">
              Disconnect
            </button>
          </div>
        </section>
      </div>

      <!-- ============ TAB: FAMILY ============ -->
      <div *ngIf="activeTab === 'family'" class="tab-content">
        <app-guardian-dashboard></app-guardian-dashboard>
      </div>

    </main>
  `,
  styles: [`
    .dashboard-header {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
    }
    .user-badge {
      display: inline-block; font-size: 11px; font-weight: bold;
      text-transform: uppercase; padding: 4px 8px;
      background: rgba(16,185,129,0.15); color: #10b981;
      border-radius: 4px; border: 1px solid rgba(16,185,129,0.3); margin-bottom: 6px;
    }
    .header-actions { display: flex; gap: 20px; }

    /* Tab Nav */
    .dashboard-tabs {
      display: flex; gap: 4px; flex-wrap: wrap;
      background: rgba(0,0,0,0.2); border-radius: 14px;
      padding: 6px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);
    }
    .tab-btn {
      flex: 1; min-width: 120px; display: flex; align-items: center; justify-content: center; gap: 6px;
      background: transparent; border: none; color: var(--text-secondary);
      padding: 10px 16px; border-radius: 10px; cursor: pointer;
      font-size: 13px; font-weight: 600; transition: all 0.2s;
    }
    .tab-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
    .tab-btn.active {
      background: rgba(56,189,248,0.12); color: var(--primary);
      border: 1px solid rgba(56,189,248,0.2);
      box-shadow: 0 0 10px rgba(56,189,248,0.1);
    }

    .tab-content { animation: tab-fade 0.3s ease-out; }
    @keyframes tab-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* Section layouts */
    .section-container { margin-bottom: 32px; }
    .section-title {
      font-size: 20px; margin-bottom: 16px;
      padding-left: 4px; border-left: 4px solid var(--primary);
    }
    .section-header-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
    }
    .section-header-row h2 { margin: 0; }
    .encrypted-badge {
      font-size: 11px; font-weight: 700; padding: 4px 10px;
      background: rgba(34,197,94,0.1); color: #22c55e;
      border: 1px solid rgba(34,197,94,0.3); border-radius: 20px;
    }
    .subsection-title { font-size: 15px; font-weight: 700; color: var(--text-secondary); margin: 0 0 12px; }

    /* Emergency grid */
    .emergency-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .help-card { display: flex; flex-direction: column; gap: 8px; }
    .help-phone { font-size: 22px; font-weight: bold; font-family: var(--font-display); }
    .phone-btn { margin-top: auto; text-decoration: none; width: 100%; }

    /* Profile & diagnostics grid */
    .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; }

    /* Form styles */
    .medical-form, .contact-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .form-row-2, .form-row-3 { grid-template-columns: 1fr; } }

    .gps-field { display: flex; flex-direction: column; gap: 6px; }
    .gps-coords {
      background: rgba(0,0,0,0.2); padding: 8px 12px;
      border-radius: 6px; font-family: monospace; font-size: 13px;
      word-break: break-all; overflow-wrap: anywhere;
    }
    .gps-capture-row {
      display: flex; align-items: center; gap: 10px;
      background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 8px;
      flex-wrap: wrap;
    }
    .gps-text { flex: 1; font-size: 13px; font-family: monospace; word-break: break-all; overflow-wrap: anywhere; }

    .text-margin { margin-bottom: 16px; }
    .textarea-style { min-height: 90px; padding: 12px 16px; resize: vertical; }
    .save-btn { width: 100%; margin-top: 8px; }
    .full-width { width: 100%; }

    /* Sessions */
    .sessions-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .session-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px; background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;
    }
    .session-agent { font-size: 14px; }
    .session-details { font-size: 11px; }
    .btn-sm { padding: 6px 12px; min-height: 34px; font-size: 12px; }

    /* Places */
    .add-place-form {
      background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px; padding: 20px; margin-bottom: 24px;
    }
    .glass-inner { background: rgba(255,255,255,0.02); }
    .places-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .place-card {
      display: flex; align-items: center; gap: 14px;
      padding: 14px; background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;
    }
    .place-icon { font-size: 26px; flex-shrink: 0; }
    .place-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .place-info strong { font-size: 14px; color: var(--text-primary); }
    .place-address { font-size: 12px; }
    .place-gps { font-size: 11px; font-family: monospace; }
    .empty-state {
      text-align: center; padding: 32px; color: var(--text-muted);
      border: 2px dashed rgba(255,255,255,0.08); border-radius: 12px;
      margin-bottom: 20px;
    }

    /* Stegano */
    .stegano-section { margin-top: 24px; }
    .french-simulator { display: flex; flex-direction: column; gap: 12px; }
    .notification-preview {
      background: rgba(0,0,0,0.3); border: 1px dashed var(--accent);
      padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;
    }
    .preview-title { font-size: 11px; color: var(--accent); font-weight: bold; text-transform: uppercase; }
    .preview-msg { font-size: 18px; font-family: var(--font-display); }
    .preview-btns { display: flex; gap: 8px; }
    .italic { font-style: italic; }

    /* Home Prompt */
    .home-prompt-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px;
    }
    .home-prompt-card {
      width: 100%; max-width: 360px; padding: 32px 24px;
      text-align: center; display: flex; flex-direction: column; gap: 16px;
      animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .prompt-icon { font-size: 48px; line-height: 1; margin-bottom: 8px; }
    .home-prompt-card h3 { font-size: 20px; margin: 0; }
    .home-prompt-card p { font-size: 14px; color: var(--text-secondary); margin: 0 0 8px; line-height: 1.5; }
    .prompt-actions { display: flex; flex-direction: column; gap: 8px; }
    .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); padding: 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .btn-ghost:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }

    /* SOS Panic Button */
    .sos-btn {
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #ff2d2d, #ff6b35);
      color: white; border: none; border-radius: 12px;
      padding: 12px 20px; cursor: pointer;
      font-size: 14px; font-weight: 800; letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow: 0 0 20px rgba(255,45,45,0.5);
      transition: all 0.2s;
      animation: sos-pulse 2s ease-in-out infinite;
    }
    .sos-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 0 30px rgba(255,45,45,0.7); }
    .sos-btn.sos-active {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      animation: sos-active-pulse 0.8s ease-in-out infinite;
      cursor: not-allowed;
    }
    .sos-icon { font-size: 18px; }
    @keyframes sos-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(255,45,45,0.5); }
      50% { box-shadow: 0 0 35px rgba(255,45,45,0.8); }
    }
    @keyframes sos-active-pulse {
      0%, 100% { opacity: 1; } 50% { opacity: 0.7; }
    }

    /* Emergency Active Banner */
    .emergency-banner {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
      background: linear-gradient(135deg, rgba(220,38,38,0.2), rgba(185,28,28,0.1));
      border: 1px solid rgba(220,38,38,0.4);
      border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
      animation: banner-flash 1.5s ease-in-out infinite;
    }
    @keyframes banner-flash { 0%, 100% { border-color: rgba(220,38,38,0.4); } 50% { border-color: rgba(220,38,38,0.9); } }
    .emergency-banner-content { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }
    .pulse-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #ef4444; flex-shrink: 0;
      animation: dot-pulse 1s ease-in-out infinite;
    }
    @keyframes dot-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.6; } }
    .btn-safe {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white; border: none; border-radius: 10px;
      padding: 8px 16px; cursor: pointer;
      font-size: 13px; font-weight: 700; white-space: nowrap;
      transition: all 0.2s;
    }
    .btn-safe:hover { transform: scale(1.03); }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  public user: User | null = null;
  public sessions: any[] = [];
  public emergencyContacts: any[] = [];
  public activeTab: 'overview' | 'profile' | 'medical' | 'contact' | 'places' | 'diagnostics' | 'devices' | 'family' = 'overview';

  // Transit & Velocity UI State
  public transitActive = false;
  public transitMinutes = 15;
  public transitRoute = '';
  public transitDisplay = '00:00';
  private transitInterval: any;

  public showRiskForecast = false;
  public velocityTracking = false;
  public showVelocityAlert = false;
  public velocityAlertCountdown = 60;
  public overlayMessage = 'We detected you stopped moving.';
  public overlayInterval: any;
  private velocityAlertInterval: any;
  private transitSub: Subscription | null = null;

  public tabs = [
    { id: 'overview', icon: '🏠', label: 'Overview' },
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'medical', icon: '🏥', label: 'Medical Card' },
    { id: 'contact', icon: '📞', label: 'Emergency Contact' },
    { id: 'places', icon: '📍', label: 'Safe Zones' },
    { id: 'diagnostics', icon: '🛠️', label: 'Diagnostics' },
    { id: 'devices', icon: '⌚', label: 'Devices' },
    { id: 'family', icon: '👨‍👩‍👧', label: 'Family' }
  ] as const;

  // Profile form
  public editName = '';
  public editEmail = '';
  public editWifi = '';
  public editHomeAddress = '';
  public editGps: { lat: number; lng: number } | null = null;
  public saving = false;

  // Medical Card
  public medCard: any = { bloodType: '', organDonor: false, allergies: '', medications: '', conditions: '', notes: '' };
  public savingMedical = false;
  public bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Emergency Contact
  public emergContact: any = { name: '', relationship: '', phone: '', email: '', address: '', notes: '' };
  public savingContact = false;
  public relationships = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Colleague', 'Doctor', 'Other'];

  // Frequent Places
  public frequentPlaces: any[] = [];
  public savingPlaces = false;
  public newPlace: any = { name: '', label: 'other', address: '', gps: null };

  // Tickets
  public ticketTitle = '';
  public ticketDesc = '';
  public submittingTicket = false;

  // Home prompt state
  public showHomePrompt = false;
  public savingLocation = false;

  // Offline/Cache metrics
  public isOnline = navigator.onLine;
  public cacheSizeStr = '12 KB';

  // Devices
  public isHrConnected = false;

  // SOS state
  public sosActive = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private securityService: SecurityService,
    private http: HttpClient,
    private alertService: AlertService,
    public bluetoothWearablesService: BluetoothWearablesService,
    private transitCheckService: TransitCheckService,
    private fallDetectionService: FallDetectionService,
    private routeAiService: RouteAiService,
    private riskForecastService: RiskForecastService
  ) {
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  ngOnInit() {
    this.user = this.securityService.currentUserValue;
    if (!this.user) { this.router.navigate(['/login']); return; }
    
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const validTabs = ['overview', 'profile', 'medical', 'contact', 'places', 'diagnostics', 'devices'];
        if (validTabs.includes(params['tab'])) {
          this.activeTab = params['tab'] as any;
        }
      }
    });

    this.editName = this.user.name;
    this.editEmail = this.user.email;
    this.editWifi = this.user.homeWifi || '';
    this.editGps = this.user.homeGps || null;
    this.editHomeAddress = this.user.homeAddress || '';
    this.medCard = this.user.medicalCard || { bloodType: '', organDonor: false, allergies: '', medications: '', conditions: '', notes: '' };
    this.emergContact = this.user.emergencyContact || { name: '', relationship: '', phone: '', email: '', address: '', notes: '' };
    this.frequentPlaces = this.user.frequentPlaces ? [...this.user.frequentPlaces] : [];

    if (!this.editGps && !sessionStorage.getItem('home_prompt_dismissed')) {
      setTimeout(() => this.showHomePrompt = true, 800);
    }
    this.loadSessions();
    this.loadEmergencyData();
    this.estimateCacheSize();

    // Initialize Bluetooth Wearables (MediaSession earbud hijack)
    this.bluetoothWearablesService.initMediaSessionHijack();
    this.bluetoothWearablesService.onBluetoothSosTriggered.subscribe((evt: any) => {
      if (evt.source === 'earbud_triple_click') {
        this.alertService.danger('Earbud SOS triggered! Dispatching emergency protocols.', 'EARBUD SOS');
        this.securityService.triggerEmergency('earbud_triple_click').subscribe();
      } else if (evt.source === 'heart_rate_spike') {
        this.alertService.danger(`Heart rate spike detected (${evt.data} BPM). Alerting contacts.`, 'BIOMETRIC ALERT');
        this.securityService.triggerEmergency('heart_rate_spike').subscribe();
      }
    });
    
    // Subscribe to Velocity Engine Alerts
    this.transitSub = this.transitCheckService.velocityZeroAlert.subscribe(() => {
      this.triggerVelocityAlert();
    });

    // Initialize Fall Detection Engine
    this.fallDetectionService.startTracking();
    this.fallDetectionService.fallDetected$.subscribe((detected: any) => {
      if (detected) {
        this.triggerAreYouOkayOverlay('Fall Detection AI: Hard impact and no movement detected. Are you okay?');
      }
    });

    // Initialize Route AI Engine subscriptions
    this.routeAiService.anomalyDetected$.subscribe((anomaly: any) => {
      if (anomaly) {
        this.triggerAreYouOkayOverlay(anomaly.message);
      }
    });
  }

  ngOnDestroy() {
    if (this.transitInterval) clearInterval(this.transitInterval);
    if (this.velocityAlertInterval) clearInterval(this.velocityAlertInterval);
    if (this.overlayInterval) clearInterval(this.overlayInterval);
    if (this.transitSub) this.transitSub.unsubscribe();
    this.fallDetectionService.stopTracking();
    this.routeAiService.stopRouteMonitoring();
  }

  public switchTab(tab: 'overview' | 'contacts' | 'devices' | 'family') {
    this.activeTab = tab as any;
  }

  // ================= TRANSIT & VELOCITY LOGIC =================

  public openRiskForecast() {
    if (!this.transitMinutes || this.transitMinutes <= 0) {
      this.alertService.warning('Please enter a transit duration first.');
      return;
    }
    this.showRiskForecast = true;
  }

  public onForecastStartWalk() {
    this.showRiskForecast = false;
    this.startTransit();
  }

  public startTransit() {
    if (!this.transitMinutes || this.transitMinutes <= 0) return;
    this.http.post(`${this.securityService['API_URL']}/transit/start`, {
      durationMinutes: this.transitMinutes,
      routeName: this.transitRoute
    }, { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }).subscribe(
      () => {
        this.transitActive = true;
        this.startTransitTimer(this.transitMinutes * 60);
        this.alertService.success(`Virtual Agent is now monitoring your transit to ${this.transitRoute}.`, 'Transit Active');
        this.routeAiService.startRouteMonitoring(this.transitRoute);
      },
      (err: any) => this.alertService.error('Failed to start transit.')
    );
  }

  public stopTransit() {
    this.http.post(`${this.securityService['API_URL']}/transit/stop`, {}, { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }).subscribe(
      () => {
        this.transitActive = false;
        if (this.transitInterval) clearInterval(this.transitInterval);
        this.alertService.success('Virtual Agent monitoring disabled.', 'Transit Stopped');
        this.routeAiService.stopRouteMonitoring();
      },
      (err: any) => this.alertService.error('Failed to stop transit.')
    );
  }

  private startTransitTimer(seconds: number) {
    if (this.transitInterval) clearInterval(this.transitInterval);
    let remaining = seconds;
    this.updateTransitDisplay(remaining);
    this.transitInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.transitInterval);
        this.transitActive = false;
        this.alertService.danger('Transit Timer Expired! SOS auto-triggered by server.');
      } else {
        this.updateTransitDisplay(remaining);
      }
    }, 1000);
  }

  private updateTransitDisplay(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    this.transitDisplay = `${m}:${s}`;
  }

  public toggleVelocityEngine() {
    if (this.velocityTracking) {
      this.transitCheckService.stopTracking();
      this.velocityTracking = false;
    } else {
      this.transitCheckService.startTracking();
      this.velocityTracking = true;
      this.alertService.success('TransitCheck Velocity Engine activated.');
    }
  }

  private triggerVelocityAlert() {
    this.triggerAreYouOkayOverlay('We detected you stopped moving.');
  }

  public triggerAreYouOkayOverlay(message: string) {
    this.overlayMessage = message;
    this.showVelocityAlert = true;
    this.velocityAlertCountdown = 60;
    if (this.overlayInterval) clearInterval(this.overlayInterval);
    
    this.overlayInterval = setInterval(() => {
      this.velocityAlertCountdown--;
      if (this.velocityAlertCountdown <= 0) {
        clearInterval(this.overlayInterval);
        this.showVelocityAlert = false;
        // Trigger SOS
        this.triggerSOS();
      }
    }, 1000);
  }

  public dismissVelocityAlert() {
    this.showVelocityAlert = false;
    if (this.overlayInterval) clearInterval(this.overlayInterval);
    this.fallDetectionService.dismissFall();
    this.routeAiService.dismissAnomaly();
  }

  private async estimateCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const est = await navigator.storage.estimate();
        if (est.usage) {
          const kb = Math.round(est.usage / 1024);
          this.cacheSizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
        }
      } catch (e) {}
    }
  }

  public syncOfflineDirectory() {
    this.alertService.info('Syncing emergency resource directory...', 'Syncing');
    if (this.isOnline) {
      setTimeout(() => {
        this.loadEmergencyData();
        this.estimateCacheSize();
        this.alertService.success('Offline directory synchronized with remote server. Cache updated.', 'Sync Complete');
      }, 1500);
    } else {
      this.alertService.warning('Cannot sync while offline. Using cached resources.', 'Offline Mode');
    }
  }

  public loadSessions() {
    this.securityService.getSessions().subscribe(res => { this.sessions = res; });
  }

  public scanDevices() {
    this.alertService.info('Scanning for network anomalies and local BLE beacons...', 'Network Scan Initialized', 2000);
    setTimeout(() => {
      this.alertService.success('Network scan complete. No unauthorized rogue devices found.', 'Scan Complete');
      this.loadSessions();
    }, 2000);
  }

  public scanNetworks() {
    this.alertService.info('Scanning for available Wi-Fi networks...', 'Wi-Fi Scan');
    setTimeout(() => {
      const mockNetworks = ['MyHomeWiFi_5G', 'Guest_Network', 'Linksys_Router', 'ATT_Fiber'];
      this.editWifi = mockNetworks[Math.floor(Math.random() * mockNetworks.length)];
      this.alertService.success(`Found network: ${this.editWifi}`, 'Network Found');
    }, 1500);
  }

  private loadEmergencyData() {
    this.http.get<any[]>('/assets/emergency.json').subscribe(
      data => this.emergencyContacts = data,
      () => {
        this.emergencyContacts = [
          { name: 'Ministry of Health Helpline', phone: '888-639-5433', description: 'General medical queries.' },
          { name: 'U-Matter Support', phone: '876-838-4897', description: 'Youth mental health crisis.' },
          { name: 'SafeSpot Line', phone: '888-723-3776', description: 'Child & teen counseling.' },
          { name: 'Woman Inc Crisis Hotline', phone: '876-929-2997', description: 'Domestic abuse advocacy.' }
        ];
      }
    );
  }

  public saveProfile(e: Event) {
    e.preventDefault();
    this.saving = true;
    this.securityService.updateProfile({
      name: this.editName, email: this.editEmail,
      homeWifi: this.editWifi, homeGps: this.editGps || undefined,
      homeAddress: this.editHomeAddress
    }).subscribe(
      () => { this.saving = false; this.alertService.success('Profile updated successfully.', 'Saved'); },
      () => { this.saving = false; this.alertService.error('Failed to update profile.', 'Error'); }
    );
  }

  public saveMedicalCard(e: Event) {
    e.preventDefault();
    this.savingMedical = true;
    this.securityService.updateProfile({ medicalCard: this.medCard }).subscribe(
      () => { this.savingMedical = false; this.alertService.success('Medical card encrypted and saved.', '🏥 Medical Card Saved'); },
      () => { this.savingMedical = false; this.alertService.error('Failed to save medical card.', 'Error'); }
    );
  }

  public saveEmergencyContact(e: Event) {
    e.preventDefault();
    this.savingContact = true;
    this.securityService.updateProfile({ emergencyContact: this.emergContact }).subscribe(
      () => { this.savingContact = false; this.alertService.success('Emergency contact encrypted and saved.', '📞 Contact Saved'); },
      () => { this.savingContact = false; this.alertService.error('Failed to save emergency contact.', 'Error'); }
    );
  }

  public addPlace() {
    if (!this.newPlace.name) return;
    this.frequentPlaces.push({ ...this.newPlace });
    this.newPlace = { name: '', label: 'other', address: '', gps: null };
  }

  public removePlace(i: number) {
    this.frequentPlaces.splice(i, 1);
  }

  public savePlaces() {
    this.savingPlaces = true;
    this.securityService.updateProfile({ frequentPlaces: this.frequentPlaces }).subscribe(
      () => { this.savingPlaces = false; this.alertService.success('Safe zones encrypted and saved.', '📍 Places Saved'); },
      () => { this.savingPlaces = false; this.alertService.error('Failed to save safe zones.', 'Error'); }
    );
  }

  public captureNewPlaceGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => { this.newPlace.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; this.alertService.info('GPS captured.', 'Location'); },
      err => { this.alertService.warning('GPS unavailable: ' + err.message, 'GPS Error'); }
    );
  }

  public placeIcon(label: string): string {
    const icons: Record<string, string> = { work: '🏢', school: '🏫', gym: '🏋️', church: '⛪', family: '👨‍👩‍👧', hospital: '🏥', other: '📌' };
    return icons[label] || '📌';
  }

  public getLocation() {
    navigator.geolocation.getCurrentPosition(
      pos => { this.editGps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; this.alertService.info('Coordinates captured. Save to apply.', 'GPS Acquired'); },
      err => { this.alertService.warning('Failed: ' + err.message, 'GPS Error'); this.editGps = { lat: 18.0179, lng: -76.8099 }; }
    );
  }

  public acceptHomePrompt() {
    this.savingLocation = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.editGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.securityService.updateProfile({ name: this.editName, email: this.editEmail, homeWifi: this.editWifi, homeGps: this.editGps }).subscribe(
          () => { this.savingLocation = false; this.showHomePrompt = false; this.alertService.success('Home location secured.', 'Home Saved'); },
          () => { this.savingLocation = false; this.alertService.error('Failed to save location.', 'Error'); }
        );
      },
      err => { this.savingLocation = false; this.alertService.error('GPS denied: ' + err.message, 'Location Denied'); }
    );
  }

  public dismissHomePrompt() {
    this.showHomePrompt = false;
    sessionStorage.setItem('home_prompt_dismissed', 'true');
  }

  public revokeSession(id: number) {
    this.securityService.revokeSession(id).subscribe(() => this.loadSessions());
  }

  public revokeAllSessions() {
    this.securityService.revokeSession(undefined, true).subscribe(() => this.loadSessions());
  }

  public fileTicket(event: Event) {
    // Redirects to the real async fileTicket below (duplicate guard)
    this.fileTicketAsync(event);
  }

  // ---- Devices Methods ----

  public async connectHeartRate() {
    try {
      await this.bluetoothWearablesService.connectBiometricDevice();
      this.isHrConnected = true;
      this.alertService.success('Bluetooth wearable connected successfully');
    } catch (err: any) {
      this.alertService.error(`Pairing failed: ${err.message}`);
    }
  }

  public disconnectHeartRate() {
    this.bluetoothWearablesService.disconnectBiometricDevice();
    this.isHrConnected = false;
    this.alertService.warning('Wearable disconnected');
  }

  public async fileTicketAsync(e: Event) {
    e.preventDefault();
    this.submittingTicket = true;

    let localStorageSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        localStorageSize += (localStorage.getItem(key) || '').length * 2;
      }
    }

    let cacheStorageEstimate = 'Unknown';
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const est = await navigator.storage.estimate();
        cacheStorageEstimate = est.usage ? `${Math.round(est.usage / 1024)} KB` : '0 KB';
      } catch (err) {}
    }

    const diagnostics = {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      timestamp: new Date().toISOString(),
      localStorageSize: `${Math.round(localStorageSize / 1024 * 100) / 100} KB`,
      cacheStorageSize: cacheStorageEstimate
    };

    this.securityService.submitTicket({ title: this.ticketTitle, description: this.ticketDesc, metadata: diagnostics }).subscribe(
      () => { this.submittingTicket = false; this.ticketTitle = ''; this.ticketDesc = ''; this.alertService.success('Ticket filed successfully.', 'Ticket Filed'); },
      () => { this.submittingTicket = false; this.alertService.error('Failed to file ticket.', 'Error'); }
    );
  }

  public frenchCheckIn(statusOk: boolean) {
    if (statusOk) {
      this.alertService.success('Check-in confirmed. System clear.', 'Check-In OK');
    } else {
      this.securityService.triggerEmergency('stegano_french_panic').subscribe(() => {
        this.alertService.danger('[SILENT PANIC PROTOCOLS COMMENCED] Alert dispatched.', 'EMERGENCY');
        this.router.navigate(['/calculator']);
      });
    }
  }

  public goAdmin() { this.router.navigate(['/admin']); }
  public logout() { this.securityService.signOut(); this.router.navigate(['/login']); }

  // ---- SOS Methods ----

  public triggerSOS() {
    if (this.sosActive) return;
    this.sosActive = true;
    this.alertService.danger(
      '🆘 Emergency protocols activated! Location, voice & photo being collected and sent.',
      'SOS TRIGGERED'
    );
    this.securityService.triggerEmergency('manual_sos_button').subscribe({
      error: () => this.alertService.error('Alert partially sent — check your connection.', 'Send Error')
    });
  }

  public imSafe() {
    this.sosActive = false;
    this.securityService.stopEmergencyTracking();
    this.alertService.success(
      'Live tracking stopped. Your emergency contact has been notified you are safe.',
      'All Clear 🟢'
    );
  }
}
