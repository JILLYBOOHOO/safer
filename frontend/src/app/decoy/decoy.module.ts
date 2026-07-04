import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { CalculatorDecoyComponent } from './calculator-decoy/calculator-decoy.component';
import { BibleDecoyComponent } from './bible-decoy/bible-decoy.component';
import { HabitTrackerDecoyComponent } from './habit-tracker-decoy/habit-tracker-decoy.component';
import { DictionaryDecoyComponent } from './dictionary-decoy/dictionary-decoy.component';

const routes: Routes = [
  { path: 'decoy/calculator', component: CalculatorDecoyComponent },
  { path: 'decoy/bible', component: BibleDecoyComponent },
  { path: 'decoy/habit-tracker', component: HabitTrackerDecoyComponent },
  { path: 'decoy/dictionary', component: DictionaryDecoyComponent },
];

@NgModule({
  declarations: [
    CalculatorDecoyComponent,
    BibleDecoyComponent,
    HabitTrackerDecoyComponent,
    DictionaryDecoyComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class DecoyModule {}
