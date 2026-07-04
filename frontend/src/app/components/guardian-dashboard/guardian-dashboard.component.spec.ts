import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuardianDashboardComponent } from './guardian-dashboard.component';

describe('GuardianDashboardComponent', () => {
  let component: GuardianDashboardComponent;
  let fixture: ComponentFixture<GuardianDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GuardianDashboardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GuardianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
