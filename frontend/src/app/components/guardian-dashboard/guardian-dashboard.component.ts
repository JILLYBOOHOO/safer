import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SecurityService } from '../../services/security.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-guardian-dashboard',
  templateUrl: './guardian-dashboard.component.html',
  styleUrls: ['./guardian-dashboard.component.css']
})
export class GuardianDashboardComponent implements OnInit {
  public dependents: any[] = [];
  public isLoading = true;

  constructor(
    private http: HttpClient,
    private securityService: SecurityService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    // Poll every 30s
    setInterval(() => this.loadDashboard(), 30000);
  }

  public loadDashboard() {
    this.http.get<{success: boolean, dependents: any[]}>(
      `${this.securityService['API_URL']}/family/dashboard`, 
      { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }
    ).subscribe(
      (res) => {
        if (res.success) {
          this.dependents = res.dependents;
        }
        this.isLoading = false;
      },
      (err) => {
        console.error('Failed to load guardian dashboard', err);
        this.isLoading = false;
      }
    );
  }

  public inviteMember(relationship: string) {
    const phone = prompt('Enter WhatsApp Phone Number of the family member to invite:');
    if (!phone) return;

    this.http.post(`${this.securityService['API_URL']}/family/invite`, {
      contactPhone: phone,
      relationship
    }, { headers: { 'Authorization': `Bearer ${this.securityService.token}` } }).subscribe(
      (res: any) => {
        this.alertService.success(res.message, 'Invite Sent');
      },
      (err) => {
        this.alertService.error('Failed to send invite.');
      }
    );
  }
}
