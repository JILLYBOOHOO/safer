import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { WalkTimerService } from '../../services/walk-timer.service';

/**
 * Visual countdown timer for the Safe‑Walk "dead‑man’s switch".
 * Displays minutes:seconds, vibrates on each tick, and emits
 * `expired` when the timer reaches zero.
 */
@Component({
  selector: 'app-walk-timer',
  templateUrl: './walk-timer.component.html',
  styleUrls: ['./walk-timer.component.css']
})
export class WalkTimerComponent implements OnInit, OnDestroy {
  remainingSec: number = 0;
  intervalId: any;
  @Output() expired = new EventEmitter<void>();

  constructor(private timerSrv: WalkTimerService) {}

  ngOnInit(): void {
    // Default duration 5 minutes if not set by service
    this.remainingSec = (this.timerSrv as any).remainingSeconds ?? 300;
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private startCountdown(): void {
    this.intervalId = setInterval(() => {
      if (this.remainingSec > 0) {
        this.remainingSec--;
        // Vibrate on each tick (requires user interaction first)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        clearInterval(this.intervalId);
        this.expired.emit();
        // Notify backend emergency endpoint
        (this.timerSrv as any).triggerEmergency();
      }
    }, 1000);
  }

  get display(): string {
    const m = Math.floor(this.remainingSec / 60)
      .toString()
      .padStart(2, '0');
    const s = (this.remainingSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
