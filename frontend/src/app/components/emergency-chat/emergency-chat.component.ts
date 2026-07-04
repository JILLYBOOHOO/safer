import { Component, OnInit } from '@angular/core';
import { EmergencyService } from '../../services/emergency.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-emergency-chat',
  template: `
    <div class="chat-window glass-panel" *ngIf="showChat">
      <h3>Bestie Emergency Assistant 🤖</h3>
      <div class="messages" *ngIf="!sosSent">
        <p>Hello! I’m here to keep you safe. How can I help you today?</p>
        <button class="btn-primary" (click)="triggerSOS()">🚨 SOS – Send Emergency Alert</button>
      </div>
      <div class="sos-confirm" *ngIf="sosSent">
        <p>🚑 Emergency alert sent! Help is on the way.</p>
        <button class="btn-ghost" (click)="showChat = false">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .chat-window { position: fixed; bottom: 20px; right: 20px; width: 300px; padding: 16px; background: var(--bg-deep, #111); color: var(--text-primary); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .messages, .sos-confirm { text-align: center; }
    button { margin-top: 12px; width: 100%; }
  `]
})
export class EmergencyChatComponent implements OnInit {
  showChat = true;
  sosSent = false;

  constructor(private emergencyService: EmergencyService, private alertService: AlertService) {}

  ngOnInit() {}

  async triggerSOS() {
    try {
      await this.emergencyService.sendSOS();
      this.sosSent = true;
      this.alertService.success('SOS sent successfully!', 'Safety');
    } catch (e) {
      this.alertService.error('Failed to send SOS.', 'Error');
    }
  }
}
