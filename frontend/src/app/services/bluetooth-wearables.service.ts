import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BluetoothWearablesService {
  private clickCount = 0;
  private clickTimer: any = null;
  private heartRateDevice: any = null;
  private heartRateCharacteristic: any = null;
  private isMonitoringHR = false;

  public onBluetoothSosTriggered = new EventEmitter<{ source: string, data?: any }>();

  constructor() {}

  /**
   * Initializes MediaSession API hijacking to listen for earbud play/pause clicks
   */
  public initMediaSessionHijack() {
    if ('mediaSession' in navigator) {
      console.log('[Bluetooth Wearables] MediaSession hijacked for earbud SOS tracking.');
      
      try {
        navigator.mediaSession.setActionHandler('play', () => this.handleMediaClick());
        navigator.mediaSession.setActionHandler('pause', () => this.handleMediaClick());
      } catch (e) {
        console.warn('[Bluetooth Wearables] MediaSession action handlers not supported.');
      }
    }
  }

  private handleMediaClick() {
    this.clickCount++;
    console.log(`[Bluetooth Wearables] Earbud click registered (${this.clickCount}/3)`);

    if (this.clickCount >= 3) {
      console.error('[Bluetooth Wearables] Triple click registered! Triggering SOS.');
      this.onBluetoothSosTriggered.emit({ source: 'earbud_triple_click' });
      this.resetClickCounter();
    } else {
      // Reset after 2 seconds if third click not registered
      if (this.clickTimer) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => this.resetClickCounter(), 2000);
    }
  }

  private resetClickCounter() {
    this.clickCount = 0;
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
  }

  /**
   * Requests connection to a Bluetooth Heart Rate monitor
   * Requires user interaction to trigger the browser prompt
   */
  public async connectBiometricDevice() {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error('Web Bluetooth API is not available in this browser.');
      }

      console.log('[Bluetooth Wearables] Requesting Bluetooth Device...');
      this.heartRateDevice = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }]
      });

      console.log('[Bluetooth Wearables] Connecting to GATT Server...');
      const server = await this.heartRateDevice.gatt.connect();

      console.log('[Bluetooth Wearables] Getting Heart Rate Service...');
      const service = await server.getPrimaryService('heart_rate');

      console.log('[Bluetooth Wearables] Getting Heart Rate Measurement Characteristic...');
      this.heartRateCharacteristic = await service.getCharacteristic('heart_rate_measurement');

      await this.heartRateCharacteristic.startNotifications();
      this.heartRateCharacteristic.addEventListener('characteristicvaluechanged', this.handleHeartRateMeasurement);
      
      this.isMonitoringHR = true;
      console.log('[Bluetooth Wearables] Heart rate monitor successfully linked!');

      this.heartRateDevice.addEventListener('gattserverdisconnected', this.onDisconnected);

    } catch (error) {
      console.error('[Bluetooth Wearables] Biometric connection failed:', error);
      throw error;
    }
  }

  public disconnectBiometricDevice() {
    if (this.heartRateDevice && this.heartRateDevice.gatt.connected) {
      this.heartRateDevice.gatt.disconnect();
    }
  }

  private onDisconnected = () => {
    console.warn('[Bluetooth Wearables] Biometric device disconnected.');
    this.isMonitoringHR = false;
    this.heartRateDevice = null;
    this.heartRateCharacteristic = null;
  }

  private handleHeartRateMeasurement = (event: any) => {
    if (!this.isMonitoringHR) return;

    const value = event.target.value;
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    let heartRate: number;
    
    if (rate16Bits) {
      heartRate = value.getUint16(1, true);
    } else {
      heartRate = value.getUint8(1);
    }

    // Spike threshold
    if (heartRate > 150) {
      console.warn(`[Bluetooth Wearables] ABNORMAL HEART RATE SPIKE DETECTED: ${heartRate} BPM`);
      this.onBluetoothSosTriggered.emit({ source: 'heart_rate_spike', data: heartRate });
    }
  }
}
