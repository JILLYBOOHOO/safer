import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MedicalCardService } from '../../services/medical-card.service';

@Component({
  selector: 'app-medical-card',
  templateUrl: './medical-card.component.html',
  styleUrls: ['./medical-card.component.scss']
})
export class MedicalCardComponent implements OnInit {
  medicalForm: FormGroup;
  loading = false;
  saved = false;

  constructor(private fb: FormBuilder, private mcService: MedicalCardService) {
    this.medicalForm = this.fb.group({
      allergies: [''],
      conditions: [''],
      bloodType: [''],
      doctor: [''],
      medications: [''],
      emergencyContacts: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData() {
    const data = this.mcService.getCard();
    if (data) {
      this.medicalForm.patchValue(data);
    }
  }

  onSubmit() {
    if (this.medicalForm.invalid) return;
    this.loading = true;
    this.mcService.saveCard(this.medicalForm.value);
    this.loading = false;
    this.saved = true;
    setTimeout(() => this.saved = false, 3000);
  }
}
