import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlertService, AlertMessage } from '../../services/alert.service';

@Component({
  selector: 'app-alert',
  template: `
    <div class="alert-container" aria-live="polite" aria-atomic="false">
      <div
        *ngFor="let alert of alerts; trackBy: trackById"
        class="alert-toast"
        [class]="'alert-toast alert-' + alert.type"
        [class.alert-dismissing]="dismissingIds.has(alert.id)"
        role="alert"
      >
        <!-- Coloured left accent bar -->
        <div class="alert-accent"></div>

        <!-- Icon -->
        <div class="alert-icon">
          <span *ngIf="alert.type === 'success'">✅</span>
          <span *ngIf="alert.type === 'error'">❌</span>
          <span *ngIf="alert.type === 'warning'">⚠️</span>
          <span *ngIf="alert.type === 'info'">ℹ️</span>
          <span *ngIf="alert.type === 'danger'">🚨</span>
        </div>

        <!-- Content -->
        <div class="alert-body">
          <p class="alert-title">{{ alert.title }}</p>
          <p class="alert-message">{{ alert.message }}</p>
        </div>

        <!-- Close -->
        <button class="alert-close" (click)="dismiss(alert.id)" aria-label="Dismiss">✕</button>

        <!-- Progress bar (only for timed alerts) -->
        <div *ngIf="alert.duration > 0" class="alert-progress">
          <div
            class="alert-progress-bar"
            [style.animation-duration]="alert.duration + 'ms'"
          ></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .alert-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 380px;
      width: calc(100vw - 40px);
      pointer-events: none;
    }

    /* --- Base Toast --- */
    .alert-toast {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 42px 18px 14px;
      border-radius: 12px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow:
        0 8px 32px rgba(0,0,0,0.45),
        0 2px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.06);
      pointer-events: all;
      overflow: hidden;
      animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .alert-toast.alert-dismissing {
      animation: slideOut 0.3s ease-in forwards;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(110%) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
        max-height: 120px;
        margin-bottom: 0;
      }
      to {
        opacity: 0;
        transform: translateX(110%) scale(0.92);
        max-height: 0;
        margin-bottom: -12px;
        padding-top: 0;
        padding-bottom: 0;
      }
    }

    /* --- Left accent bar --- */
    .alert-accent {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 12px 0 0 12px;
    }

    /* --- Per-type theming --- */
    .alert-success {
      background: rgba(17, 34, 17, 0.92);
    }
    .alert-success .alert-accent { background: #22c55e; }
    .alert-success .alert-title { color: #4ade80; }
    .alert-success .alert-progress-bar { background: #22c55e; }

    .alert-error {
      background: rgba(34, 10, 10, 0.92);
    }
    .alert-error .alert-accent { background: #ef4444; }
    .alert-error .alert-title { color: #f87171; }
    .alert-error .alert-progress-bar { background: #ef4444; }

    .alert-warning {
      background: rgba(30, 22, 5, 0.92);
    }
    .alert-warning .alert-accent { background: #f59e0b; }
    .alert-warning .alert-title { color: #fbbf24; }
    .alert-warning .alert-progress-bar { background: #f59e0b; }

    .alert-info {
      background: rgba(5, 18, 34, 0.92);
    }
    .alert-info .alert-accent { background: #38bdf8; }
    .alert-info .alert-title { color: #7dd3fc; }
    .alert-info .alert-progress-bar { background: #38bdf8; }

    .alert-danger {
      background: rgba(40, 5, 5, 0.96);
      border-color: rgba(239, 68, 68, 0.4);
      animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                 dangerPulse 1.2s ease-in-out 0.4s infinite;
    }
    .alert-danger .alert-accent { background: linear-gradient(180deg, #ef4444, #dc2626); }
    .alert-danger .alert-title { color: #fca5a5; font-size: 13px; letter-spacing: 0.5px; }
    .alert-danger .alert-progress-bar { background: #ef4444; }

    @keyframes dangerPulse {
      0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 0 rgba(239,68,68,0); }
      50% { box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 6px rgba(239,68,68,0.2); }
    }

    /* --- Icon --- */
    .alert-icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* --- Body --- */
    .alert-body {
      flex: 1;
      min-width: 0;
    }
    .alert-title {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px;
    }
    .alert-message {
      font-size: 13px;
      color: rgba(255,255,255,0.75);
      line-height: 1.5;
      margin: 0;
      word-break: break-word;
    }

    /* --- Close button --- */
    .alert-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.4);
      font-size: 12px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.15s, background 0.15s;
    }
    .alert-close:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.1);
    }

    /* --- Progress bar --- */
    .alert-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(255,255,255,0.05);
    }
    .alert-progress-bar {
      height: 100%;
      border-radius: 0 0 12px 12px;
      animation: progressShrink linear forwards;
      transform-origin: left;
    }
    @keyframes progressShrink {
      from { width: 100%; }
      to { width: 0%; }
    }

    /* Mobile */
    @media (max-width: 480px) {
      .alert-container {
        top: 12px;
        right: 12px;
        left: 12px;
        width: auto;
        max-width: 100%;
      }
    }
  `]
})
export class AlertComponent implements OnInit, OnDestroy {
  public alerts: AlertMessage[] = [];
  public dismissingIds = new Set<number>();
  private timers = new Map<number, any>();
  private subs: Subscription[] = [];

  constructor(private alertService: AlertService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.subs.push(
      this.alertService.alerts$.subscribe(alert => {
        this.alerts.push(alert);
        if (alert.duration > 0) {
          const timer = setTimeout(() => this.dismiss(alert.id), alert.duration);
          this.timers.set(alert.id, timer);
        }
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.alertService.dismiss$.subscribe(id => this.dismiss(id))
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.timers.forEach(t => clearTimeout(t));
  }

  public dismiss(id: number) {
    if (this.dismissingIds.has(id)) return;
    this.dismissingIds.add(id);
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.cdr.detectChanges();

    // Remove from array after exit animation
    setTimeout(() => {
      this.alerts = this.alerts.filter(a => a.id !== id);
      this.dismissingIds.delete(id);
      this.cdr.detectChanges();
    }, 320);
  }

  public trackById(_: number, alert: AlertMessage) {
    return alert.id;
  }
}
