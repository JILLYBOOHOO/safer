import { Component } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-feature-suggestion',
  templateUrl: './feature-suggestion.component.html',
  styleUrls: ['./feature-suggestion.component.css']
})
export class FeatureSuggestionComponent {
  title = '';
  description = '';
  file: File | null = null;
  uploadProgress = 0;
  statusMessage = '';

  constructor(private http: HttpClient) {}

  onFileSelected(event: any) {
    const selected = event.target.files[0];
    if (selected) this.file = selected;
  }

  submit() {
    if (!this.title || !this.description) {
      this.statusMessage = 'Title and description are required.';
      return;
    }
    const formData = new FormData();
    formData.append('subject', this.title);
    formData.append('description', this.description);
    formData.append('type', 'feature'); // custom field to differentiate
    if (this.file) {
      formData.append('attachment', this.file, this.file.name);
    }
    this.http.post<any>('/api/user/ticket', formData, { reportProgress: true, observe: 'events' })
      .subscribe((event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.statusMessage = 'Feature suggestion submitted.';
          this.reset();
        }
      }, err => this.statusMessage = 'Error submitting suggestion.');
  }

  private reset() {
    this.title = '';
    this.description = '';
    this.file = null;
    this.uploadProgress = 0;
  }
}
