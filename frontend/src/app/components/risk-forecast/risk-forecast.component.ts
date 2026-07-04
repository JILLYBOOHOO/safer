import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RiskForecast, RiskFactor, RiskForecastService } from '../../services/risk-forecast.service';

@Component({
  selector: 'app-risk-forecast',
  templateUrl: './risk-forecast.component.html',
  styleUrls: ['./risk-forecast.component.css']
})
export class RiskForecastComponent implements OnInit {
  @Input() routeName: string = '';
  @Output() startWalk = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  public forecast: RiskForecast | null = null;
  public loading = true;

  constructor(private riskService: RiskForecastService) {}

  ngOnInit() {
    this.loadForecast();
  }

  async loadForecast() {
    this.loading = true;
    this.forecast = await this.riskService.fetchForecast(this.routeName);
    this.loading = false;
  }

  getRatingColor(): string {
    if (!this.forecast) return '#6b7280';
    const r = this.forecast.safetyRating;
    if (r >= 80) return '#10b981';
    if (r >= 60) return '#f59e0b';
    if (r >= 40) return '#f97316';
    return '#ef4444';
  }

  getRatingLabel(): string {
    if (!this.forecast) return '';
    const lvl = this.forecast.overallLevel;
    const map: any = { safe: 'Safe', moderate: 'Moderate Risk', elevated: 'Elevated Risk', high: 'High Risk' };
    return map[lvl] || 'Unknown';
  }

  getSeverityClass(s: string): string {
    const map: any = {
      safe: 'sev-safe', low: 'sev-low', medium: 'sev-medium',
      high: 'sev-high', critical: 'sev-critical', unknown: 'sev-unknown'
    };
    return map[s] || 'sev-unknown';
  }

  get circumference(): number { return 2 * Math.PI * 48; }
  get dashOffset(): number {
    if (!this.forecast) return this.circumference;
    return this.circumference - (this.forecast.safetyRating / 100) * this.circumference;
  }

  onStart() { this.startWalk.emit(); }
  onDismiss() { this.dismissed.emit(); }
}
