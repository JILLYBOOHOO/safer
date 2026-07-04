import { Component, OnInit, OnDestroy } from '@angular/core';
import { GeofenceService } from '../../services/geofence.service';

/**
 * Arriving Home dashboard – displayed when the geofence fires after dark.
 * It shows a brief status and offers quick actions (e.g., open yard check).
 */
@Component({
  selector: 'app-arriving-home',
  templateUrl: './arriving-home.component.html',
  styleUrls: ['./arriving-home.component.css']
})
export class ArrivingHomeComponent implements OnInit, OnDestroy {
  constructor(private geofence: GeofenceService) {}

  ngOnInit(): void {
    // Start location watch when user is on the Home view
    this.geofence.startWatch();
  }

  ngOnDestroy(): void {
    // Stop to save battery when leaving the view
    this.geofence.stopWatch();
  }
}
