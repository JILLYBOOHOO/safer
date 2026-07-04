export interface MedicalCard {
  name: string;
  dateOfBirth: string; // ISO format
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyContacts: { name: string; phone: string }[];
  doctor: { name: string; phone: string; address?: string };
}
