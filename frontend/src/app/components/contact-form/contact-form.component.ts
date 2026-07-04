import { Component } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.component.html',
  styleUrls: ['./contact-form.component.css']
})
export class ContactFormComponent {
  subject = '';
  message = '';
  file: File | null = null;
  uploadProgress = 0;
  statusMessage = '';

  constructor(private http: HttpClient) {}

  onFileSelected(event: any) {
    const selected = event.target.files[0];
    if (selected) {
      this.file = selected;
    }
  }

  submit() {
    if (!this.subject || !this.message) {
      this.statusMessage = 'Subject and message are required.';
      return;
    }
    const formData = new FormData();
    formData.append('subject', this.subject);
    formData.append('description', this.message);
    if (this.file) {
      formData.append('attachment', this.file, this.file.name);
    }

    this.http.post<any>('/api/user/ticket', formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe((event: HttpEvent<any>) => {
      if (event.type === HttpEventType.UploadProgress && event.total) {
        this.uploadProgress = Math.round(100 * event.loaded / event.total);
      } else if (event.type === HttpEventType.Response) {
        this.statusMessage = 'Ticket submitted successfully.';
        this.uploadProgress = 0;
        this.subject = '';
        this.message = '';
        this.file = null;
      }
    }, err => {
      this.statusMessage = 'Error submitting ticket.';
    });
  }
}
