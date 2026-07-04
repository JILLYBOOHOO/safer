import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Service to control the Safe‑Walk timer (Dead‑Man’s Switch) */
@Injectable({ providedIn: 'root' })
export class WalkTimerService {
  private defaultDurationSec = 300; // 5 minutes default

  constructor(private http: HttpClient) {}

  /** Start a timer; optional duration in seconds */
  startTimer(durationSec?: number): Observable<any> {
    const payload = { durationSec: durationSec ?? this.defaultDurationSec };
    return this.http.post('/api/start-walk-timer', payload);
  }

  /** Cancel the running timer */
  cancelTimer(): Observable<any> {
    return this.http.post('/api/cancel-walk-timer', {});
  }
}
