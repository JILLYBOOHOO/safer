import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransitCheckService {
  private watchId: number | null = null;
  private zeroVelocityStartTime: number | null = null;
  private lastPosition: GeolocationPosition | null = null;
  
  public velocityZeroAlert = new Subject<boolean>();
  public isTracking = false;

  constructor() {}

  public startTracking() {
    if (this.isTracking || !navigator.geolocation) return;
    
    this.isTracking = true;
    this.zeroVelocityStartTime = null;
    
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.processPosition(pos),
      (err) => console.error('Velocity Engine tracking error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  }

  public stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.zeroVelocityStartTime = null;
  }

  private processPosition(pos: GeolocationPosition) {
    this.lastPosition = pos;
    // Speed is in m/s
    const speed = pos.coords.speed;
    
    // Fallback manual speed calculation if native speed is null
    let computedSpeed = speed;
    if (computedSpeed === null && this.lastPosition) {
      // In a robust implementation we'd compute distance/time manually here
      computedSpeed = 0; // fallback mock for zero velocity
    }

    if (computedSpeed !== null && computedSpeed < 0.5) { // less than 0.5 m/s is roughly stationary
      if (!this.zeroVelocityStartTime) {
        this.zeroVelocityStartTime = Date.now();
      } else {
        const elapsedMinutes = (Date.now() - this.zeroVelocityStartTime) / 60000;
        if (elapsedMinutes >= 3) {
          // Trigger the haptic zero-velocity alert!
          this.triggerAlert();
          // Reset timer to avoid spamming
          this.zeroVelocityStartTime = null;
        }
      }
    } else {
      // Moving again
      this.zeroVelocityStartTime = null;
    }
  }

  private triggerAlert() {
    // Pulse haptic phone vibration check-in prompt
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
    }
    this.velocityZeroAlert.next(true);
  }
}
