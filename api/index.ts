/**
 * Wejście dla Vercela. Cały ruch (/api/*, /healthz i statyki PWA) jedzie przez
 * tę jedną funkcję — dokładnie tak, jak dziś robi to server.js. Rewrite
 * kierujący tu wszystko siedzi w vercel.json.
 *
 * Express 5 app jest funkcją (req, res), więc nadaje się na handler bez adaptera.
 */
import { app } from '../backend/src/app';

export default app;
