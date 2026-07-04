import { Component, OnInit, OnDestroy, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-fake-call',
  template: `
    <div class="fake-call-overlay" *ngIf="visible" (click)="$event.stopPropagation()">
      <div class="call-screen">
        <!-- Incoming Call State -->
        <div class="call-content" *ngIf="!answered">
          <div class="caller-avatar-ring">
            <div class="caller-avatar">{{ callerInitial }}</div>
          </div>
          <p class="caller-label">Incoming Call</p>
          <h2 class="caller-name">{{ callerName }}</h2>
          <p class="caller-number">{{ callerNumber }}</p>

          <div class="call-actions">
            <button class="call-btn decline-btn" (click)="decline()" aria-label="Decline call">
              <span class="btn-icon">📵</span>
              <span class="btn-label">Decline</span>
            </button>
            <button class="call-btn answer-btn" (click)="answerCall()" aria-label="Answer call">
              <span class="btn-icon">📞</span>
              <span class="btn-label">Answer</span>
            </button>
          </div>
        </div>

        <!-- Answered Call State -->
        <div class="call-content" *ngIf="answered">
          <div class="caller-avatar-ring active">
            <div class="caller-avatar">{{ callerInitial }}</div>
          </div>
          <h2 class="caller-name">{{ callerName }}</h2>
          <p class="call-timer">{{ callTimerDisplay }}</p>

          <div class="in-call-grid">
            <button class="grid-btn" (click)="toggleMute()">
              <span>{{ muted ? '🔇' : '🔊' }}</span>
              <span class="grid-label">{{ muted ? 'Unmute' : 'Mute' }}</span>
            </button>
            <button class="grid-btn">
              <span>⌨️</span>
              <span class="grid-label">Keypad</span>
            </button>
            <button class="grid-btn">
              <span>🔈</span>
              <span class="grid-label">Speaker</span>
            </button>
          </div>

          <button class="call-btn end-btn" (click)="endCall()" aria-label="End call">
            <span class="btn-icon">📵</span>
            <span class="btn-label">End Call</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fake-call-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0d1b2a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .call-screen {
      width: 100%;
      max-width: 420px;
      padding: 40px 24px;
      text-align: center;
    }

    .caller-avatar-ring {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 3px solid rgba(76, 175, 80, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      animation: ringPulse 2s infinite;
    }
    .caller-avatar-ring.active {
      border-color: rgba(76, 175, 80, 0.8);
      animation: none;
    }
    @keyframes ringPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
      50% { box-shadow: 0 0 0 20px rgba(76, 175, 80, 0); }
    }

    .caller-avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      color: white;
      font-weight: 700;
    }

    .caller-label {
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
      margin-bottom: 4px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .caller-name {
      color: white;
      font-size: 1.8rem;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .caller-number {
      color: rgba(255,255,255,0.5);
      font-size: 1rem;
      margin-bottom: 48px;
    }

    .call-timer {
      color: rgba(76, 175, 80, 0.9);
      font-size: 1.2rem;
      font-variant-numeric: tabular-nums;
      margin-bottom: 40px;
    }

    .call-actions {
      display: flex;
      justify-content: center;
      gap: 64px;
    }

    .call-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border: none;
      background: none;
      cursor: pointer;
    }

    .call-btn .btn-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .call-btn .btn-icon:hover {
      transform: scale(1.1);
    }

    .decline-btn .btn-icon {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 4px 20px rgba(239,68,68,0.4);
    }
    .answer-btn .btn-icon {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      box-shadow: 0 4px 20px rgba(34,197,94,0.4);
    }
    .end-btn .btn-icon {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 4px 20px rgba(239,68,68,0.4);
      width: 72px;
      height: 72px;
      font-size: 1.8rem;
    }

    .call-btn .btn-label {
      color: rgba(255,255,255,0.7);
      font-size: 0.85rem;
    }

    .in-call-grid {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 48px;
    }

    .grid-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      border: none;
      background: rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 16px 20px;
      cursor: pointer;
      color: white;
      font-size: 1.4rem;
      transition: background 0.2s;
    }
    .grid-btn:hover { background: rgba(255,255,255,0.14); }
    .grid-btn .grid-label {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.6);
    }

    /* Mobile first */
    @media (max-width: 600px) {
      .call-screen { padding: 60px 16px 40px; }
      .caller-name { font-size: 1.5rem; }
      .call-actions { gap: 48px; }
    }
  `]
})
export class FakeCallComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  visible = true;
  answered = false;
  muted = false;

  callerName = 'Mom';
  callerNumber = '+1 (876) 555-0199';
  get callerInitial(): string { return this.callerName.charAt(0).toUpperCase(); }

  callSeconds = 0;
  private callInterval: any;
  private audio: HTMLAudioElement | null = null;

  get callTimerDisplay(): string {
    const m = Math.floor(this.callSeconds / 60).toString().padStart(2, '0');
    const s = (this.callSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Load caller name from localStorage if set
    const savedCaller = localStorage.getItem('safer_fake_call_name');
    if (savedCaller) this.callerName = savedCaller;
    const savedNumber = localStorage.getItem('safer_fake_call_number');
    if (savedNumber) this.callerNumber = savedNumber;

    // Play a ringtone sound (use built-in oscillator as fallback)
    try {
      this.audio = new Audio();
      this.audio.src = '/assets/ringtones/office.mp3';
      this.audio.loop = true;
      this.audio.play().catch(() => {});
    } catch {}

    // Vibrate pattern for incoming call
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
    }
  }

  ngOnDestroy(): void {
    this.stopAudio();
    if (this.callInterval) clearInterval(this.callInterval);
  }

  answerCall(): void {
    this.answered = true;
    this.stopAudio();
    if (navigator.vibrate) navigator.vibrate(0);
    this.callInterval = setInterval(() => this.callSeconds++, 1000);
  }

  decline(): void {
    this.cleanup();
  }

  endCall(): void {
    this.cleanup();
  }

  toggleMute(): void {
    this.muted = !this.muted;
  }

  private cleanup(): void {
    this.stopAudio();
    if (this.callInterval) clearInterval(this.callInterval);
    if (navigator.vibrate) navigator.vibrate(0);
    this.visible = false;
    this.closed.emit();
    this.router.navigate(['/dashboard']);
  }

  private stopAudio(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}
