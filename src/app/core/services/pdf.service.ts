import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Génération de PDF à partir d'un élément HTML (capture html2canvas → jsPDF),
 * format A4 paginé.
 *
 * Deux précautions indispensables sur MOBILE (où l'aperçu est bon mais le PDF
 * exporté divergeait) :
 *  - on attend que les polices web (Cardo, Montserrat) soient réellement
 *    chargées avant la capture, sinon html2canvas fige une police de repli ;
 *  - on plafonne l'échelle pour ne pas dépasser la taille de canvas maximale
 *    des navigateurs mobiles (sinon rendu tronqué / déformé).
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  /** Polices réellement utilisées dans les documents (devis/facture/planning). */
  private readonly usedFonts = [
    '400 16px Cardo',
    '700 16px Cardo',
    '400 16px Montserrat',
    '500 16px Montserrat',
    '700 16px Montserrat',
  ];

  async generate(element: HTMLElement, filename: string): Promise<void> {
    await this.ensureFontsReady();

    const width = element.scrollWidth || element.offsetWidth || 1;
    const height = element.scrollHeight || element.offsetHeight || 1;

    // Neutralise temporairement les `transform: scale(...)` des ancêtres
    // (l'aperçu zoomé l'applique sur mobile, où la place manque). html2canvas
    // calcule mal les positions sous un parent mis à l'échelle : le texte se
    // chevauchait (« 10h0010h30 »). Sur PC l'échelle vaut 1, d'où « ça marche
    // sur PC ».
    const restoreTransforms = this.neutralizeAncestorTransforms(element);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(element, {
        scale: this.safeScale(width, height),
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: width,
        windowHeight: height,
      });
    } finally {
      restoreTransforms();
    }
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

  /**
   * Met à `none` les `transform` de l'élément et de ses ancêtres le temps de la
   * capture, et renvoie une fonction pour les restaurer.
   */
  private neutralizeAncestorTransforms(element: HTMLElement): () => void {
    const saved: Array<{ el: HTMLElement; transform: string }> = [];
    let node: HTMLElement | null = element;
    while (node) {
      if (getComputedStyle(node).transform !== 'none') {
        saved.push({ el: node, transform: node.style.transform });
        node.style.transform = 'none';
      }
      node = node.parentElement;
    }
    return () => {
      for (const { el, transform } of saved) el.style.transform = transform;
    };
  }

  /**
   * Force le chargement des polices web puis attend qu'elles soient prêtes.
   * Sans ça, sur mobile, html2canvas capture une police de repli et le PDF ne
   * ressemble pas à l'aperçu.
   */
  private async ensureFontsReady(): Promise<void> {
    try {
      const fonts = document.fonts;
      if (!fonts) return;
      await Promise.all(this.usedFonts.map((font) => fonts.load(font)));
      await fonts.ready;
    } catch {
      /* API indisponible : on continue, html2canvas fera au mieux */
    }
  }

  /**
   * Échelle de capture maximale qui reste sous les limites de canvas des
   * navigateurs mobiles (dimension max ≈ 8192 px, aire max ≈ 16,7 M px²).
   * Un document A4 d'une page reste à l'échelle 4 (comme sur PC) ; les documents
   * plus longs voient leur échelle réduite juste ce qu'il faut.
   */
  private safeScale(width: number, height: number): number {
    const MAX_SIDE = 8192;
    const MAX_AREA = 15_000_000;
    const scale = Math.min(
      4,
      MAX_SIDE / width,
      MAX_SIDE / height,
      Math.sqrt(MAX_AREA / (width * height)),
    );
    return Math.max(1, scale);
  }
}
