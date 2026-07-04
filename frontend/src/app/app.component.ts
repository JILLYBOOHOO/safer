import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityService } from './services/security.service';
import { DeadPhoneTriggerService } from './services/dead-phone-trigger.service';
import { SpeechTriggerService } from './services/speech-trigger.service';
import { ThemeService } from './services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  template: `
    <app-sidebar></app-sidebar>
    <!-- Blur Overlay Filter (PWA Switcher Hardening Protection) -->
    <div *ngIf="showBlurFilter" class="switcher-blur-overlay" aria-hidden="true">
      <div class="switcher-blur-content">
        <span class="lock-shield">🔒</span>
        <p>Security Hardening Shield Enabled</p>
        <span class="subtext">Screenshots blocked | Session Protected</span>
      </div>
    </div>

    <!-- Main PWA layout container -->
    <div [class.screen-blurred]="showBlurFilter || showSteganoPush" class="main-pwa-layout" [class.has-sidebar]="!isLoginRoute()">
      <!-- Top banner displaying trigger status or warnings -->
      <div *ngIf="isTriggerAlertActive" class="trigger-alert-banner" role="alert">
        ⚠️ HIGH RISK STATE INITIATED: Device disconnected or accelerated. Locking in {{ alertCountdown }}s...
      </div>

      <router-outlet></router-outlet>
    </div>

    <!-- Stegano Push Notification Simulator -->
    <div *ngIf="showSteganoPush" class="stegano-push-container fade-in">
      <div class="stegano-push-card">
        <div class="push-header">
          <span class="push-app-name">Duolingo</span>
          <span class="push-time">Now</span>
        </div>
        <div class="push-body">
          <div class="push-icon">🦉</div>
          <div class="push-content">
            <h4>Have you practiced your French today?</h4>
            <p>You might lose your streak! 🇫🇷</p>
          </div>
        </div>
        <div class="push-actions">
          <button class="push-btn" (click)="handleStegano(true)">Oui, bien sûr!</button>
          <button class="push-btn push-btn-danger" (click)="handleStegano(false)">Non (Panic)</button>
        </div>
        <div class="push-timeout-bar" [style.width]="steganoProgress + '%'"></div>
      </div>
    </div>

    <!-- Global styled toast alert container (replaces browser alert() dialogs) -->
    <app-alert></app-alert>
  `,
  styles: [`
    .main-pwa-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: filter 0.2s ease, padding-left 0.3s ease;
    }
    .main-pwa-layout.has-sidebar {
      padding-left: 260px;
    }
    @media (max-width: 768px) {
      .main-pwa-layout.has-sidebar {
        padding-left: 0;
      }
    }
    .screen-blurred {
      filter: blur(15px);
      pointer-events: none;
    }
    .trigger-alert-banner {
      background: var(--danger);
      color: #fff;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      padding: 10px;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }
    .lock-shield {
      font-size: 48px;
      display: block;
      margin-bottom: 8px;
      animation: pulse 1.5s infinite;
    }
    .subtext {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
      display: block;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    /* Stegano Push */
    .stegano-push-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 400px;
      z-index: 10000;
    }
    .stegano-push-card {
      background: rgba(255,255,255,0.95);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      overflow: hidden;
      color: #000;
      backdrop-filter: blur(10px);
    }
    .dark-theme .stegano-push-card {
      background: rgba(30,30,30,0.95);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .push-header {
      display: flex; justify-content: space-between; padding: 12px 16px 4px;
      font-size: 11px; font-weight: 600; color: #58cc02; text-transform: uppercase;
    }
    .push-body {
      display: flex; gap: 12px; padding: 8px 16px 16px; align-items: center;
    }
    .push-icon {
      font-size: 32px; background: #58cc02; border-radius: 10px; width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center; color: white;
    }
    .push-content h4 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
    .push-content p { margin: 0; font-size: 13px; color: #666; }
    .dark-theme .push-content p { color: #aaa; }
    .push-actions {
      display: flex; border-top: 1px solid rgba(0,0,0,0.05);
    }
    .dark-theme .push-actions { border-top: 1px solid rgba(255,255,255,0.05); }
    .push-btn {
      flex: 1; background: none; border: none; padding: 12px; font-size: 14px; font-weight: 600;
      color: #3b82f6; cursor: pointer; transition: background 0.2s;
    }
    .push-btn:hover { background: rgba(0,0,0,0.05); }
    .dark-theme .push-btn:hover { background: rgba(255,255,255,0.05); }
    .push-btn-danger { color: #ef4444; border-left: 1px solid rgba(0,0,0,0.05); }
    .dark-theme .push-btn-danger { border-left: 1px solid rgba(255,255,255,0.05); }
    .push-timeout-bar { height: 3px; background: #ef4444; width: 100%; transition: width 1s linear; }
    
    .fade-in { animation: slideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes slideDown {
      from { opacity: 0; transform: translate(-50%, -20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  public showBlurFilter = false;
  public isTriggerAlertActive = false;
  public alertCountdown = 5;
  
  // Stegano Push state
  public showSteganoPush = false;
  public steganoProgress = 100;
  private steganoInterval: any;

  private idleTimeout: any;
  private countdownInterval: any;
  private subs: Subscription[] = [];

  constructor(
    private securityService: SecurityService,
    private deadPhoneService: DeadPhoneTriggerService,
    private speechService: SpeechTriggerService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.resetIdleTimer();
    this.startServices();

    // 1. Listen to focus/blur to trigger 25px app switcher protection
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);

    // 2. Listen to vocal activation trigger signals
    this.subs.push(
      this.speechService.onTriggerTripped.subscribe((phrase) => {
        console.warn(`[Vocal trigger activated]: ${phrase}`);
        this.triggerLockdownState(`Vocal phrase match: ${phrase}`);
      })
    );

    // 3. Listen to orientation/motion sensor signals
    this.subs.push(
      this.deadPhoneService.onTriggerFired.subscribe((trigger) => {
        console.warn(`[Dead phone trigger activated]: ${trigger.reason}`);
        this.triggerLockdownState(trigger.reason);
      })
    );

    // Simulate a stegano push occasionally
    setTimeout(() => {
      if (this.securityService.isLoggedIn() && !this.isLoginRoute()) {
        this.triggerSteganoPush();
      }
    }, 45000);
  }

  ngOnDestroy() {
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    this.deadPhoneService.stopMonitoring();
    this.speechService.stopListening();
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.idleTimeout);
    clearInterval(this.countdownInterval);
    clearInterval(this.steganoInterval);
  }

  // Stegano Logic
  public triggerSteganoPush() {
    this.showSteganoPush = true;
    this.steganoProgress = 100;
    
    // 30 seconds countdown
    this.steganoInterval = setInterval(() => {
      this.steganoProgress -= (100 / 300); // approx 100ms ticks = 300 ticks
      if (this.steganoProgress <= 0) {
        this.handleStegano(false); // timeout triggers panic
      }
    }, 100);
  }

  public handleStegano(isSafe: boolean) {
    this.showSteganoPush = false;
    clearInterval(this.steganoInterval);

    if (!isSafe) {
      // Panic triggered
      this.triggerLockdownState('Stegano Push Ignored or Panic Button Pressed');
    }
  }

  private triggerSilentEmergency(triggerType: string) {
    this.securityService.triggerEmergency(triggerType).subscribe();
  }

  private startServices() {
    // Only monitor inputs if a user is active
    this.securityService.currentUser$.subscribe(user => {
      if (user) {
        this.deadPhoneService.startMonitoring();
        this.speechService.startListening();
      } else {
        this.deadPhoneService.stopMonitoring();
        this.speechService.stopListening();
      }
    });
  }

  // App focus / blur tracking PWA hardening protection
  // Only activates when a user is actively logged in
  private onWindowBlur = () => {
    if (this.securityService.currentUserValue) {
      this.showBlurFilter = true;
    }
  };

  private onWindowFocus = () => {
    this.showBlurFilter = false;
    this.resetIdleTimer();
  };

  // Keyboard/mouse/touch activity monitoring (60 seconds idle timeout limit)
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:touchstart')
  @HostListener('document:scroll')
  public onUserInteraction() {
    this.resetIdleTimer();
  }

  private resetIdleTimer() {
    if (!this.securityService.currentUserValue) return;

    clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      console.warn('[Activity Idle Timer] Inactivity threshold reached (60 seconds). Locking gateway.');
      this.lockToLevelVerification(3); // Escalate to Level 3 passphrase verification
    }, 60000); // 60 seconds
  }

  /**
   * Action: Escalate validation rules and force credentials validation.
   */
  private lockToLevelVerification(level: number) {
    this.securityService.setSecurityLevel(level);
    this.securityService.purgeLocalData();
    this.router.navigate(['/login']);
  }

  /**
   * Action: Triggers silent crisis calls, enables calculator mask, and locks down database session.
   */
  private triggerLockdownState(reason: string) {
    if (this.isTriggerAlertActive) return;

    this.isTriggerAlertActive = true;
    this.alertCountdown = 5;

    // Dispatch panic trigger alerts immediately
    this.securityService.triggerEmergency(reason).subscribe();

    // 5-second countdown banner before redirecting to the calculator mask
    this.countdownInterval = setInterval(() => {
      this.alertCountdown--;
      if (this.alertCountdown <= 0) {
        clearInterval(this.countdownInterval);
        this.isTriggerAlertActive = false;
        
        // Put mock calculator authorization token
        sessionStorage.setItem('safer_duress_token', 'temp_duress_active');
        
        // Log out user locally to secure records and route observer to calculator UI
        this.securityService.purgeLocalData();
        this.router.navigate(['/calculator']);
      }
    }, 1000);
  }

  public isLoginRoute(): boolean {
    return this.router.url.startsWith('/login') || this.router.url === '/' || this.router.url === '/calculator';
  }
}
