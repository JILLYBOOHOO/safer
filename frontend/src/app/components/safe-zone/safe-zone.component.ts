import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/**
 * SafeZone AI component – guides the user through safe‑zone monitoring and alerts.
 * This is a UI‑only prototype; the services contain stub logic that can be expanded.
 */
@Component({
  selector: 'app-safe-zone',
  templateUrl: './safe-zone.component.html',
  styleUrls: ['./safe-zone.component.css']
})
export class SafeZoneComponent implements OnInit {
  // UI flow control
  step: 'home' | 'prompt-walk' | 'sound-detection' | 'route-monitor' | 'final' = 'home';

  // Data
  safeZones: string[] = [];
  leavingMessage = '';
  suspiciousSounds: string[] = [];

  constructor(
    private router: Router
  ) {}

  ngOnInit(): void {
    // this.safeZones = this.safeZoneSrv.getSafeZones();
    // Simulate leaving check (in real app this would be realtime geofence)
    // if (this.safeZoneSrv.isLeavingSafeZoneLateNight()) {
    //   this.leavingMessage = this.safeZoneSrv.getLeavingMessage();
    //   this.step = 'prompt-walk';
    // }
  }

  // Step actions
  startSafeWalk(): void {
    // In a real app this would start the walk‑timer and location tracking
    this.step = 'sound-detection';
    // this.suspiciousSounds = this.soundSrv.getDetectedSounds();
  }

  skipSafeWalk(): void {
    this.step = 'final';
  }

  // Sound detection handling – for now just display the stub list
  acknowledgeSounds(): void {
    // Could trigger notifications, route monitoring, etc.
    this.step = 'route-monitor';
  }

  // Route monitoring placeholder
  confirmRoute(): void {
    // In a full implementation we would compare current path to learned route.
    this.step = 'final';
    // Navigate to dashboard or another page if needed
    this.router.navigate(['/dashboard']);
  }
}
