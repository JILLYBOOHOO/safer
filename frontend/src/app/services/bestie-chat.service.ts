import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ChatMessage {
  from: 'user' | 'bot' | 'system';
  text: string;
  timestamp: Date;
}

export interface ScheduledTask {
  id: string;
  action: string;
  targetTime: string; // ISO string
  contact: string;
  description: string;
  fired: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class BestieChatService {
  private messagesSubject = new Subject<ChatMessage>();
  public messages$: Observable<ChatMessage> = this.messagesSubject.asObservable();

  private scheduledTasks: ScheduledTask[] = [];
  private schedulerInterval: any;

  constructor() {
    this.loadScheduledTasks();
    this.startScheduler();
  }

  sendUserMessage(text: string) {
    const msg: ChatMessage = { from: 'user', text, timestamp: new Date() };
    this.messagesSubject.next(msg);
  }

  sendBotMessage(text: string) {
    const msg: ChatMessage = { from: 'bot', text, timestamp: new Date() };
    this.messagesSubject.next(msg);
  }

  sendSystemMessage(text: string) {
    const msg: ChatMessage = { from: 'system', text, timestamp: new Date() };
    this.messagesSubject.next(msg);
  }

  // ═══════════════════════════════════════
  // OFFLINE TRAINING INTENT ENGINE
  // ═══════════════════════════════════════

  processUserInput(text: string): string {
    const lower = text.toLowerCase().trim();

    // Check for scheduling commands first
    const scheduleResult = this.parseScheduleCommand(lower, text);
    if (scheduleResult) return scheduleResult;

    // Check for training / help intents
    const trainingResponse = this.matchTrainingIntent(lower);
    if (trainingResponse) return trainingResponse;

    // Fallback conversational
    return this.fallbackResponse(lower);
  }

  private matchTrainingIntent(lower: string): string | null {
    // Pattern-based matching for training questions
    const intents: { patterns: string[]; response: string }[] = [
      {
        patterns: ['how do i change', 'change my', 'update my', 'secret language', 'custom language', 'stegano', 'hidden code'],
        response: `🔐 **Changing Your Secret Language / Stegano Code:**\n\n` +
          `1️⃣ Go to **Dashboard** → **Profile** tab\n` +
          `2️⃣ Scroll to the "Security Pattern" section\n` +
          `3️⃣ Tap **"Change Safe Pattern"** or **"Change Duress Pattern"**\n` +
          `4️⃣ Enter your current pattern to verify\n` +
          `5️⃣ Draw or enter a new code\n` +
          `6️⃣ Confirm the new code and save\n\n` +
          `⚠️ Your safe code unlocks the dashboard. Your duress code silently triggers an SOS alert.`
      },
      {
        patterns: ['set up', 'setup', 'getting started', 'how do i start', 'onboarding', 'first time', 'new user'],
        response: `👋 **Getting Started with Safer:**\n\n` +
          `1️⃣ **Create Account** — Sign up with name, email & password\n` +
          `2️⃣ **Choose Auth Method** — Pick Passcode, Pattern Lock, or Biometric\n` +
          `3️⃣ **Set Safe Code** — This unlocks your real dashboard\n` +
          `4️⃣ **Set Duress Code** — This silently triggers SOS while showing a fake calculator\n` +
          `5️⃣ **Add Emergency Contact** — From the Dashboard → Contact tab\n` +
          `6️⃣ **Save Home Location** — Dashboard → Profile → "Use Current Location"\n` +
          `7️⃣ **Fill Medical Card** — Dashboard → Medical tab (optional)\n\n` +
          `💡 You can skip any step and set it up later from the sidebar!`
      },
      {
        patterns: ['emergency contact', 'add contact', 'change contact', 'who gets notified'],
        response: `📞 **Managing Emergency Contacts:**\n\n` +
          `1️⃣ Open **Dashboard** → **Emergency Contact** tab\n` +
          `2️⃣ Enter their Name, Phone (WhatsApp), Email, and Relationship\n` +
          `3️⃣ Click **"Save Emergency Contact"**\n\n` +
          `When an SOS is triggered, this contact receives:\n` +
          `• 📍 Your live GPS location\n` +
          `• 🎤 Voice recordings\n` +
          `• 📷 Photos\n` +
          `• 📱 Device battery & network info\n\n` +
          `All data is AES-256 encrypted.`
      },
      {
        patterns: ['medical card', 'health info', 'blood type', 'allergies', 'medication'],
        response: `🏥 **Digital Medical Card:**\n\n` +
          `1️⃣ Go to **Dashboard** → **Medical Card** tab\n` +
          `2️⃣ Fill in Blood Type, Allergies, Medications, Conditions\n` +
          `3️⃣ Add any special medical notes\n` +
          `4️⃣ Click **"Save Medical Card"**\n\n` +
          `This info is encrypted and only visible when you're logged in. First responders can access it in an emergency.`
      },
      {
        patterns: ['fake call', 'fake phone call', 'pretend call', 'escape call'],
        response: `📱 **Fake Call Feature:**\n\n` +
          `Trigger a realistic incoming phone call to create an excuse to leave any uncomfortable situation.\n\n` +
          `1️⃣ Tap **"📱 Fake Call"** from the Dashboard or Sidebar\n` +
          `2️⃣ A full-screen call screen appears with ringtone\n` +
          `3️⃣ Tap **Answer** to simulate being on a call\n` +
          `4️⃣ Tap **End Call** when you've safely left\n\n` +
          `💡 Customize the caller name in Dashboard → Profile settings.`
      },
      {
        patterns: ['incident', 'evidence', 'log', 'sha-256', 'hash', 'proof'],
        response: `🗂️ **Evidence Locker (Incident Log):**\n\n` +
          `Every emergency automatically captures:\n` +
          `• 📷 Photos from your camera\n` +
          `• 📍 GPS coordinates\n` +
          `• 🎤 Audio recordings\n` +
          `• 🎥 Video (if available)\n` +
          `• 🕒 Precise timestamp\n` +
          `• 🔐 SHA-256 hash for integrity proof\n\n` +
          `View your incident history: **Sidebar → Evidence Locker**\n` +
          `You can also log manual incidents from the Evidence Locker page.`
      },
      {
        patterns: ['location', 'safe zone', 'gps', 'save location', 'home location', 'frequent places'],
        response: `📍 **Location Profiles:**\n\n` +
          `Save frequently visited spots to improve safe-zone detection.\n\n` +
          `1️⃣ Go to **Sidebar → Location Profiles**\n` +
          `2️⃣ Enter a name (Home, Work, School, etc.)\n` +
          `3️⃣ Tap **"📍 Use Current Location"** for instant GPS\n` +
          `4️⃣ Click **"Save Location"**\n\n` +
          `The app uses these to detect when you leave safe zones and can auto-prompt check-ins.`
      },
      {
        patterns: ['schedule', 'check in', 'check-in', 'timer', 'remind', 'send location', 'at ', 'pm ', 'am '],
        response: `⏰ **Scheduling Check-ins & Actions:**\n\n` +
          `You can schedule automated actions by typing natural commands:\n\n` +
          `Examples:\n` +
          `• "at 7pm send location to dad"\n` +
          `• "at 9:30am check in"\n` +
          `• "schedule check-in at 6pm"\n\n` +
          `Active schedules run in the background and trigger alerts/notifications when the time arrives.` +
          `\n\nType a command like "at 7pm send location to dad" to try it!`
      },
      {
        patterns: ['sos', 'panic', 'emergency button', 'trigger alert'],
        response: `🆘 **SOS Emergency Button:**\n\n` +
          `1️⃣ Tap the red **SOS** button on the Dashboard\n` +
          `2️⃣ This immediately:\n` +
          `   • Sends your GPS to your emergency contact via WhatsApp\n` +
          `   • Starts recording audio & taking photos\n` +
          `   • Logs an incident with SHA-256 hash\n` +
          `   • Shows a live emergency banner\n\n` +
          `3️⃣ When safe, tap **"✅ I'm Safe — Stop Tracking"**\n\n` +
          `The duress code does the same thing silently while showing a fake calculator screen.`
      },
      {
        patterns: ['what can you do', 'help', 'features', 'what is safer', 'about'],
        response: `🛡️ **I'm your Safer Virtual Agent!** Here's what I can help with:\n\n` +
          `📋 **Setup Guides** — "How do I set up my account?"\n` +
          `🔐 **Security** — "How do I change my secret language?"\n` +
          `📞 **Contacts** — "How do I add an emergency contact?"\n` +
          `🏥 **Medical** — "How do I fill my medical card?"\n` +
          `📱 **Fake Call** — "How does the fake call work?"\n` +
          `🗂️ **Evidence** — "What is the evidence locker?"\n` +
          `📍 **Locations** — "How do I save my locations?"\n` +
          `⏰ **Scheduling** — "at 7pm send location to dad"\n` +
          `🆘 **Emergency** — "How does SOS work?"\n\n` +
          `Just ask me anything! All responses are 100% offline — no internet needed.`
      }
    ];

    for (const intent of intents) {
      for (const pattern of intent.patterns) {
        if (lower.includes(pattern)) {
          return intent.response;
        }
      }
    }
    return null;
  }

  // ═══════════════════════════════════════
  // SCHEDULING ENGINE
  // ═══════════════════════════════════════

  private parseScheduleCommand(lower: string, original: string): string | null {
    // Match patterns like "at 7pm send location to dad"
    // or "at 9:30am check in"
    const timeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(.+)/i;
    const match = lower.match(timeRegex);

    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3].toLowerCase();
    const actionText = match[4].trim();

    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    // Calculate next occurrence of this time
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    // Parse the contact name
    let contact = 'emergency contact';
    const toMatch = actionText.match(/(?:to|for)\s+(\w+(?:\s+\w+)?)\s*$/i);
    if (toMatch) {
      contact = toMatch[1];
    }

    const task: ScheduledTask = {
      id: 'task_' + Date.now(),
      action: actionText,
      targetTime: target.toISOString(),
      contact,
      description: original,
      fired: false,
      createdAt: new Date().toISOString()
    };

    this.scheduledTasks.push(task);
    this.saveScheduledTasks();

    const timeStr = target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `✅ **Scheduled Successfully!**\n\n` +
      `⏰ **Time:** ${timeStr} on ${dateStr}\n` +
      `📋 **Action:** ${actionText}\n` +
      `👤 **Contact:** ${contact}\n\n` +
      `I'll send you a notification when it's time. You can view all scheduled tasks by asking "show my schedule".`;
  }

  getScheduledTasks(): ScheduledTask[] {
    return this.scheduledTasks.filter(t => !t.fired);
  }

  getAllScheduledTasks(): ScheduledTask[] {
    return this.scheduledTasks;
  }

  removeScheduledTask(id: string): void {
    this.scheduledTasks = this.scheduledTasks.filter(t => t.id !== id);
    this.saveScheduledTasks();
  }

  private loadScheduledTasks(): void {
    const stored = localStorage.getItem('safer_scheduled_tasks');
    this.scheduledTasks = stored ? JSON.parse(stored) : [];
  }

  private saveScheduledTasks(): void {
    localStorage.setItem('safer_scheduled_tasks', JSON.stringify(this.scheduledTasks));
  }

  private startScheduler(): void {
    // Check every 30 seconds for tasks that need to fire
    this.schedulerInterval = setInterval(() => {
      const now = new Date();
      for (const task of this.scheduledTasks) {
        if (task.fired) continue;
        const target = new Date(task.targetTime);
        if (now >= target) {
          task.fired = true;
          this.saveScheduledTasks();
          this.fireTask(task);
        }
      }
    }, 30000);
  }

  private fireTask(task: ScheduledTask): void {
    // Send notification
    this.sendBotMessage(
      `🔔 **Scheduled Task Triggered!**\n\n` +
      `⏰ It's time for: **${task.action}**\n` +
      `👤 Contact: ${task.contact}\n\n` +
      `📍 Attempting to send your current location...`
    );

    // Try to send location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
          this.sendBotMessage(
            `📍 **Location captured for ${task.contact}:**\n` +
            `Lat: ${lat}, Lng: ${lng}\n` +
            `🗺️ Map: ${mapsLink}\n\n` +
            `In production, this would be sent via WhatsApp/SMS to ${task.contact}.`
          );
        },
        () => {
          this.sendBotMessage(`⚠️ Could not capture GPS for scheduled task. Location permissions may be disabled.`);
        }
      );
    }

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Safer — Scheduled Task', {
        body: `Time to: ${task.action}`,
        icon: '/assets/icons/icon-192x192.png'
      });
    }
  }

  private fallbackResponse(lower: string): string {
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return `👋 Hey there! I'm your Safer Virtual Agent. Ask me anything about the app — like "How do I set up my account?" or "What can you do?" — all completely offline!`;
    }
    if (lower.includes('thank')) {
      return `You're welcome! Stay safe out there. 🛡️ Let me know if you need anything else.`;
    }
    if (lower.includes('show') && (lower.includes('schedule') || lower.includes('tasks'))) {
      const tasks = this.getScheduledTasks();
      if (tasks.length === 0) {
        return `📋 You have no upcoming scheduled tasks. Try scheduling one: "at 7pm send location to dad"`;
      }
      let response = `📋 **Your Scheduled Tasks (${tasks.length}):**\n\n`;
      tasks.forEach((t, i) => {
        const time = new Date(t.targetTime).toLocaleString('en-US', {
          weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true
        });
        response += `${i + 1}. ⏰ ${time} — ${t.action}\n`;
      });
      return response;
    }
    return `🤔 I didn't quite catch that. Try asking me:\n\n` +
      `• "How do I set up my account?"\n` +
      `• "How does the fake call work?"\n` +
      `• "at 7pm send location to dad"\n` +
      `• "show my schedule"\n` +
      `• "help"\n\n` +
      `All responses work 100% offline!`;
  }
}
