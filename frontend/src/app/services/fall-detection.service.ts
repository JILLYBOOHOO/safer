import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SecurityService } from './security.service';
import { AlertService } from './alert.service';

@Injectable({
  providedIn: 'root'
})
export class FallDetectionService {
  private isTracking = false;
  private motionHistory: { x: number, y: number, z: number, timestamp: number }[] = [];
  
  // State machine for heuristic chain
  private isRunning = false;
  private hasImpacted = false;
  private stillTimer: any = null;

  public fallDetected$ = new BehaviorSubject<boolean>(false);

  constructor(
    private securityService: SecurityService,
    private alertService: AlertService
  ) {}

  public startTracking() {
    if (this.isTracking || !window.DeviceMotionEvent) return;
    this.isTracking = true;
    window.addEventListener('devicemotion', this.handleMotion.bind(this));
    console.log('[Fall Detection] Engine Active.');
  }

  public stopTracking() {
    this.isTracking = false;
    window.removeEventListener('devicemotion', this.handleMotion.bind(this));
    this.resetState();
  }

  private handleMotion(event: DeviceMotionEvent) {
    if (!this.isTracking) return;

    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate total acceleration magnitude
    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    
    // 1. Detect Running (Sustained high acceleration changes)
    if (magnitude > 15 && magnitude < 30) {
      this.isRunning = true;
      if (this.hasImpacted) {
        this.resetState();
        this.isRunning = true;
      }
    }

    // 2. Detect Impact Spike (Sudden massive G-Force spike)
    if (this.isRunning && magnitude > 35) {
      this.hasImpacted = true;
      this.isRunning = false;
    }

    // 3. Detect Stillness (No movement after impact)
    if (this.hasImpacted) {
      const isStill = magnitude > 9.0 && magnitude < 10.5;
      if (isStill) {
        if (!this.stillTimer) {
          this.stillTimer = setTimeout(() => {
            this.triggerFallEmergency();
          }, 10000); // 10 seconds of stillness triggers emergency
        }
      } else {
        if (this.stillTimer) {
          clearTimeout(this.stillTimer);
          this.stillTimer = null;
        }
      }
    }
  }

  private triggerFallEmergency() {
    console.warn('[Fall Detection] HARD FALL AND NO MOVEMENT DETECTED! TRIGGERING SOS.');
    this.fallDetected$.next(true);
    
    this.alertService.danger('Fall Detected! Checking vitals...', 'Are you okay?');
    
    setTimeout(() => {
      if (this.fallDetected$.value) {
         this.securityService.triggerEmergency('fall_detected').subscribe();
      }
    }, 60000);
    
    this.resetState();
  }
  
  public dismissFall() {
    this.fallDetected$.next(false);
  }

  private resetState() {
    this.isRunning = false;
    this.hasImpacted = false;
    if (this.stillTimer) {
      clearTimeout(this.stillTimer);
      this.stillTimer = null;
    }
  }
}
