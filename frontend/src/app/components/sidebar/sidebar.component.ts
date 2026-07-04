import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { SecurityService, User } from '../../services/security.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  constructor(
    public themeService: ThemeService,
    public securityService: SecurityService,
    private router: Router
  ) {}

  onThemeChange(theme: string) {
    this.themeService.setTheme(theme as 'light' | 'dark');
  }

  get user(): User | null {
    return this.securityService.currentUserValue;
  }

  get isAdmin(): boolean {
    return this.securityService.isAdmin();
  }

  get isLoginRoute(): boolean {
    return this.router.url.startsWith('/login') || this.router.url === '/' || this.router.url === '/calculator';
  }

  logout() {
    this.securityService.signOut();
    this.router.navigate(['/login']);
  }
}
