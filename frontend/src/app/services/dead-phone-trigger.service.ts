import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DeadPhoneTriggerService {
  private isMonitoring = false;
  private battery: any = null;
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;
  private lastUpdate = 0;

  private lastGaspSent = false;
  private alert15Sent = false;
  private alert20Sent = false;
  private geoWatchId: number | null = null;
  private lastPosition: GeolocationPosition | null = null;

  // Configuration thresholds
  private ACCEL_SPIKE_THRESHOLD = 16.5; // m/s^2 (Sudden jerk / snatch event)
  
  public onTriggerFired = new EventEmitter<{ reason: string; val?: any }>();

  constructor() {
    this.initBatteryListener();
  }

  /**
   * Battery Charging Status Checker
   */
  private async initBatteryListener() {
    const nav = navigator as any;
    if (nav.getBattery) {
      try {
        this.battery = await nav.getBattery();
        this.battery.addEventListener('chargingchange', () => {
          if (this.isMonitoring && !this.battery.charging) {
            console.warn('[Dead Phone Trigger] Charging cable disconnected!');
            this.onTriggerFired.emit({ reason: 'charging_disconnect' });
          }
        });
        this.battery.addEventListener('levelchange', () => {
          if (this.isMonitoring) {
            const lvl = this.battery.level;
            if (lvl <= 0.10 && !this.lastGaspSent) {
              console.warn('[Dead Phone Trigger] Battery drop detected below 10% threshold!');
              this.onTriggerFired.emit({ reason: 'battery_drop', val: lvl });
              this.sendLastGasp();
              this.lastGaspSent = true;
            } else if (lvl <= 0.15 && lvl > 0.10 && !this.alert15Sent) {
              this.triggerSilentBatteryAlert(15);
              this.alert15Sent = true;
            } else if (lvl <= 0.20 && lvl > 0.15 && !this.alert20Sent) {
              this.triggerSilentBatteryAlert(20);
              this.alert20Sent = true;
            }
          }
        });
      } catch (e) {
        console.warn('[Dead Phone Trigger] Battery monitoring not allowed by browser guidelines.');
      }
    }
  }

  /**
   * Starts device telemetry tracking
   */
  public startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // 1. Listen to Device Motion (Acceleration snatch detection)
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', this.handleMotion, true);
    } else {
      console.warn('[Dead Phone Trigger] Device motion triggers not supported on this browser.');
    }

    // 2. Listen to Device Orientation changes
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation, true);
    }

    // 3. Document Visibility Event (background tracking)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // 4. Geolocation tracking (Rapid flight detection)
    if (navigator.geolocation) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (position) => this.handleGeolocation(position),
        (err) => console.warn('[Dead Phone Trigger] Geolocation error', err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    console.log('[Dead Phone Trigger] Sensors active. Tracking motion, power, and orientation.');
  }

  /**
   * Deactivates all telemetry listeners
   */
  public stopMonitoring() {
    this.isMonitoring = false;
    window.removeEventListener('devicemotion', this.handleMotion);
    window.removeEventListener('deviceorientation', this.handleOrientation);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    if (this.geoWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    
    console.log('[Dead Phone Trigger] Sensors offline.');
  }

  /**
   * Event handler processing acceleration spikes
   */
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
      
      if (speed > this.ACCEL_SPIKE_THRESHOLD) {
        console.warn(`[Dead Phone Trigger] Anti-snatch spike! Speed delta: ${speed.toFixed(2)} m/s²`);
        this.onTriggerFired.emit({ reason: 'accel_spike', val: speed });
      }

      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;
    }
  };

  /**
   * Handles device flips/tilts (rapid orientation changes)
   */
  private handleOrientation = (event: DeviceOrientationEvent) => {
    if (!this.isMonitoring) return;
    
    // Trigger lockdown if orientation tilts past extreme boundaries (e.g. phone flipped face down rapidly)
    const beta = event.beta; // Tilt front-back (-180 to 180)
    const gamma = event.gamma; // Tilt left-right (-90 to 90)

    if (beta !== null && (Math.abs(beta) > 150 || (Math.abs(gamma || 0) > 80))) {
      console.warn('[Dead Phone Trigger] Extreme tilt orientation boundary breached.');
      this.onTriggerFired.emit({ reason: 'orientation_tilt', val: { beta, gamma } });
    }
  };

  /**
   * Listens to tab backgrounding
   */
  private handleVisibilityChange = () => {
    if (!this.isMonitoring) return;
    if (document.visibilityState === 'hidden') {
      console.warn('[Dead Phone Trigger] App backgrounded!');
      this.onTriggerFired.emit({ reason: 'app_backgrounded' });
    }
  };

  /**
   * Handles geolocation to detect rapid flight
   */
  private handleGeolocation(position: GeolocationPosition) {
    if (!this.isMonitoring) return;
    if (this.lastPosition) {
      const dist = this.calculateDistance(
        this.lastPosition.coords.latitude, this.lastPosition.coords.longitude,
        position.coords.latitude, position.coords.longitude
      );
      const timeDiffSec = (position.timestamp - this.lastPosition.timestamp) / 1000;
      if (timeDiffSec > 0) {
        const speed = dist / timeDiffSec; // meters per second
        // If speed > 15 m/s (~54 km/h), rapid flight detected
        if (speed > 15) {
           console.warn(`[Dead Phone Trigger] Rapid flight detected! Speed: ${speed.toFixed(2)} m/s`);
           this.onTriggerFired.emit({ reason: 'rapid_flight', val: speed });
        }
      }
    }
    this.lastPosition = position;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Triggers a silent push notification mimicking system maintenance
   */
  private triggerSilentBatteryAlert(level: number) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('System Optimization', {
        body: `Background processes running low. Please connect charger soon to optimize performance. (Code: B${level})`,
        silent: true
      });
    }
  }

  /**
   * Last Gasp Protocol: Pushes coordinates to server before dying
   */
  private sendLastGasp() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          acc: position.coords.accuracy,
          timestamp: position.timestamp
        };
        fetch('/api/emergency/last-gasp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coords })
        }).catch(err => console.error('[Dead Phone Trigger] Last Gasp failed to send', err));
      });
    }
  }
}
