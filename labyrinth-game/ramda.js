/**
 * This is an integration fix, so that Ramda can be imported in the same way
 * both on server and on browser, and also not trip jslint.
 * Portfolio copy: Ramda 0.32.0 (MIT) is bundled next to the game in ramda.bundle.js,
 * since the site has no node_modules.
 */
import * as R from "./ramda.bundle.js";
export default R;
