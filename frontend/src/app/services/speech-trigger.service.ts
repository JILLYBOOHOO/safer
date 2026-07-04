import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpeechTriggerService {
  private recognition: any = null;
  private isListening = false;
  private activationKeywords = ['activate panic', 'help me now', 'emergency protocol', 'lockdown app', 'safe zone help'];
  
  public onTriggerTripped = new EventEmitter<string>();
  public onStatusChange = new EventEmitter<boolean>();

  constructor() {
    this.initSpeechEngine();
  }

  private initSpeechEngine() {
    const SpeechSpeech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechSpeech) {
      console.warn('[Vocal Trigger] HTML5 Web Speech API is not supported in this browser environment.');
      return;
    }

    this.recognition = new SpeechSpeech();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStatusChange.emit(true);
      console.log('[Vocal Trigger] Speech Recognition active. Listening offline...');
    };

    this.recognition.onresult = (event: any) => {
      const resultsLength = event.results.length;
      for (let i = event.resultIndex; i < resultsLength; ++i) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.toLowerCase().trim();
          console.log(`[Vocal Trigger] Heard: "${text}"`);
          
          // Check if statement contains any of our activation keywords
          for (const keyword of this.activationKeywords) {
            if (text.includes(keyword)) {
              console.warn(`[Vocal Trigger] Critical vocal keyword matched: "${keyword}"!`);
              this.onTriggerTripped.emit(`Vocal: ${keyword}`);
              break;
            }
          }
        }
      }
    };

    this.recognition.onerror = (err: any) => {
      console.error('[Vocal Trigger] Speech Recognition encountered an error:', err.error);
      if (err.error === 'not-allowed') {
        this.isListening = false;
        this.onStatusChange.emit(false);
      }
    };

    this.recognition.onend = () => {
      // Loop the listener automatically if intended to stay active
      if (this.isListening) {
        console.log('[Vocal Trigger] Stream closed unexpectedly. Rebooting Speech engine.');
        try {
          this.recognition.start();
        } catch (e) {
          // Prevent crashes on simultaneous start
        }
      }
    };
  }

  public startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('[Vocal Trigger] Speech engine already running.');
    }
  }

  public stopListening() {
    this.isListening = false;
    if (!this.recognition) return;
    try {
      this.recognition.stop();
      this.onStatusChange.emit(false);
      console.log('[Vocal Trigger] Speech Recognition deactivated.');
    } catch (e) {
      console.error('[Vocal Trigger] Failed to stop speech recognition:', e);
    }
  }

  public getKeywords(): string[] {
    return this.activationKeywords;
  }
}
