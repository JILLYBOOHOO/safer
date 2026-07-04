import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ServiceWorkerModule } from '@angular/service-worker';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AdminComponent } from './components/admin/admin.component';
import { CalculatorComponent } from './components/calculator/calculator.component';
import { PatternLockComponent } from './components/pattern-lock/pattern-lock.component';
import { ContactFormComponent } from './components/contact-form/contact-form.component';
import { BestieChatComponent } from './components/bestie-chat/bestie-chat.component';
import { AlertComponent } from './components/alert/alert.component';
import { FeatureSuggestionComponent } from './components/feature-suggestion/feature-suggestion.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FakeCallComponent } from './components/fake-call/fake-call.component';
import { IncidentLogComponent } from './components/incident-log/incident-log.component';
import { LocationManagerComponent } from './components/location-manager/location-manager.component';
import { GuardianDashboardComponent } from './components/guardian-dashboard/guardian-dashboard.component';
import { RiskForecastComponent } from './components/risk-forecast/risk-forecast.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    AdminComponent,
    CalculatorComponent,
    PatternLockComponent,
    AlertComponent,
    ContactFormComponent,
    BestieChatComponent,
    FeatureSuggestionComponent,
    SidebarComponent,
    FakeCallComponent,
    IncidentLogComponent,
    LocationManagerComponent,
    GuardianDashboardComponent,
    RiskForecastComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
