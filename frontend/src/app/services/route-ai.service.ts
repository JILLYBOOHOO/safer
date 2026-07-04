import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SecurityService } from './security.service';
import { AlertService } from './alert.service';
import { BehaviorSubject } from 'rxjs';

export interface RouteAnomaly {
  type: 'delay' | 'deviation';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class RouteAiService {
  private activeRouteName: string | null = null;
  private startTime: number = 0;
  private watchId: number | null = null;
  
  // Mock historical data (in production, fetch from backend)
  private historicalRoutes: any = {
    'Walking Home': { averageDurationMs: 15 * 60 * 1000, bounds: { minLat: 30.0, maxLat: 30.1, minLng: -97.8, maxLng: -97.7 } },
    'Bus Stop': { averageDurationMs: 5 * 60 * 1000, bounds: { minLat: 30.05, maxLat: 30.06, minLng: -97.75, maxLng: -97.74 } }
  };

  public anomalyDetected$ = new BehaviorSubject<RouteAnomaly | null>(null);

  constructor(
    private http: HttpClient,
    private securityService: SecurityService,
    private alertService: AlertService
  ) {}

  public startRouteMonitoring(routeName: string) {
    this.activeRouteName = routeName;
    this.startTime = Date.now();
    
    // Simulate fetching historical route data
    // this.http.get('/api/transit/history/' + routeName).subscribe(...)

    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.analyzePosition(pos),
        (err) => console.warn('Route AI GPS error', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
  }

  public stopRouteMonitoring() {
    this.activeRouteName = null;
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.anomalyDetected$.next(null);
  }

  private analyzePosition(pos: GeolocationPosition) {
    if (!this.activeRouteName) return;

    const history = this.historicalRoutes[this.activeRouteName];
    if (!history) return; // No historical data to compare against

    const elapsedMs = Date.now() - this.startTime;
    const { latitude, longitude, speed } = pos.coords;

    // 1. Safe Walk AI: Time Anomaly + Zero Movement
    // Takes 50% longer than average AND stopped moving
    if (elapsedMs > history.averageDurationMs * 1.5) {
      if (speed !== null && speed < 0.5) {
        // Stopped somewhere. Unfamiliar zone?
        const isFamiliar = this.isWithinBounds(latitude, longitude, history.bounds);
        if (!isFamiliar && !this.anomalyDetected$.value) {
          this.triggerAnomaly({
            type: 'delay',
            message: `You usually get to ${this.activeRouteName} in ${Math.round(history.averageDurationMs / 60000)} mins. It's been ${Math.round(elapsedMs / 60000)} mins and you are stopped in an unfamiliar area. Are you okay?`
          });
        }
      }
    }

    // 2. Route Deviation AI: Spatial Anomaly
    // If significantly outside the historical bounding box for this route
    if (!this.isWithinBounds(latitude, longitude, history.bounds) && elapsedMs < history.averageDurationMs * 1.5) {
      if (!this.anomalyDetected$.value || this.anomalyDetected$.value.type !== 'deviation') {
        this.triggerAnomaly({
          type: 'deviation',
          message: "You're off your usual route. Continue?"
        });
      }
    }
    
    // Send ping to Guardian Dashboard
    this.pingGuardianDashboard(latitude, longitude, speed);
  }

  private isWithinBounds(lat: number, lng: number, bounds: any): boolean {
    // Basic bounding box check with slight padding for GPS drift
    const padding = 0.005; 
    return lat >= (bounds.minLat - padding) && lat <= (bounds.maxLat + padding) &&
           lng >= (bounds.minLng - padding) && lng <= (bounds.maxLng + padding);
  }

  private triggerAnomaly(anomaly: RouteAnomaly) {
    console.warn(`[Route AI] Anomaly Detected: ${anomaly.type}`);
    this.anomalyDetected$.next(anomaly);
    
    // Trigger the SOS UI flow (handled by Dashboard component)
    this.alertService.warning(anomaly.message, 'Route Anomaly');
  }

  public dismissAnomaly() {
    this.anomalyDetected$.next(null);
  }

  public triggerAnomalyEmergency() {
    this.securityService.triggerEmergency('route_anomaly').subscribe();
    this.anomalyDetected$.next(null);
  }

  private async pingGuardianDashboard(lat: number, lng: number, speed: number | null) {
    if ('getBattery' in navigator) {
      try {
        const nav: any = navigator;
        const battery = await nav.getBattery();
        this.http.post(`${this.securityService['API_URL']}/transit/ping`, {
          lat, lng, speed, battery: battery.level * 100
        }, { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }).subscribe();
      } catch (e) {}
    } else {
      this.http.post(`${this.securityService['API_URL']}/transit/ping`, {
        lat, lng, speed, battery: 100
      }, { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }).subscribe();
    }
  }
}
