import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PovCaptureService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];

  public onCaptureComplete = new EventEmitter<{ type: string, fileBlob: Blob, url: string }>();
  public onError = new EventEmitter<string>();

  constructor() {}

  /**
   * Silently initializes the device's rear/environmental camera
   */
  public async initCamera() {
    try {
      if (this.mediaStream) return;

      console.log('[POV Capture] Requesting environmental camera access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      console.log('[POV Capture] Camera stream acquired successfully.');
    } catch (err: any) {
      console.error('[POV Capture] Failed to access camera/mic:', err);
      this.onError.emit(`Camera access failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Takes a silent high-resolution snapshot and emits the blob
   */
  public async captureSnapshot() {
    try {
      await this.initCamera();
      
      if (!this.mediaStream) throw new Error('No media stream available.');

      const videoTrack = this.mediaStream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      
      console.log('[POV Capture] Taking silent snapshot...');
      const blob = await imageCapture.takePhoto();
      
      const url = URL.createObjectURL(blob);
      this.onCaptureComplete.emit({ type: 'image', fileBlob: blob, url });
      
      return { blob, url };
    } catch (err: any) {
      console.error('[POV Capture] Snapshot failed:', err);
      this.onError.emit(`Snapshot failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Records a 10 second audio/video clip and emits the blob
   */
  public async captureVideoClip(durationMs: number = 10000) {
    try {
      await this.initCamera();
      
      if (!this.mediaStream) throw new Error('No media stream available.');

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        console.log('[POV Capture] Video clip recording complete.');
        this.onCaptureComplete.emit({ type: 'video', fileBlob: blob, url });
        
        // Push to server automatically (mock implementation of upload)
        this.uploadToServer(blob, 'video');
      };

      console.log(`[POV Capture] Starting ${durationMs / 1000}s recording...`);
      this.mediaRecorder.start();

      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }, durationMs);

    } catch (err: any) {
      console.error('[POV Capture] Video capture failed:', err);
      this.onError.emit(`Video capture failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Stops the media stream and releases hardware access
   */
  public shutdownCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
      console.log('[POV Capture] Camera hardware released.');
    }
  }

  private uploadToServer(blob: Blob, type: string) {
    const formData = new FormData();
    formData.append('media', blob, `pov_capture_${Date.now()}.${type === 'video' ? 'webm' : 'jpg'}`);
    
    fetch('/api/emergency/pov-upload', {
      method: 'POST',
      body: formData
    }).then(res => res.json())
      .then(data => console.log('[POV Capture] Upload success', data))
      .catch(err => console.error('[POV Capture] Upload failed', err));
  }
}
