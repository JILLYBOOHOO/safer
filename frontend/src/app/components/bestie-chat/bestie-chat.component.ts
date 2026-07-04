import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { EmergencyService } from '../../services/emergency.service';
import { BestieChatService, ScheduledTask } from '../../services/bestie-chat.service';

@Component({
  selector: 'app-bestie-chat',
  templateUrl: './bestie-chat.component.html',
  styleUrls: ['./bestie-chat.component.css']
})
export class BestieChatComponent implements OnInit, AfterViewChecked {
  messages: { from: 'user' | 'bot'; text: string }[] = [];
  showChat = false;
  userInput: string = '';
  hasEmergencyContact: boolean = false;
  showSchedulePanel = false;

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  private shouldScroll = false;

  get scheduledTasks(): ScheduledTask[] {
    return this.chatService.getScheduledTasks();
  }

  constructor(
    private emergencyService: EmergencyService,
    private chatService: BestieChatService
  ) {}

  ngOnInit(): void {
    this.hasEmergencyContact = false;
    this.botMessage(
      `👋 Welcome to your **Safer Virtual Agent**!\n\n` +
      `I'm your offline assistant — no internet or AI tokens needed.\n\n` +
      `Try asking:\n` +
      `• "How do I set up my account?"\n` +
      `• "How does the fake call work?"\n` +
      `• "at 7pm send location to dad"\n` +
      `• "help" for all available commands`
    );

    // Subscribe to bot messages from the service (for scheduled task notifications)
    this.chatService.messages$.subscribe(msg => {
      if (msg.from === 'bot') {
        this.messages.push({ from: 'bot', text: msg.text });
        this.shouldScroll = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggleChat() {
    this.showChat = !this.showChat;
  }

  sendMessage(): void {
    const trimmed = this.userInput.trim();
    if (!trimmed) return;
    this.userMessage(trimmed);
    this.userInput = '';

    // Check for SOS keywords
    if (/^(sos|panic|help me|emergency)$/i.test(trimmed)) {
      this.handleSos();
      return;
    }

    // Use the training/scheduling engine
    const response = this.chatService.processUserInput(trimmed);
    this.botMessage(response);
  }

  private userMessage(text: string) {
    this.messages.push({ from: 'user', text });
    this.shouldScroll = true;
  }

  private botMessage(text: string) {
    this.messages.push({ from: 'bot', text });
    this.shouldScroll = true;
  }

  public handleSos() {
    this.botMessage('🚨 I\'m contacting emergency services right now. Please stay calm.');
    this.emergencyService.sendSosAlert().subscribe({
      next: () => this.botMessage('✅ Your emergency contacts have been notified.'),
      error: () => this.botMessage('⚠️ Something went wrong while sending the alert. Try the SOS button on the dashboard.')
    });
  }

  toggleSchedulePanel(): void {
    this.showSchedulePanel = !this.showSchedulePanel;
  }

  removeTask(id: string): void {
    this.chatService.removeScheduledTask(id);
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }
}
