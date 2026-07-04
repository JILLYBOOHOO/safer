import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface EmergencyIntelligencePayload {
  // Phase 1 - Immediate
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    mapsLink: string;
    heading: number | null;
    speed: number | null;
    altitude: number | null;
  } | null;
  device: {
    userAgent: string;
    model: string;
    batteryLevel: number | null;
    batteryCharging: boolean | null;
    networkType: string;
    networkDownlink: string;
    online: boolean;
    screenSize: string;
  };
  triggerType: string;
  // Phase 2 - Captures (base64)
  voiceClipBase64?: string;
  photoBase64?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyIntelligenceService {
  private API_URL = 'http://localhost:3000/api';
  private locationWatchId: number | null = null;
  private mediaStream: MediaStream | null = null;
  private clipInterval: any = null;
  private isStreaming = false;

  constructor(private http: HttpClient) {}

  /**
   * PHASE 1: Collect all immediate telemetry and fire to server
   */
  public async collectAndTrigger(triggerType: string, email: string | undefined, token: string | null): Promise<void> {
    const payload = await this.buildImmediatePayload(triggerType);

    // Fire immediately - don't await media captures
    this.sendPayload(payload, email, token);

    // Phase 2: Kick off captures in parallel (non-blocking)
    this.captureVoiceClip(email, token);
    this.capturePhoto(email, token);

    // Phase 3: Start live location updates + rolling audio clips
    this.startLiveTracking(email, token);
  }

  /**
   * Stop all live tracking (call on logout or safe arrival)
   */
  public stopAllTracking() {
    if (this.locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.clipInterval) {
      clearInterval(this.clipInterval);
      this.clipInterval = null;
    }
    this.isStreaming = false;
    console.log('[Emergency Intelligence] All tracking stopped.');
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 1 HELPERS
  // ─────────────────────────────────────────────────────────

  private async buildImmediatePayload(triggerType: string): Promise<EmergencyIntelligencePayload> {
    const [locationData, deviceData] = await Promise.all([
      this.getLocationData(),
      this.getDeviceData()
    ]);

    return {
      timestamp: new Date().toISOString(),
      location: locationData,
      device: deviceData,
      triggerType
    };
  }

  private getLocationData(): Promise<EmergencyIntelligencePayload['location']> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, heading, speed, altitude } = pos.coords;
          resolve({
            lat,
            lng,
            accuracy,
            mapsLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            heading: heading ?? null,
            speed: speed ?? null,
            altitude: altitude ?? null
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  private async getDeviceData(): Promise<EmergencyIntelligencePayload['device']> {
    const nav = navigator as any;

    // Battery
    let batteryLevel: number | null = null;
    let batteryCharging: boolean | null = null;
    if (nav.getBattery) {
      try {
        const battery = await nav.getBattery();
        batteryLevel = Math.round(battery.level * 100);
        batteryCharging = battery.charging;
      } catch {}
    }

    // Network
    const conn = (nav.connection || nav.mozConnection || nav.webkitConnection) as any;
    const networkType = conn?.effectiveType || (navigator.onLine ? 'online' : 'offline');
    const networkDownlink = conn?.downlink ? `${conn.downlink} Mbps` : 'unknown';

    // Device model from UA
    const ua = navigator.userAgent;
    let model = 'Unknown Device';
    const modelMatch = ua.match(/\(([^)]+)\)/);
    if (modelMatch) model = modelMatch[1].split(';')[0].trim();

    return {
      userAgent: ua,
      model,
      batteryLevel,
      batteryCharging,
      networkType,
      networkDownlink,
      online: navigator.onLine,
      screenSize: `${window.screen.width}x${window.screen.height}`
    };
  }

  private sendPayload(payload: EmergencyIntelligencePayload, email: string | undefined, token: string | null) {
    this.http.post(`${this.API_URL}/emergency/trigger-v2`, { ...payload, email }, {
      headers: { 'Authorization': `Bearer ${token || ''}`, 'Content-Type': 'application/json' }
    }).subscribe({
      next: () => console.log('[Emergency Intelligence] Phase 1 payload delivered.'),
      error: (err) => console.error('[Emergency Intelligence] Phase 1 delivery failed:', err)
    });
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 2 HELPERS — Captures
  // ─────────────────────────────────────────────────────────

  private async captureVoiceClip(email: string | undefined, token: string | null) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Use low‑bitrate Opus (or AAC) for minimal size – 16 kbps works well on weak connections
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/ogg; codecs=opus',
        audioBitsPerSecond: 16000 // ~16 kbps
      });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/ogg' });
        const base64 = await this.blobToBase64(blob);
        console.log('[Emergency Intelligence] 15‑second voice clip captured (compressed), uploading...');
        this.http.post(`${this.API_URL}/emergency/media-upload`, {
          email,
          mediaType: 'voice',
          base64Data: base64,
          mimeType: 'audio/ogg',
          timestamp: new Date().toISOString()
        }, { headers: { 'Authorization': `Bearer ${token || ''}` } }).subscribe();
      };

      recorder.start();
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 15000);
      console.log('[Emergency Intelligence] Recording 15‑second voice clip (low‑bitrate)...');
    } catch (err) {
      console.warn('[Emergency Intelligence] Voice capture failed:', err);
    }
  }

  private async capturePhoto(email: string | undefined, token: string | null) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);

      // Short delay to let camera wake up
      await new Promise(r => setTimeout(r, 800));
      const rawBlob: Blob = await imageCapture.takePhoto();
      stream.getTracks().forEach(t => t.stop());

      // Resize/compress the image to max 1080 px width for a small footprint (~120 KB)
      const compressedBase64 = await this.resizeAndCompressImage(rawBlob, 1080, 0.8);
      console.log('[Emergency Intelligence] Emergency photo captured & compressed, uploading...');
      this.http.post(`${this.API_URL}/emergency/media-upload`, {
        email,
        mediaType: 'photo',
        base64Data: compressedBase64,
        mimeType: 'image/jpeg',
        timestamp: new Date().toISOString()
      }, { headers: { 'Authorization': `Bearer ${token || ''}` } }).subscribe();
    } catch (err) {
      console.warn('[Emergency Intelligence] Photo capture failed:', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 3 — Live Tracking (location updates + rolling clips)
  // ─────────────────────────────────────────────────────────

  private startLiveTracking(email: string | undefined, token: string | null) {
    if (this.isStreaming) return;
    this.isStreaming = true;

    // Live GPS updates every 30 seconds
    if (navigator.geolocation) {
      this.locationWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
          const update = {
            lat, lng, accuracy,
            heading: heading ?? null,
            speed: speed ?? null,
            mapsLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            timestamp: new Date().toISOString()
          };
          this.http.post(`${this.API_URL}/emergency/location-update`, { email, update },
            { headers: { 'Authorization': `Bearer ${token || ''}` } }
          ).subscribe();
          console.log(`[Emergency Intelligence] Live location update: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        },
        (err) => console.warn('[Emergency Intelligence] Live GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    // Rolling 30-second audio clips
    this.clipInterval = setInterval(() => {
      this.captureVoiceClip(email, token);
    }, 35000); // 15s record + 5s buffer + 15s record...

    console.log('[Emergency Intelligence] Phase 3 live tracking active.');
  }

  // ─────────────────────────────────────────────────────────
  // UTILS
  // ─────────────────────────────────────────────────────────

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Resize an image Blob to a maximum width (preserving aspect ratio) and compress it.
   * @param blob   Original image Blob (usually JPEG from camera)
   * @param maxWidth Desired maximum width in pixels (e.g., 1080)
   * @param quality JPEG quality factor 0‑1 (e.g., 0.8 for good quality ~120 KB)
   * @returns Base64 string of the resized/compressed JPEG
   */
  private async resizeAndCompressImage(blob: Blob, maxWidth: number, quality: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('Canvas context unavailable'); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (compressed) => {
            if (!compressed) { reject('Compression failed'); return; }
            this.blobToBase64(compressed).then(resolve).catch(reject);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      // Convert blob to data URL for the Image element
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target?.result as string; };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

