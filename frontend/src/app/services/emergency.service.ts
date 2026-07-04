import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface SOSPayload {
  email: string;
  latitude?: number;
  longitude?: number;
  triggerType?: string;
}

@Injectable({ providedIn: 'root' })
export class EmergencyService {
  constructor(private http: HttpClient) {}

  // Get browser location, then send SOS
  // Existing async method retained for internal use
async sendSOS(): Promise<void> {
    const payload: SOSPayload = { email: '' };
    // Retrieve email from stored auth (assuming stored in localStorage)
    const storedEmail = localStorage.getItem('safer_user_email');
    payload.email = storedEmail || '';

    try {
      const position = await this.getCurrentPosition();
      payload.latitude = position.coords.latitude;
      payload.longitude = position.coords.longitude;
    } catch (e) {
      // location optional, continue without coordinates
    }
    payload.triggerType = 'sos_button';
    // fire request (ignore response for UI)
    this.http.post<any>('/api/emergency/trigger', payload).toPromise();
  }
  // Send notification via SMS
  sendSmsNotification(message: string, phone: string): Observable<any> {
    const payload = { message, phone };
    return this.http.post<any>('/api/notify/sms', payload);
  }

  // Send notification via WhatsApp
  sendWhatsAppNotification(message: string, phone: string): Observable<any> {
    const payload = { message, phone };
    return this.http.post<any>('/api/notify/whatsapp', payload);
  }
  sendSosAlert(): Observable<any> {
    const payload: SOSPayload = { email: '' };
    const storedEmail = localStorage.getItem('safer_user_email');
    payload.email = storedEmail || '';
    return this.http.post<any>('/api/emergency/trigger', payload);
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
    });
  }
}
