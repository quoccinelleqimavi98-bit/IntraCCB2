import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Génération de PDF à partir d'un élément HTML (capture html2canvas → jsPDF).
 * Conserve la méthode et les réglages de l'application d'origine (échelle 4,
 * format A4, pagination) pour des documents identiques.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  async generate(element: HTMLElement, filename: string): Promise<void> {
    const canvas = await html2canvas(element, { scale: 4 });
    const imgData = canvas.toDataURL('image/jpeg');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const imgWidth = 210; // A4 en mm
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
  }
}
