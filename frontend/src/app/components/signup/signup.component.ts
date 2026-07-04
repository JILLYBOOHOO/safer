import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { AlertService } from '../../services/alert.service';
import { ThemeService } from '../../services/theme.service';

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

type WizardStep = 'info' | 'method' | 'safe' | 'duress' | 'biometric' | 'done';
type AuthMethod = 'passcode' | 'pattern' | 'biometric';

@Component({
  selector: 'app-signup',
  template: `
<main class="wizard-shell">
  <div class="signup-wrapper" style="display:flex; align-items:flex-start;">
    <div class="sidebar" style="margin-right:16px;">
      <div class="theme-toggle">
        <select (change)="onThemeChange($event.target.value)">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <ul class="signup-features-list" style="margin-top:24px; color:#e0e0e0; font-size:14px; line-height:1.5;">
        <li>🚨 Emergency Response (Silent Panic PIN, SOS, Safe Walk)</li>
        <li>🎥 Evidence Collection (photos, video, audio, timeline)</li>
        <li>👥 Guardian Network (trusted contacts, live tracking)</li>
        <li>🤖 Smart Safety (route monitoring, check-ins, fall detection)</li>
        <li>🏠 Home Monitoring (AI camera integration and alerts)</li>
      </ul>
    </div>
    <div class="wizard-card glass-panel">

    <!-- Progress Dots -->
    <div class="step-dots">
      <span class="dot" [class.active]="stepIndex >= 0" [class.done]="stepIndex > 0"></span>
      <span class="dot-line" [class.filled]="stepIndex > 0"></span>
      <span class="dot" [class.active]="stepIndex >= 1" [class.done]="stepIndex > 1"></span>
      <span class="dot-line" [class.filled]="stepIndex > 1"></span>
      <span class="dot" [class.active]="stepIndex >= 2" [class.done]="stepIndex > 2"></span>
      <span class="dot-line" [class.filled]="stepIndex > 2"></span>
      <span class="dot" [class.active]="stepIndex >= 3" [class.done]="stepIndex > 3"></span>
      <span *ngIf="authMethod === 'biometric'">
        <span class="dot-line" [class.filled]="stepIndex > 3"></span>
        <span class="dot" [class.active]="stepIndex >= 4" [class.done]="stepIndex > 4"></span>
      </span>
    </div>

    <!-- ===== STEP 1: Personal Info ===== -->
    <div *ngIf="step === 'info'" class="step-body" [@slide]>
      <div class="step-icon">👤</div>
      <h2 class="step-title">Create Your Account</h2>
      <p class="step-sub">Fill in your details to get started</p>

      <form class="info-form" (submit)="goToMethod($event)">
        <div class="form-row two-col">
          <div class="form-group">
            <label for="s-name">Full Name *</label>
            <input id="s-name" type="text" class="input-accessible" [(ngModel)]="name" name="name" required placeholder="e.g. Jane Doe" />
          </div>
          <div class="form-group">
            <label for="s-age">Age</label>
            <input id="s-age" type="number" class="input-accessible" [(ngModel)]="age" name="age" min="13" max="120" placeholder="e.g. 28" />
          </div>
        </div>

        <div class="form-group">
          <label for="s-email">Email Address *</label>
          <input id="s-email" type="email" class="input-accessible" [(ngModel)]="email" name="email" required placeholder="you@example.com" />
        </div>

        <div class="form-group">
        <div class="form-group">
          <label for="s-phone">Phone Number <span class="optional-tag">(for emergency alerts)</span></label>
          <input id="s-phone" type="tel" class="input-accessible" [(ngModel)]="phone" name="phone" placeholder="+1 876 555 0000" />
        </div>
        <div class="form-group">
          <label for="s-emergency">Emergency Contact(s)</label>
          <input id="s-emergency" type="text" class="input-accessible" [(ngModel)]="emergencyContact" name="emergencyContact" placeholder="e.g. Jane Doe +1 555-1234" />
        </div>
        <div class="form-group">
          <label for="s-allergies">Allergies</label>
          <input id="s-allergies" type="text" class="input-accessible" [(ngModel)]="allergies" name="allergies" placeholder="e.g. Peanuts, Penicillin" />
        </div>
        <div class="form-group">
          <label for="s-conditions">Medical Conditions</label>
          <input id="s-conditions" type="text" class="input-accessible" [(ngModel)]="medicalConditions" name="medicalConditions" placeholder="e.g. Diabetes" />
        </div>
        <div class="form-group">
          <label for="s-blood">Blood Type</label>
          <input id="s-blood" type="text" class="input-accessible" [(ngModel)]="bloodType" name="bloodType" placeholder="e.g. O+" />
        </div>
        <div class="form-group">
          <label for="s-doctor">Preferred Doctor</label>
          <input id="s-doctor" type="text" class="input-accessible" [(ngModel)]="preferredDoctor" name="preferredDoctor" placeholder="Doctor name or clinic" />
        </div>
        <div class="form-group">
          <label for="s-medication">Current Medication</label>
          <input id="s-medication" type="text" class="input-accessible" [(ngModel)]="currentMedication" name="currentMedication" placeholder="e.g. Metformin" />
        </div>
        </div>

        <div class="form-group">
          <label for="s-pass">Password *</label>
          <div class="input-with-toggle">
            <input
              id="s-pass"
              [type]="showPassword ? 'text' : 'password'"
              class="input-accessible"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="Choose a strong password"
            />
            <button type="button" class="toggle-vis" (click)="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <button type="submit" class="btn-accessible btn-primary full-width cta-btn" [disabled]="checkingEmail">
          {{ checkingEmail ? 'Verifying...' : 'Continue →' }}
        </button>
        <p class="already-have">Already registered? <a (click)="goToLogin()">Sign in</a></p>
      </form>
    </div>

    <!-- ===== STEP 2: Choose Auth Method ===== -->
    <div *ngIf="step === 'method'" class="step-body">
      <div class="step-icon">🔐</div>
      <h2 class="step-title">How do you want to unlock?</h2>
      <p class="step-sub">Choose the method you'll use to log in every day</p>

      <div class="method-cards">
        <button class="method-card" [class.selected]="authMethod === 'passcode'" (click)="selectMethod('passcode')">
          <span class="method-icon">🔢</span>
          <span class="method-name">Passcode</span>
          <span class="method-desc">Quick 4-digit PIN</span>
        </button>

        <button class="method-card" [class.selected]="authMethod === 'pattern'" (click)="selectMethod('pattern')">
          <span class="method-icon">🔵</span>
          <span class="method-name">Pattern</span>
          <span class="method-desc">Draw a shape to unlock</span>
        </button>

        <button
          class="method-card"
          [class.selected]="authMethod === 'biometric'"
          [class.unavailable]="!biometricAvailable"
          (click)="selectMethod('biometric')"
          [disabled]="!biometricAvailable"
        >
          <span class="method-icon">{{ biometricIcon }}</span>
          <span class="method-name">Biometric</span>
          <span class="method-desc">{{ biometricAvailable ? biometricLabel : 'Not available on this device' }}</span>
        </button>
      </div>

      <button class="btn-accessible btn-primary full-width cta-btn" [disabled]="!authMethod" (click)="goToSafe()">
        Continue →
      </button>
      <button class="btn-accessible btn-ghost full-width" (click)="step = 'info'">← Back</button>
    </div>

    <!-- ===== STEP 3: Safe Unlock ===== -->
    <div *ngIf="step === 'safe'" class="step-body">
      <div class="step-icon">✅</div>
      <h2 class="step-title">Set Your Safe Unlock</h2>
      <p class="step-sub safe-desc">This opens your dashboard normally. Keep it private.</p>

      <!-- Passcode PIN pad -->
      <ng-container *ngIf="authMethod === 'passcode' || authMethod === 'biometric'">
        <p class="pin-hint">{{ safeStepPhase === 'initial' ? 'Choose a 4-digit passcode' : 'Confirm your passcode' }}</p>
        <div class="pin-dots-row">
          <span class="pin-dot" [class.filled]="(safeStepPhase === 'initial' ? safePin : safePinConfirm).length > 0"></span>
          <span class="pin-dot" [class.filled]="(safeStepPhase === 'initial' ? safePin : safePinConfirm).length > 1"></span>
          <span class="pin-dot" [class.filled]="(safeStepPhase === 'initial' ? safePin : safePinConfirm).length > 2"></span>
          <span class="pin-dot" [class.filled]="(safeStepPhase === 'initial' ? safePin : safePinConfirm).length > 3"></span>
        </div>
        <div class="pin-pad">
          <button *ngFor="let n of [1,2,3,4,5,6,7,8,9]" class="pin-btn" (click)="pinPress(n, 'safe')">{{ n }}</button>
          <button class="pin-btn pin-clear" (click)="clearPin('safe')">C</button>
          <button class="pin-btn" (click)="pinPress(0, 'safe')">0</button>
          <button class="pin-btn pin-back" (click)="backspacePin('safe')">⌫</button>
        </div>
        <button class="btn-accessible btn-primary full-width cta-btn" 
                [disabled]="(safeStepPhase === 'initial' ? safePin : safePinConfirm).length < 4" 
                (click)="advanceSafeStep()">
          {{ safeStepPhase === 'initial' ? 'Continue →' : 'Confirm & Proceed →' }}
        </button>
      </ng-container>

      <!-- Pattern -->
      <ng-container *ngIf="authMethod === 'pattern'">
        <p class="pin-hint">{{ safeStepPhase === 'initial' ? 'Draw a pattern to use as your safe unlock' : 'Draw pattern again to confirm' }}</p>
        <div *ngIf="safeStepPhase === 'initial' && safePattern" class="pattern-set-badge">✅ Pattern recorded</div>
        <div *ngIf="safeStepPhase === 'confirm' && safePatternConfirm" class="pattern-set-badge">✅ Pattern confirmed</div>
        
        <app-pattern-lock [resetOnEnd]="true" (onPatternComplete)="onSafePatternDrawn($event)"></app-pattern-lock>
        
        <div class="keyboard-entry">
          <label>Or type pattern sequence (1-9):</label>
          <input *ngIf="safeStepPhase === 'initial'" type="text" class="input-accessible" [(ngModel)]="safePattern" placeholder="e.g. 1479" maxlength="9" />
          <input *ngIf="safeStepPhase === 'confirm'" type="text" class="input-accessible" [(ngModel)]="safePatternConfirm" placeholder="Confirm sequence" maxlength="9" />
        </div>
        
        <button class="btn-accessible btn-primary full-width cta-btn" 
                [disabled]="(safeStepPhase === 'initial' ? safePattern : safePatternConfirm).length < 4" 
                (click)="advanceSafeStep()">
          {{ safeStepPhase === 'initial' ? 'Continue →' : 'Confirm & Proceed →' }}
        </button>
      </ng-container>

      <button class="btn-accessible btn-ghost full-width" (click)="step = 'method'">← Back</button>
    </div>

    <!-- ===== STEP 4: Duress Unlock ===== -->
    <div *ngIf="step === 'duress'" class="step-body">
      <div class="step-icon">🚨</div>
      <h2 class="step-title">Set Your Emergency Code</h2>
      <p class="step-sub danger-desc">
        If you're ever <strong>threatened or forced</strong> to unlock, use this code instead.
        It silently alerts your emergency contacts without the attacker knowing.
      </p>

      <!-- Passcode PIN pad -->
      <ng-container *ngIf="authMethod === 'passcode' || authMethod === 'biometric'">
        <p class="pin-hint" style="color: #facc15">
          {{ duressStepPhase === 'initial' ? 'Choose a different 4-digit emergency code' : 'Confirm your emergency code' }}
        </p>
        <div class="pin-dots-row duress">
          <span class="pin-dot" [class.filled]="(duressStepPhase === 'initial' ? duressPin : duressPinConfirm).length > 0"></span>
          <span class="pin-dot" [class.filled]="(duressStepPhase === 'initial' ? duressPin : duressPinConfirm).length > 1"></span>
          <span class="pin-dot" [class.filled]="(duressStepPhase === 'initial' ? duressPin : duressPinConfirm).length > 2"></span>
          <span class="pin-dot" [class.filled]="(duressStepPhase === 'initial' ? duressPin : duressPinConfirm).length > 3"></span>
        </div>
        <div class="pin-pad">
          <button *ngFor="let n of [1,2,3,4,5,6,7,8,9]" class="pin-btn" (click)="pinPress(n, 'duress')">{{ n }}</button>
          <button class="pin-btn pin-clear" (click)="clearPin('duress')">C</button>
          <button class="pin-btn" (click)="pinPress(0, 'duress')">0</button>
          <button class="pin-btn pin-back" (click)="backspacePin('duress')">⌫</button>
        </div>
        <button class="btn-accessible btn-electric-blue full-width cta-btn" 
                [disabled]="(duressStepPhase === 'initial' ? duressPin : duressPinConfirm).length < 4 || registering" 
                (click)="advanceDuressStep()">
          {{ duressStepPhase === 'initial' ? 'Continue →' : (registering ? 'Saving...' : 'Confirm & Create Account →') }}
        </button>
      </ng-container>

      <!-- Pattern -->
      <ng-container *ngIf="authMethod === 'pattern'">
        <p class="pin-hint" style="color: #facc15">
          {{ duressStepPhase === 'initial' ? 'Draw a different emergency pattern' : 'Draw emergency pattern again to confirm' }}
        </p>
        <div *ngIf="duressStepPhase === 'initial' && duressPattern" class="pattern-set-badge danger">🚨 Emergency pattern recorded</div>
        <div *ngIf="duressStepPhase === 'confirm' && duressPatternConfirm" class="pattern-set-badge danger">🚨 Emergency pattern confirmed</div>
        
        <app-pattern-lock [resetOnEnd]="true" (onPatternComplete)="onDuressPatternDrawn($event)"></app-pattern-lock>
        
        <div class="keyboard-entry">
          <label>Or type pattern sequence (1-9):</label>
          <input *ngIf="duressStepPhase === 'initial'" type="text" class="input-accessible" [(ngModel)]="duressPattern" placeholder="e.g. 9631" maxlength="9" />
          <input *ngIf="duressStepPhase === 'confirm'" type="text" class="input-accessible" [(ngModel)]="duressPatternConfirm" placeholder="Confirm sequence" maxlength="9" />
        </div>
        <button class="btn-accessible btn-electric-blue full-width cta-btn" 
                [disabled]="(duressStepPhase === 'initial' ? duressPattern : duressPatternConfirm).length < 4 || registering" 
                (click)="advanceDuressStep()">
          {{ duressStepPhase === 'initial' ? 'Continue →' : (registering ? 'Saving...' : 'Confirm & Create Account →') }}
        </button>
      </ng-container>

      <button class="btn-accessible btn-ghost full-width" (click)="step = 'safe'">← Back</button>
    </div>

    <!-- ===== STEP 5: Biometric Enroll ===== -->
    <div *ngIf="step === 'biometric'" class="step-body">
      <div class="step-icon" style="animation: pulse-icon 2s ease-in-out infinite">{{ biometricIcon }}</div>
      <h2 class="step-title">Register Your Biometric</h2>
      <p class="step-sub">
        Your device will prompt you to scan your {{ biometricLabel }}. This means you won't need to type anything to log in next time.
      </p>

      <div class="enroll-status" [class.success]="biometricEnrolled" [class.error]="!!biometricError">
        <ng-container *ngIf="!biometricEnrolling && !biometricEnrolled && !biometricError">
          👇 Tap the button below to scan
        </ng-container>
        <ng-container *ngIf="biometricEnrolling">⏳ Waiting for your scan...</ng-container>
        <ng-container *ngIf="biometricEnrolled">✅ {{ biometricLabel }} registered! You're all set.</ng-container>
        <ng-container *ngIf="biometricError">⚠️ {{ biometricError }}</ng-container>
      </div>

      <button *ngIf="!biometricEnrolled" class="btn-accessible btn-primary full-width cta-btn" [disabled]="biometricEnrolling" (click)="enrollBiometric()">
        {{ biometricEnrolling ? 'Scanning...' : 'Scan ' + biometricLabel }}
      </button>
      <button class="btn-accessible btn-ghost full-width" (click)="goToDone()">
        {{ biometricEnrolled ? 'Continue to Login →' : 'Skip for now' }}
      </button>
    </div>

    <!-- ===== STEP: Done ===== -->
    <div *ngIf="step === 'done'" class="step-body done-step">
      <div class="done-icon">🎉</div>
      <h2 class="step-title">You're all set!</h2>
      <p class="step-sub">Your secure profile has been created. Log in to get started.</p>
      <div class="done-method-badge">
        Unlock method: <strong>{{ methodLabel }}</strong>
      </div>
      <button class="btn-accessible btn-primary full-width cta-btn" (click)="goToLogin()">
        Go to Login →
      </button>
    </div>

  </div>
</main>
  `,
  styles: [`
    .wizard-shell {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 24px 16px 48px;
      background: var(--bg-deep, #0a0a0f);
    }
    .wizard-card {
  width: 100%;
  max-width: 560px;
  padding: 36px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 20px;
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  position: relative;
}

    /* Progress dots */
    .step-dots {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-bottom: 28px;
    }
    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      border: 2px solid rgba(255,255,255,0.15);
      transition: all 0.3s;
      flex-shrink: 0;
    }
    .dot.active { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 8px var(--primary); }
    .dot.done { background: var(--success); border-color: var(--success); }
    .dot-line {
      height: 2px; width: 28px;
      background: rgba(255,255,255,0.1);
      transition: background 0.3s;
      flex-shrink: 0;
    }
    .dot-line.filled { background: var(--primary); }
.theme-toggle { margin-bottom: 12px; }

.sidebar { display: flex; flex-direction: column; align-items: flex-start; }



    /* Step body */
    .step-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
    .step-icon {
      font-size: 48px;
      line-height: 1;
      margin-bottom: 4px;
    }
    @keyframes pulse-icon {
      0%,100% { transform: scale(1); }
      50% { transform: scale(1.1); filter: drop-shadow(0 0 16px var(--primary)); }
    }
    .step-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    .step-sub {
      font-size: 14px;
      color: var(--text-primary);
      line-height: 1.55;
      margin: 0;
      max-width: 340px;
    }
    .safe-desc { color: #4ade80; }
    .danger-desc { color: #facc15; }

    /* Info form */
    .info-form { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 14px; }
    .form-row { display: flex; gap: 12px; }
    .two-col > .form-group { flex: 1; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .optional-tag { font-weight: 400; opacity: 0.65; font-size: 11px; }
    .input-with-toggle { position: relative; }
    .input-with-toggle .input-accessible { padding-right: 44px; }
    .toggle-vis {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 4px;
    }
    .already-have { font-size: 13px; color: var(--text-secondary); text-align: center; margin: 4px 0 0; }
    .already-have a { color: var(--primary); cursor: pointer; text-decoration: underline; }

    /* Method cards */
    .method-cards { display: flex; flex-direction: column; gap: 12px; width: 100%; }
    .method-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255,255,255,0.04);
      border: 2px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: all 0.2s;
      color: var(--text-primary);
    }
    .method-card:hover:not(:disabled) {
      background: rgba(56,189,248,0.06);
      border-color: rgba(56,189,248,0.3);
    }
    .method-card.selected {
      background: rgba(56,189,248,0.1);
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }
    .method-card.unavailable { opacity: 0.4; cursor: not-allowed; }
    .method-icon { font-size: 28px; flex-shrink: 0; }
    .method-name { font-weight: 700; font-size: 15px; display: block; }
    .method-desc { font-size: 12px; color: var(--text-secondary); display: block; margin-top: 2px; }

    /* PIN pad */
    .pin-hint { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .pin-dots-row {
      display: flex; gap: 16px; justify-content: center;
      margin: 4px 0;
    }
    .pin-dot {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.25);
      background: transparent;
      transition: all 0.2s;
    }
    .pin-dot.filled {
      background: var(--primary);
      border-color: var(--primary);
      box-shadow: 0 0 8px var(--primary);
    }
    .pin-dots-row.duress .pin-dot.filled {
      background: var(--danger);
      border-color: var(--danger);
      box-shadow: 0 0 8px var(--danger);
    }
    .pin-pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 280px;
    }
    .pin-btn {
      aspect-ratio: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      font-size: 22px;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 64px;
    }
    .pin-btn:active { background: rgba(56,189,248,0.15); transform: scale(0.93); }
    .pin-clear { font-size: 14px; color: var(--danger); }
    .pin-back { font-size: 18px; }

    /* Pattern extras */
    .pattern-set-badge {
      font-size: 12px;
      background: rgba(34,197,94,0.1);
      border: 1px solid var(--success);
      color: var(--success);
      padding: 6px 14px;
      border-radius: 8px;
      width: 100%;
    }
    .pattern-set-badge.danger {
      background: rgba(239,68,68,0.1);
      border-color: var(--danger);
      color: var(--danger);
    }
    .keyboard-entry { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; }
    .keyboard-entry label { font-size: 12px; color: var(--text-secondary); }

    /* Biometric enroll status */
    .enroll-status {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255,255,255,0.04);
      border: 1px dashed rgba(255,255,255,0.15);
      border-radius: 10px;
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .enroll-status.success { background: rgba(34,197,94,0.1); border-color: var(--success); color: var(--success); }
    .enroll-status.error { background: rgba(239,68,68,0.1); border-color: var(--danger); color: var(--danger); }

    /* Done step */
    .done-step { padding: 16px 0; }
    .done-icon { font-size: 64px; animation: bounce 0.8s ease; }
    @keyframes bounce {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
    .done-method-badge {
      background: rgba(56,189,248,0.08);
      border: 1px solid rgba(56,189,248,0.2);
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .done-method-badge strong { color: var(--primary); }

    /* CTA / buttons */
    .cta-btn { margin-top: 4px; }
    .full-width { width: 100%; }
    .btn-ghost {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-secondary);
      padding: 12px 20px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: var(--text-primary); }
    .btn-danger {
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff;
      border: none;
      padding: 14px 20px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-danger:hover { filter: brightness(1.1); }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-electric-blue {
      background: #3B82F6;
      color: #fff;
      border: none;
      padding: 14px 20px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-electric-blue:hover { background: #2563eb; }
    .btn-electric-blue:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class SignupComponent implements OnInit {
  public step: WizardStep = 'info';

  // Step 1 data
  public name = '';
  public email = '';
  public age: number | null = null;
  public phone = '';
  public password = '';
  public emergencyContact = '';
  public allergies = '';
  public medicalConditions = '';
  public bloodType = '';
  public preferredDoctor = '';
  public currentMedication = '';
  public showPassword = false;
  public checkingEmail = false;

  // Step 2
  public authMethod: AuthMethod | null = null;

  // Step 3 & 4 — passcode/biometric path
  public safePin = '';
  public safePinConfirm = '';
  public duressPin = '';
  public duressPinConfirm = '';

  // Step 3 & 4 — pattern path
  public safePattern = '';
  public safePatternConfirm = '';
  public duressPattern = '';
  public duressPatternConfirm = '';

  // Step Phases
  public safeStepPhase: 'initial' | 'confirm' = 'initial';
  public duressStepPhase: 'initial' | 'confirm' = 'initial';

  // Biometric
  public biometricAvailable = false;
  public biometricType: 'fingerprint' | 'faceid' | 'platform' = 'platform';
  public biometricEnrolling = false;
  public biometricEnrolled = false;
  public biometricError = '';

  public registering = false;

  constructor(
    private securityService: SecurityService,
    private router: Router,
    private zone: NgZone,
    private alertService: AlertService,
    private themeService: ThemeService
  ) {}

    public onThemeChange(theme: string) {
    this.themeService.setTheme(theme as 'light' | 'dark');
  }

  ngOnInit() {
    this.detectBiometric();
  }

  get stepIndex(): number {
    const map: Record<WizardStep, number> = { info: 0, method: 1, safe: 2, duress: 3, biometric: 4, done: 4 };
    return map[this.step];
  }

  get methodLabel(): string {
    const labels: Record<AuthMethod, string> = { passcode: '4-Digit Passcode', pattern: 'Pattern Lock', biometric: this.biometricLabel };
    return this.authMethod ? labels[this.authMethod] : 'Unknown';
  }

  get biometricIcon(): string {
    return this.biometricType === 'faceid' ? '🔍' : this.biometricType === 'fingerprint' ? '👆' : '🔐';
  }

  get biometricLabel(): string {
    return this.biometricType === 'faceid' ? 'Face ID' : this.biometricType === 'fingerprint' ? 'Fingerprint' : 'Biometric';
  }

  private async detectBiometric(): Promise<void> {
    try {
      if (typeof PublicKeyCredential !== 'undefined' &&
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        this.zone.run(() => {
          this.biometricAvailable = available;
          if (available) {
            const ua = navigator.userAgent.toLowerCase();
            if (/iphone|ipad/.test(ua)) this.biometricType = 'faceid';
            else if (/android/.test(ua)) this.biometricType = 'fingerprint';
            else if (/mac/.test(ua)) this.biometricType = 'faceid';
            else this.biometricType = 'platform';
          }
        });
      }
    } catch { this.biometricAvailable = false; }
  }

  public goToMethod(e: Event) {
    e.preventDefault();
    if (!this.name.trim() || !this.email.trim() || !this.password.trim()) {
      this.alertService.warning('Please fill in your name, email and password to continue.', 'Required Fields Missing');
      return;
    }
    if (this.password.length < 6) {
      this.alertService.warning('Password must be at least 6 characters.', 'Weak Password');
      return;
    }
    
    this.checkingEmail = true;
    this.securityService.checkEmail(this.email.trim().toLowerCase()).subscribe(
      res => {
        this.checkingEmail = false;
        if (res.exists) {
          this.alertService.danger('This email is already registered. Please log in instead.', 'Account Exists');
        } else {
          this.step = 'method';
        }
      },
      err => {
        this.checkingEmail = false;
        this.alertService.error('Could not verify email address. Please try again.', 'Connection Error');
      }
    );
  }

  public selectMethod(m: AuthMethod) {
    if (m === 'biometric' && !this.biometricAvailable) return;
    this.authMethod = m;
  }

  public goToSafe() {
    if (!this.authMethod) return;
    this.safeStepPhase = 'initial';
    this.safePin = '';
    this.safePinConfirm = '';
    this.safePattern = '';
    this.safePatternConfirm = '';
    this.step = 'safe';
  }

  public pinPress(n: number, target: 'safe' | 'duress') {
    if (target === 'safe') {
      if (this.safeStepPhase === 'initial' && this.safePin.length < 4) this.safePin += n;
      if (this.safeStepPhase === 'confirm' && this.safePinConfirm.length < 4) this.safePinConfirm += n;
    } else {
      if (this.duressStepPhase === 'initial' && this.duressPin.length < 4) this.duressPin += n;
      if (this.duressStepPhase === 'confirm' && this.duressPinConfirm.length < 4) this.duressPinConfirm += n;
    }
  }

  public clearPin(target: 'safe' | 'duress') {
    if (target === 'safe') {
      this.safeStepPhase === 'initial' ? this.safePin = '' : this.safePinConfirm = '';
    } else {
      this.duressStepPhase === 'initial' ? this.duressPin = '' : this.duressPinConfirm = '';
    }
  }

  public backspacePin(target: 'safe' | 'duress') {
    if (target === 'safe') {
      this.safeStepPhase === 'initial' 
        ? this.safePin = this.safePin.slice(0, -1) 
        : this.safePinConfirm = this.safePinConfirm.slice(0, -1);
    } else {
      this.duressStepPhase === 'initial' 
        ? this.duressPin = this.duressPin.slice(0, -1) 
        : this.duressPinConfirm = this.duressPinConfirm.slice(0, -1);
    }
  }

  public onSafePatternDrawn(p: string) {
    if (this.safeStepPhase === 'initial') {
      this.safePattern = p;
    } else {
      this.safePatternConfirm = p;
    }
  }

  public advanceSafeStep() {
    if (this.safeStepPhase === 'initial') {
      this.safeStepPhase = 'confirm';
    } else {
      // Validate confirm
      const code1 = this.authMethod === 'pattern' ? this.safePattern : this.safePin;
      const code2 = this.authMethod === 'pattern' ? this.safePatternConfirm : this.safePinConfirm;
      
      if (code1 !== code2) {
        this.alertService.error('The codes did not match. Please try again.', 'Mismatch');
        this.safeStepPhase = 'initial';
        this.safePin = '';
        this.safePinConfirm = '';
        this.safePattern = '';
        this.safePatternConfirm = '';
        return;
      }
      this.goToDuress();
    }
  }

  public onDuressPatternDrawn(p: string) {
    if (this.duressStepPhase === 'initial') {
      const safe = this.authMethod === 'pattern' ? this.safePattern : this.safePin;
      if (p === safe) {
        this.alertService.warning('Your emergency code cannot be the same as your safe unlock.', 'Duplicate Code');
        return;
      }
      this.duressPattern = p;
    } else {
      this.duressPatternConfirm = p;
    }
  }

  public advanceDuressStep() {
    if (this.duressStepPhase === 'initial') {
      const safe = this.authMethod === 'pattern' ? this.safePattern : this.safePin;
      const currentDuress = this.authMethod === 'pattern' ? this.duressPattern : this.duressPin;
      
      if (currentDuress === safe) {
        this.alertService.warning('Your emergency code must be different from your safe unlock code.', 'Duplicate Code');
        return;
      }
      this.duressStepPhase = 'confirm';
    } else {
      // Validate confirm
      const code1 = this.authMethod === 'pattern' ? this.duressPattern : this.duressPin;
      const code2 = this.authMethod === 'pattern' ? this.duressPatternConfirm : this.duressPinConfirm;
      
      if (code1 !== code2) {
        this.alertService.error('The emergency codes did not match. Please try again.', 'Mismatch');
        this.duressStepPhase = 'initial';
        this.duressPin = '';
        this.duressPinConfirm = '';
        this.duressPattern = '';
        this.duressPatternConfirm = '';
        return;
      }
      this.submitRegistration();
    }
  }

  public goToDuress() {
    this.duressStepPhase = 'initial';
    this.duressPin = '';
    this.duressPinConfirm = '';
    this.duressPattern = '';
    this.duressPatternConfirm = '';
    this.step = 'duress';
  }

  public submitRegistration() {
    // Validate duress code ≠ safe code
    const safeCode = this.authMethod === 'pattern' ? this.safePattern : this.safePin;
    const duressCode = this.authMethod === 'pattern' ? this.duressPattern : this.duressPin;

    if (duressCode === safeCode) {
      this.alertService.warning('Your emergency code must be different from your safe unlock code.', 'Duplicate Code');
      return;
    }

    this.registering = true;

    // For biometric/passcode: store PIN locally for auto-login
    if (this.authMethod === 'passcode' || this.authMethod === 'biometric') {
      localStorage.setItem(`safer_auth_method_${this.email}`, this.authMethod);
      // Store PIN securely (in production: device secure enclave)
      if (this.authMethod === 'biometric') {
        localStorage.setItem(`safer_safe_pin_${this.email}`, this.safePin);
        localStorage.setItem(`safer_duress_pin_${this.email}`, this.duressPin);
      }
    } else {
      localStorage.setItem(`safer_auth_method_${this.email}`, 'pattern');
    }

    this.securityService.signUp({
      name: this.name,
      email: this.email,
      password: this.password,
      safePattern: safeCode,
      duressPattern: duressCode,
      phone: this.phone || undefined,
      age: this.age || undefined,
      emergencyContact: this.emergencyContact || undefined,
      allergies: this.allergies || undefined,
      medicalConditions: this.medicalConditions || undefined,
      bloodType: this.bloodType || undefined,
      preferredDoctor: this.preferredDoctor || undefined,
      currentMedication: this.currentMedication || undefined,
      authMethod: this.authMethod || 'passcode'
    } as any).subscribe(
      () => {
        if (this.authMethod === 'biometric') {
          this.step = 'biometric';
        } else {
          this.alertService.success('Account created successfully! Log in to get started.', 'Welcome to Safer!');
          this.step = 'done';
        }
      },
      err => {
        this.registering = false;
        const msg = err.error?.message || 'Registration failed. Please try again.';
        this.alertService.error(msg, 'Registration Error');
      }
    );
  }

  public async enrollBiometric(): Promise<void> {
    this.biometricError = '';
    this.biometricEnrolling = true;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(this.email);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Safer Security', id: window.location.hostname },
          user: { id: userId, name: this.email, displayName: this.name },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      } as CredentialCreationOptions) as PublicKeyCredential | null;

      this.zone.run(() => {
        this.biometricEnrolling = false;
        if (credential) {
          const credId = bufferToBase64url(credential.rawId);
          localStorage.setItem(`safer_biometric_cred_${this.email}`, credId);
          this.biometricEnrolled = true;
          this.alertService.success(`${this.biometricLabel} registered! Log in with a single tap.`, 'Biometric Active');
        } else {
          this.biometricError = 'Enrollment cancelled.';
        }
      });
    } catch (err: any) {
      this.zone.run(() => {
        this.biometricEnrolling = false;
        if (err.name === 'NotAllowedError') {
          this.biometricError = 'Prompt dismissed. You can enable biometric from your profile settings later.';
        } else if (err.name === 'InvalidStateError') {
          this.biometricError = 'A credential already exists on this device.';
          this.biometricEnrolled = true;
        } else {
          this.biometricError = err.message;
          this.alertService.warning(err.message, 'Biometric Enrollment Issue');
        }
      });
    }
  }



  public goToDone() { this.step = 'done'; }
  public goToLogin() { this.router.navigate(['/login']); }
}
