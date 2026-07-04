import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class GeofenceService {
  private watchId: number | null = null;
  private readonly radiusMeters = 200;

  constructor(private http: HttpClient) {}

  /** Start continuous geolocation watch */
  startWatch(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.handlePosition(pos),
      err => console.error('Geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  /** Stop the watch when not needed */
  stopWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private async handlePosition(pos: GeolocationPosition) {
    const { latitude, longitude } = pos.coords;
    // Home location should be stored in localStorage after profile load
    const home = JSON.parse(localStorage.getItem('safer_home_location') || '{}');
    if (!home.lat || !home.lng) {
      return;
    }
    const distance = this.calculateDistance(latitude, longitude, home.lat, home.lng);
    const now = new Date();
    const afterDark = now.getHours() >= 18 || now.getHours() < 6; // simple dark definition
    if (distance <= this.radiusMeters && afterDark) {
      // Send event to backend (requires auth token via interceptor)
      this.http.post('/api/geofence-event', {
        lat: latitude,
        lng: longitude,
        timestamp: now.toISOString()
      }).subscribe();
    }
  }

  /** Haversine formula – returns distance in meters */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // Earth radius in metres
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
