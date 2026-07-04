import { Component } from '@angular/core';
import { DecoyService } from '../../services/decoy.service';

@Component({
  selector: 'app-calculator-decoy',
  templateUrl: './calculator-decoy.component.html',
  styleUrls: ['./calculator-decoy.component.scss']
})
export class CalculatorDecoyComponent {
  constructor(private decoyService: DecoyService) {}

  // Placeholder UI logic
}
