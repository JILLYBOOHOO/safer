import { Directive, HostListener, Input } from '@angular/core';

/**
 * Directive to add long‑press haptic feedback to any button.
 * Usage: <button hapticButton="200,100,200">…</button>
 * If no pattern is supplied, the default [200,100,200] ms vibration is used.
 */
@Directive({
  selector: '[hapticButton]'
})
export class HapticButtonDirective {
  @Input('hapticButton') pattern: string = '200,100,200';

  private pressTimer: any;

  @HostListener('mousedown') onMouseDown() {
    // start timeout for long press (500 ms)
    this.pressTimer = setTimeout(() => this.vibrate(), 500);
  }

  @HostListener('mouseup') onMouseUp() {
    clearTimeout(this.pressTimer);
  }

  @HostListener('mouseleave') onMouseLeave() {
    clearTimeout(this.pressTimer);
  }

  private vibrate(): void {
    if (navigator.vibrate) {
      const pattern = this.pattern.split(',').map(v => parseInt(v, 10));
      navigator.vibrate(pattern);
    }
  }
}
