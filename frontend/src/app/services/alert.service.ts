import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'danger';

export interface AlertMessage {
  id: number;
  type: AlertType;
  title: string;
  message: string;
  duration: number; // ms, 0 = persist until dismissed
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private counter = 0;
  public alerts$ = new Subject<AlertMessage>();
  public dismiss$ = new Subject<number>();

  private show(type: AlertType, title: string, message: string, duration = 5000) {
    const id = ++this.counter;
    this.alerts$.next({ id, type, title, message, duration });
    return id;
  }

  success(message: string, title = 'Success', duration = 5000) {
    return this.show('success', title, message, duration);
  }

  error(message: string, title = 'Error', duration = 7000) {
    return this.show('error', title, message, duration);
  }

  warning(message: string, title = 'Warning', duration = 6000) {
    return this.show('warning', title, message, duration);
  }

  info(message: string, title = 'Info', duration = 5000) {
    return this.show('info', title, message, duration);
  }

  danger(message: string, title = 'Security Alert', duration = 0) {
    return this.show('danger', title, message, duration);
  }

  dismiss(id: number) {
    this.dismiss$.next(id);
  }
}
