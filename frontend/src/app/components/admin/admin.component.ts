import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';

@Component({
  selector: 'app-admin',
  template: `
    <main class="container">
      <header class="admin-header glass-panel">
        <div>
          <h1>Administrative Control Console</h1>
          <p class="text-secondary">Security management overview, audit logs, and diagnostic ticket records.</p>
        </div>
        <button class="btn-accessible btn-secondary" (click)="goBack()">
          Back to Dashboard
        </button>
      </header>

      <div class="admin-dashboard-grid">
        <!-- User Profiles Management (CRUD) -->
        <section class="glass-panel users-panel" aria-labelledby="users-management-title">
          <h2 id="users-management-title" class="title-margin">User Profiles Configuration</h2>
          <div class="users-list">
            <div *ngFor="let u of users" class="user-row">
              <div class="user-info">
                <h3>{{ u.name }}</h3>
                <p class="text-secondary text-sm">{{ u.email }}</p>
                <div class="badges-row">
                  <span class="role-badge" [class.badge-admin]="u.role === 'admin'">{{ u.role }}</span>
                  <span class="status-badge" [class.badge-active]="u.status === 'active'" [class.badge-suspended]="u.status === 'suspended'">
                    {{ u.status }}
                  </span>
                </div>
              </div>
              <div class="user-actions">
                <button 
                  class="btn-accessible btn-secondary btn-sm" 
                  (click)="toggleUserRole(u.id, u.role)"
                  aria-label="Toggle user role"
                >
                  Make {{ u.role === 'admin' ? 'User' : 'Admin' }}
                </button>
                <button 
                  *ngIf="u.status === 'active'" 
                  class="btn-accessible btn-secondary btn-sm text-warning" 
                  (click)="updateUserStatus(u.id, 'suspended')"
                  aria-label="Suspend user profile"
                >
                  Suspend
                </button>
                <button 
                  *ngIf="u.status === 'suspended'" 
                  class="btn-accessible btn-secondary btn-sm text-success" 
                  (click)="updateUserStatus(u.id, 'active')"
                  aria-label="Activate user profile"
                >
                  Unsuspend
                </button>
                <button 
                  class="btn-accessible btn-danger btn-sm" 
                  (click)="purgeUser(u.id)"
                  aria-label="Permanently delete user profile"
                >
                  Purge Profile
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- System Audit Log -->
        <section class="glass-panel logs-panel" aria-labelledby="audit-logs-title">
          <h2 id="audit-logs-title" class="title-margin">System Audit Logs (Last 48 Hours)</h2>
          <p class="text-secondary text-margin">Telemetry logs older than 48 hours are pruned automatically by the MySQL event engine.</p>
          
          <div class="logs-container">
            <div *ngFor="let log of auditLogs" class="log-entry" [class.log-panic]="log.event_type === 'duress_activated' || log.event_type === 'emergency_trigger'">
              <div class="log-header">
                <span class="log-type">{{ log.event_type }}</span>
                <span class="log-time">{{ log.created_at | date:'short' }}</span>
              </div>
              <p class="log-details text-secondary">{{ log.details }}</p>
              <p class="log-ip text-muted">IP address source: {{ log.ip_address }}</p>
            </div>
            <div *ngIf="auditLogs.length === 0" class="text-muted text-center">
              No audit logs captured.
            </div>
          </div>
        </section>

        <!-- Diagnostics Support Tickets -->
        <section class="glass-panel tickets-panel" aria-labelledby="tickets-list-title">
          <h2 id="tickets-list-title" class="title-margin">Trouble Support Tickets</h2>
          <div class="tickets-container">
            <div *ngFor="let tick of tickets" class="ticket-item">
              <div class="ticket-main">
                <h3>{{ tick.title }}</h3>
                <p class="ticket-desc text-secondary">{{ tick.description }}</p>
                
                <!-- Expansion Diagnostic Metadata Array -->
                <div class="ticket-meta">
                  <h4>Diagnostic Metadata Array:</h4>
                  <pre class="meta-json">{{ parseJSON(tick.metadata_json) }}</pre>
                </div>
              </div>
              <span class="ticket-status" [class.status-open]="tick.status === 'open'">{{ tick.status }}</span>
            </div>
            <div *ngIf="tickets.length === 0" class="text-muted text-center">
              No diagnostic tickets filed.
            </div>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [`
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .admin-dashboard-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    @media (min-width: 992px) {
      .admin-dashboard-grid {
        grid-template-columns: 1fr 1fr;
      }
      .tickets-panel {
        grid-column: span 2;
      }
    }
    .title-margin {
      margin-bottom: 16px;
      font-size: 20px;
      border-left: 4px solid var(--accent);
      padding-left: 8px;
    }
    .text-margin {
      margin-bottom: 12px;
      font-size: 14px;
    }
    .users-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .user-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .text-sm {
      font-size: 13px;
    }
    .badges-row {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .role-badge, .status-badge {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-primary);
    }
    .role-badge.badge-admin {
      background: rgba(168, 85, 247, 0.2);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.4);
    }
    .status-badge.badge-active {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.4);
    }
    .status-badge.badge-suspended {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .user-actions {
      display: flex;
      gap: 8px;
    }
    .btn-sm {
      padding: 6px 12px;
      min-height: 38px;
      font-size: 13px;
    }
    .logs-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 500px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .log-entry {
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .log-entry.log-panic {
      border-color: var(--danger);
      background: rgba(239, 68, 68, 0.05);
    }
    .log-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
    }
    .log-type {
      text-transform: uppercase;
      color: var(--primary);
    }
    .log-panic .log-type {
      color: var(--danger);
    }
    .log-time {
      color: var(--text-muted);
    }
    .log-details {
      font-size: 14px;
    }
    .log-ip {
      font-size: 11px;
    }
    .tickets-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .ticket-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .ticket-main {
      flex: 1;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ticket-desc {
      font-size: 15px;
      line-height: 1.5;
    }
    .ticket-meta {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ticket-meta h4 {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: bold;
    }
    .meta-json {
      background: rgba(0, 0, 0, 0.4);
      padding: 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.04);
      color: #38bdf8;
    }
    .ticket-status {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    .ticket-status.status-open {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
  `]
})
export class AdminComponent implements OnInit {
  public users: any[] = [];
  public auditLogs: any[] = [];
  public tickets: any[] = [];

  constructor(private securityService: SecurityService, private router: Router) {}

  ngOnInit() {
    // Role guard: Bounce immediately if user is not admin
    const user = this.securityService.currentUserValue;
    if (!user || user.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadAdminData();
  }

  private loadAdminData() {
    this.securityService.getAdminDashboard().subscribe(
      res => {
        this.users = res.users;
        this.auditLogs = res.auditLogs;
        this.tickets = res.tickets;
      },
      () => {
        alert('Permission credentials failed to verify admin status.');
        this.router.navigate(['/dashboard']);
      }
    );
  }

  public updateUserStatus(userId: number, status: string) {
    this.securityService.updateAdminUser(userId, { status }).subscribe(() => {
      this.loadAdminData();
    });
  }

  public toggleUserRole(userId: number, currentRole: string) {
    const role = currentRole === 'admin' ? 'user' : 'admin';
    this.securityService.updateAdminUser(userId, { role }).subscribe(() => {
      this.loadAdminData();
    });
  }

  public purgeUser(userId: number) {
    if (confirm('CAUTION: Wiping user records will permanently clear details from database registry. Proceed?')) {
      this.securityService.deleteAdminUser(userId).subscribe(() => {
        this.loadAdminData();
      });
    }
  }

  public parseJSON(jsonStr: string): string {
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return jsonStr;
    }
  }

  public goBack() {
    this.router.navigate(['/dashboard']);
  }
}
