import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { SecurityService } from './security.service';

export interface RiskFactor {
  icon: string;
  label: string;
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';
}

export interface RiskForecast {
  safetyRating: number;
  overallLevel: 'safe' | 'moderate' | 'elevated' | 'high';
  factors: RiskFactor[];
  weather: { description: string; temp: number; humidity: number } | null;
  disclaimer: string;
}

@Injectable({
  providedIn: 'root'
})
export class RiskForecastService {
  public forecast$ = new BehaviorSubject<RiskForecast | null>(null);
  public loading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private securityService: SecurityService
  ) {}

  public async fetchForecast(routeName?: string): Promise<RiskForecast | null> {
    this.loading$.next(true);

    // Get GPS coordinates
    let lat = 0, lng = 0;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.warn('[Risk Forecast] GPS unavailable, using defaults.');
    }

    // Get battery level
    let battery = 100;
    try {
      if ('getBattery' in navigator) {
        const nav: any = navigator;
        const b = await nav.getBattery();
        battery = Math.round(b.level * 100);
      }
    } catch (e) {}

    return new Promise((resolve) => {
      this.http.post<any>(
        `${this.securityService['API_URL']}/risk-forecast`,
        { lat, lng, batteryLevel: battery, routeName },
        { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }
      ).subscribe(
        (res) => {
          if (res.success) {
            this.forecast$.next(res);
            resolve(res);
          }
          this.loading$.next(false);
        },
        (err) => {
          // Fallback forecast if API fails (offline)
          const fallback: RiskForecast = this.buildOfflineForecast(battery);
          this.forecast$.next(fallback);
          this.loading$.next(false);
          resolve(fallback);
        }
      );
    });
  }

  private buildOfflineForecast(battery: number): RiskForecast {
    const hour = new Date().getHours();
    const factors: RiskFactor[] = [];
    let riskScore = 0;

    // Darkness from local time
    if (hour >= 20 || hour < 6) {
      riskScore += 20;
      factors.push({ icon: '🌙', label: 'Low Lighting / Darkness', severity: 'high' });
    } else {
      factors.push({ icon: '💡', label: 'Good Lighting', severity: 'safe' });
    }

    // Battery
    if (battery <= 15) {
      riskScore += 20;
      factors.push({ icon: '🪫', label: 'Low Battery', severity: 'critical' });
    } else if (battery <= 30) {
      riskScore += 10;
      factors.push({ icon: '🔋', label: 'Moderate Battery', severity: 'medium' });
    } else {
      factors.push({ icon: '⚡', label: `Battery ${battery}%`, severity: 'safe' });
    }

    // Late night
    if (hour >= 22 || hour < 5) {
      riskScore += 15;
      factors.push({ icon: '🌃', label: 'Late Night Travel', severity: 'high' });
    } else {
      factors.push({ icon: '🕐', label: 'Standard Hours', severity: 'safe' });
    }

    factors.push({ icon: '🌐', label: 'Weather (Offline)', severity: 'unknown' });

    const safetyRating = Math.max(0, 100 - riskScore);
    return {
      safetyRating,
      overallLevel: safetyRating >= 80 ? 'safe' : safetyRating >= 60 ? 'moderate' : safetyRating >= 40 ? 'elevated' : 'high',
      factors,
      weather: null,
      disclaimer: 'Offline forecast — weather data unavailable. Connect to the internet for a full assessment.'
    };
  }

  public clear() {
    this.forecast$.next(null);
  }
}
