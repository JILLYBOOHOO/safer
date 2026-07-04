import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { EmergencyIntelligenceService } from './emergency-intelligence.service';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  homeWifi?: string;
  homeGps?: { lat: number; lng: number };
  homeAddress?: string;
  medicalCard?: any;
  emergencyContact?: any;
  frequentPlaces?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private API_URL = 'http://localhost:3000/api'; // Standard dev URL mapping
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Track active auth status
  private tokenSubject = new BehaviorSubject<string | null>(null);
  
  // Track active security validation levels (1 to 4)
  private currentSecurityLevelSubject = new BehaviorSubject<number>(1);
  public currentSecurityLevel$ = this.currentSecurityLevelSubject.asObservable();

  constructor(
    private http: HttpClient,
    private emergencyIntelligence: EmergencyIntelligenceService
  ) {
    // Restore session on launch
    const savedToken = localStorage.getItem('safer_token');
    const savedUser = localStorage.getItem('safer_user');
    if (savedToken && savedUser) {
      this.tokenSubject.next(savedToken);
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  public get token(): string | null {
    return this.tokenSubject.value;
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  private getHeaders() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token || ''}`
      })
    };
  }

  /**
   * Pre-login scan endpoint
   */
  public preLoginScan(identifier: string, env: { ssid?: string; latitude?: number; longitude?: number; fingerprint?: string; requestedLevel?: number }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/pre-login`, { identifier, ...env });
  }

  /**
   * Main login validation endpoint (supports regular and duress pattern triggers)
   */
  public signIn(credentials: { identifier: string; password_hash: string; pattern: string; fingerprint?: string; ssid?: string; latitude?: number; longitude?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/auth/signin`, {
      identifier: credentials.identifier,
      password: credentials.password_hash,
      pattern: credentials.pattern,
      fingerprint: credentials.fingerprint,
      ssid: credentials.ssid,
      latitude: credentials.latitude,
      longitude: credentials.longitude
    }).pipe(
      tap(res => {
        if (res.success && res.token) {
          if (res.isDuress) {
            // Masked authorization token
            sessionStorage.setItem('safer_duress_token', res.token);
          } else {
            localStorage.setItem('safer_token', res.token);
            localStorage.setItem('safer_user', JSON.stringify(res.user));
            this.tokenSubject.next(res.token);
            this.currentUserSubject.next(res.user);
          }
        }
      })
    );
  }

  /**
   * Check if email exists
   */
  public checkEmail(email: string): Observable<{ exists: boolean }> {
    return this.http.post<{ exists: boolean }>(`${this.API_URL}/auth/check-email`, { email });
  }

  /**
   * Signup configuration
   */
  public signUp(data: { name: string; email: string; password: string; safePattern: string; duressPattern: string; phone?: string; age?: number; authMethod?: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/signup`, {
      name: data.name,
      email: data.email,
      password: data.password,
      safePattern: data.safePattern,
      duressPattern: data.duressPattern,
      phone: data.phone,
      age: data.age,
      authMethod: data.authMethod || 'passcode'
    });
  }

  /**
   * Trigger OTP Request
   */
  public requestOTP(identifier: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/otp-request`, { identifier });
  }

  /**
   * Verify OTP and set new password
   */
  public verifyOTP(identifier: string, otp: string, newPassword?: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/otp-verify`, { identifier, otp, newPassword });
  }

  public updateProfile(profile: { name?: string; email?: string; homeWifi?: string; homeGps?: { lat: number; lng: number }; homeAddress?: string; medicalCard?: any; emergencyContact?: any; frequentPlaces?: any[] }): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/user/profile`, profile, this.getHeaders()).pipe(
      tap(res => {
        if (res.success && res.user) {
          localStorage.setItem('safer_user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  /**
   * Retrieve active sessions list
   */
  public getSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/user/sessions`, this.getHeaders()).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Revoke active session tokens
   */
  public revokeSession(sessionId?: number, revokeAll: boolean = false): Observable<any> {
    return this.http.delete(`${this.API_URL}/user/sessions`, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token || ''}`
      }),
      body: { sessionId, revokeAll }
    });
  }

  /**
   * Files Diagnostics Trouble Ticket
   */
  public submitTicket(ticket: { title: string; description: string; metadata: any }): Observable<any> {
    return this.http.post(`${this.API_URL}/user/ticket`, ticket, this.getHeaders());
  }

  /**
   * Admin: Load dashboard details
   */
  public getAdminDashboard(): Observable<any> {
    return this.http.get(`${this.API_URL}/admin/dashboard`, this.getHeaders());
  }

  /**
   * Admin: Suspend/change user role
   */
  public updateAdminUser(userId: number, update: { status?: string; role?: string }): Observable<any> {
    return this.http.put(`${this.API_URL}/admin/users/${userId}`, update, this.getHeaders());
  }

  /**
   * Admin: Permanently purge database user profile
   */
  public deleteAdminUser(userId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/admin/users/${userId}`, this.getHeaders());
  }

  /**
   * Trigger silent threat protocols with full intelligence payload.
   * Sends GPS, battery, network, speed, direction, voice clip, photo
   * and starts live location tracking.
   */
  public triggerEmergency(triggerType: string): Observable<any> {
    const user = this.currentUserValue;
    const token = this.token;
    return from(
      this.emergencyIntelligence.collectAndTrigger(triggerType, user?.email, token)
    ).pipe(
      catchError(err => {
        console.error('[Security] Emergency intelligence collection error:', err);
        // Fallback: fire the legacy simple trigger so alert always gets sent
        return this.http.post(`${this.API_URL}/emergency/trigger`, {
          email: user?.email,
          latitude: 0,
          longitude: 0,
          triggerType: `${triggerType} (intelligence_error)`
        });
      })
    );
  }

  /**
   * Stop all live emergency tracking (call on confirmed safe arrival)
   */
  public stopEmergencyTracking() {
    this.emergencyIntelligence.stopAllTracking();
  }

  public isAdmin(): boolean {
    return this.currentUserValue?.role === 'admin';
  }

  /**
   * Local wipe of cached data (remote wipe trigger fallback action)
   */
  public purgeLocalData() {
    localStorage.clear();
    sessionStorage.clear();
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.currentSecurityLevelSubject.next(1);
    console.log('[Security Service] Local caches cleared and wiped successfully.');
  }

  /**
   * Deactivates current user local authentication
   */
  public signOut() {
    this.purgeLocalData();
  }

  /**
   * Update active security level
   */
  public setSecurityLevel(level: number) {
    this.currentSecurityLevelSubject.next(level);
  }

  public isLoggedIn(): boolean {
    return !!this.currentUserValue;
  }
}
