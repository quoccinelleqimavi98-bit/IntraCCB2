import { Pipe, PipeTransform } from '@angular/core';

import { frenchLongDate } from '../../core/utils/date.utils';

/** Formate « jj/mm/aaaa » en toutes lettres : « Jeudi 12 Juin 2026 ». */
@Pipe({ name: 'frenchDate' })
export class FrenchDatePipe implements PipeTransform {
  transform(value: string | undefined | null): string {
    return frenchLongDate(value);
  }
}
