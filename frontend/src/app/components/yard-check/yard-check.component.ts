import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * YardCheck component – displays a live WebRTC view of the V380 Pro feed.
 * Expects a backend endpoint `/api/camera-stream?url=...` that returns a
 * WebRTC SDP offer. This component initiates the peer connection and
 * renders the video.
 */
@Component({
  selector: 'app-yard-check',
  templateUrl: './yard-check.component.html',
  styleUrls: ['./yard-check.component.css']
})
export class YardCheckComponent implements OnInit, OnDestroy {
  private pc: RTCPeerConnection | null = null;
  private streamUrl = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // In a real app, the RTSP URL would be stored in user settings.
    const stored = localStorage.getItem('safer_v380_url') || '';
    if (!stored) {
      console.warn('No V380 URL configured');
      return;
    }
    this.streamUrl = stored;
    this.startWebRTC();
  }

  ngOnDestroy(): void {
    if (this.pc) {
      this.pc.close();
    }
  }

  private async startWebRTC() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.pc.ontrack = ev => {
      const video = document.getElementById('yardVideo') as HTMLVideoElement;
      if (video) {
        video.srcObject = ev.streams[0];
        video.play();
      }
    };

    // Request an SDP offer from the backend (which bridges RTSP to WebRTC)
    const offer = await this.http
      .get<{ sdp: string }>(`/api/camera-stream?url=${encodeURIComponent(this.streamUrl)}`)
      .toPromise();
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offer?.sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    // Send the answer back to the server (optional depending on implementation)
    await this.http
      .post('/api/camera-stream/answer', { sdp: answer.sdp, url: this.streamUrl })
      .toPromise();
  }
}
