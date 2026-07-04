import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CrashDetectionService {
  private isMonitoring = false;
  private CRASH_DECELERATION_THRESHOLD = 30; // m/s^2 (Roughly 3G of deceleration)
  private IMMOBILITY_THRESHOLD = 2; // m/s^2 (Variance allowed while "immobile")
  
  private isCheckingImmobility = false;
  private immobilityTimer: any = null;
  
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;
  private lastUpdate = 0;

  public onCrashDetected = new EventEmitter<{ reason: string, data?: any }>();

  constructor() {}

  public startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', this.handleMotion, true);
      console.log('[Crash Detection] Active. Monitoring extreme deceleration vectors.');
    } else {
      console.warn('[Crash Detection] Device motion triggers not supported on this browser.');
    }
  }

  public stopMonitoring() {
    this.isMonitoring = false;
    this.resetImmobilityCheck();
    window.removeEventListener('devicemotion', this.handleMotion);
    console.log('[Crash Detection] Offline.');
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    if (!this.isMonitoring) return;

    const accel = event.acceleration || event.accelerationIncludingGravity;
    if (!accel) return;

    const curTime = Date.now();
    if ((curTime - this.lastUpdate) > 100) { // Limit scans to every 100ms
      const diffTime = curTime - this.lastUpdate;
      this.lastUpdate = curTime;

      const x = accel.x || 0;
      const y = accel.y || 0;
      const z = accel.z || 0;

      // Calculate speed change
      const speed = Math.abs(x + y + z - this.lastX - this.lastY - this.lastZ) / diffTime * 10000;

      if (!this.isCheckingImmobility) {
        // Phase 1: Detect massive spike
        if (speed > this.CRASH_DECELERATION_THRESHOLD) {
          console.warn(`[Crash Detection] CRITICAL IMPACT DETECTED: ${speed.toFixed(2)} m/s²`);
          this.beginImmobilityCheck();
        }
      } else {
        // Phase 2: Ensure complete immobility
        if (speed > this.IMMOBILITY_THRESHOLD) {
          console.log('[Crash Detection] Movement detected. Canceling immobility check.');
          this.resetImmobilityCheck();
        }
      }

      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;
    }
  };

  private beginImmobilityCheck() {
    this.isCheckingImmobility = true;
    console.log('[Crash Detection] Waiting 15 seconds for complete immobility...');
    
    this.immobilityTimer = setTimeout(() => {
      this.triggerCrashEscalation();
      this.resetImmobilityCheck();
    }, 15000); // 15 seconds
  }

  private resetImmobilityCheck() {
    this.isCheckingImmobility = false;
    if (this.immobilityTimer) {
      clearTimeout(this.immobilityTimer);
      this.immobilityTimer = null;
    }
  }

  private triggerCrashEscalation() {
    console.error('[Crash Detection] 15 seconds of immobility confirmed after impact! Escalating...');
    
    // Play aggressive local tone
    this.playAggressiveTone();

    // Trigger SOS
    this.onCrashDetected.emit({ reason: 'crash_immobility_timeout' });
  }

  private playAggressiveTone() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2); // Sweep to 1200Hz

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2); // Decay

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2);
    } catch (e) {
      console.warn('[Crash Detection] Could not play aggressive tone', e);
    }
  }
}
