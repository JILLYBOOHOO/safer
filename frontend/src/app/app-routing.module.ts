import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AdminComponent } from './components/admin/admin.component';
import { CalculatorComponent } from './components/calculator/calculator.component';
import { BestieChatComponent } from './components/bestie-chat/bestie-chat.component';
import { ContactFormComponent } from './components/contact-form/contact-form.component';
import { FeatureSuggestionComponent } from './components/feature-suggestion/feature-suggestion.component';
import { FakeCallComponent } from './components/fake-call/fake-call.component';
import { IncidentLogComponent } from './components/incident-log/incident-log.component';
import { LocationManagerComponent } from './components/location-manager/location-manager.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', redirectTo: '/login?tab=signup', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'decoy', loadChildren: () => import('./decoy/decoy.module').then(m => m.DecoyModule) },
  { path: 'calculator', component: CalculatorComponent },
  { path: 'bestie-chat', component: BestieChatComponent },
  { path: 'feature-suggestion', component: FeatureSuggestionComponent },
  { path: 'fake-call', component: FakeCallComponent },
  { path: 'incidents', component: IncidentLogComponent },
  { path: 'locations', component: LocationManagerComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
