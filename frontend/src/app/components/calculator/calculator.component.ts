import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';


@Component({
  selector: 'app-calculator',
  template: `
    <div class="calculator-wrapper">
      <div class="calculator-glass">
        <!-- Hidden system status indicator lines -->
        <div class="status-indicator-bar" aria-hidden="true">
          <span class="status-code">{{ systemErrorCode }}</span>
          <span class="status-led" [class.led-panic]="isDuressActive"></span>
        </div>

        <div class="calc-screen">
          <div class="history">{{ history }}</div>
          <div class="display">{{ currentInput || '0' }}</div>
        </div>

        <div class="calc-keys">
          <button type="button" class="key btn-secondary" (click)="clear()">C</button>
          <button type="button" class="key btn-secondary" (click)="setOperator('/')">/</button>
          <button type="button" class="key btn-secondary" (click)="setOperator('*')">*</button>
          <button type="button" class="key btn-danger" (click)="exitMask()" aria-label="Exit dashboard mockup">AC</button>
          
          <button type="button" class="key" (click)="appendNumber('7')">7</button>
          <button type="button" class="key" (click)="appendNumber('8')">8</button>
          <button type="button" class="key" (click)="appendNumber('9')">9</button>
          <button type="button" class="key btn-secondary" (click)="setOperator('-')">-</button>
          
          <button type="button" class="key" (click)="appendNumber('4')">4</button>
          <button type="button" class="key" (click)="appendNumber('5')">5</button>
          <button type="button" class="key" (click)="appendNumber('6')">6</button>
          <button type="button" class="key btn-secondary" (click)="setOperator('+')">+</button>
          
          <button type="button" class="key" (click)="appendNumber('1')">1</button>
          <button type="button" class="key" (click)="appendNumber('2')">2</button>
          <button type="button" class="key" (click)="appendNumber('3')">3</button>
          <button type="button" class="key btn-primary" (click)="calculate()">=</button>
          
          <button type="button" class="key double-width" (click)="appendNumber('0')">0</button>
          <button type="button" class="key" (click)="appendDecimal()">.</button>
        </div>
      </div>
      
      <div class="a11y-exit-text">
        Press AC twice to return to pattern unlock.
      </div>
    </div>
  `,
  styles: [`
    .calculator-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      min-height: 80vh;
      padding: 16px 16px 16px 10%;
    }
    .calculator-glass {
      width: 100%;
      max-width: 340px;
      background: rgba(22, 28, 38, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .status-indicator-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 4px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.25);
      font-family: monospace;
    }
    .status-code {
      letter-spacing: 1px;
    }
    .status-led {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981; /* Green ok state */
    }
    .status-led.led-panic {
      background: #ef4444; /* Alert state */
      box-shadow: 0 0 6px #ef4444;
    }
    .calc-screen {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 12px;
      padding: 16px;
      text-align: right;
      font-family: monospace;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }
    .history {
      color: var(--text-muted);
      font-size: 14px;
      min-height: 20px;
    }
    .display {
      color: #fff;
      font-size: 32px;
      overflow-x: auto;
      white-space: nowrap;
      margin-top: 4px;
    }
    .calc-keys {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .key {
      min-height: 56px;
      border-radius: 12px;
      font-size: 20px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(255, 255, 255, 0.03);
      color: #fff;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s;
    }
    .key:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .key:active {
      transform: scale(0.96);
    }
    .double-width {
      grid-column: span 2;
    }
    .a11y-exit-text {
      margin-top: 16px;
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
    }
  `]
})
export class CalculatorComponent {
  public currentInput = '';
  public history = '';
  private prevInput = '';
  private operator = '';
  private shouldResetScreen = false;
  private acClickCount = 0;

  // Custom static signals: low power, alert state markers
  public systemErrorCode = 'ERR: low_pwr_20';
  public isDuressActive = false;

  constructor(private router: Router, private securityService: SecurityService) {
    // Check if duress mode is active in the session storage to reflect status LED
    this.isDuressActive = !!sessionStorage.getItem('safer_duress_token');
    if (this.isDuressActive) {
      this.systemErrorCode = 'ERR: low_pwr_20 (D_ACTIVE)';
    }
  }

  public appendNumber(num: string) {
    if (this.shouldResetScreen) {
      this.currentInput = '';
      this.shouldResetScreen = false;
    }
    if (this.currentInput === '0') {
      this.currentInput = num;
    } else {
      this.currentInput += num;
    }
    this.acClickCount = 0;
  }

  public appendDecimal() {
    if (this.shouldResetScreen) {
      this.currentInput = '0';
      this.shouldResetScreen = false;
    }
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  public clear() {
    this.currentInput = '';
    this.prevInput = '';
    this.operator = '';
    this.history = '';
    this.acClickCount = 0;
  }

  public setOperator(op: string) {
    if (this.operator && this.currentInput) {
      this.calculate();
    }
    this.operator = op;
    this.prevInput = this.currentInput;
    this.history = `${this.prevInput} ${this.operator}`;
    this.shouldResetScreen = true;
    this.acClickCount = 0;
  }

  public calculate() {
    if (!this.operator || !this.prevInput || !this.currentInput) return;
    
    const v1 = parseFloat(this.prevInput);
    const v2 = parseFloat(this.currentInput);
    let result = 0;

    switch (this.operator) {
      case '+': result = v1 + v2; break;
      case '-': result = v1 - v2; break;
      case '*': result = v1 * v2; break;
      case '/': result = v2 !== 0 ? v1 / v2 : 0; break;
    }

    this.history = `${this.prevInput} ${this.operator} ${this.currentInput} =`;
    this.currentInput = result.toString();
    this.operator = '';
    this.shouldResetScreen = true;

    // Hidden key combinations for testing verification back to dashboard:
    // Enter math combination 7777 to reset the duress state.
    if (result === 7777) {
      this.securityService.purgeLocalData();
      this.router.navigate(['/login']);
    }
  }

  public exitMask() {
    this.acClickCount++;
    if (this.acClickCount >= 2) {
      // Return to pattern login
      this.securityService.purgeLocalData();
      this.router.navigate(['/login']);
    }
  }
}
