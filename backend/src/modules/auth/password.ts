import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';

/**
 * Siła hasła menedżera. Konta klubów obracają cudzymi pieniędzmi, więc w
 * odróżnieniu od niskotarciowych kont graczy (login + 3 znaki) wymagamy
 * zxcvbn ≥ 3 — czyli „silne", odporne na offline'owy atak słownikowy.
 *
 * Nie narzucamy wielkich liter ani znaków specjalnych: zxcvbn i tak wyżej
 * ocenia długą frazę niż „Haslo1!", a wymuszanie wzorców pcha ludzi w hasła
 * przewidywalne.
 */
const zxcvbn = new ZxcvbnFactory({
  dictionary: { ...common.dictionary },
  graphs: common.adjacencyGraphs,
});

export const MIN_SCORE = 3;

/** userInputs (e-mail, nazwa klubu) obniżają ocenę haseł zbudowanych z tych danych. */
export function passwordScore(password: string, userInputs: string[] = []): number {
  return zxcvbn.check(password, userInputs).score;
}
