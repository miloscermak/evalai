/* EvalAI config — single source of truth pro frontend
 *
 * webhookUrl: URL Google Apps Script webhooku (web app deployment).
 *   Pokud je prázdný, frontend běží v DEV módu — payload jde do console
 *   místo na server. Užitečné pro lokální testování.
 *
 * dashboardJsonUrl: URL Apps Script GET endpointu, který vrací JSON
 *   s body všech účastníků (filtruje se podle workshop_id v URL).
 */

window.EVALAI_CONFIG = {
  webhookUrl: 'https://script.google.com/macros/s/AKfycbxdnG9EIWRwf8mPPAXZPxmb6IQU_O2spp0wQyPQwfS8ae0KQPUC3qX38ARiHer8sBSGHw/exec',
  dashboardJsonUrl: 'https://script.google.com/macros/s/AKfycbxdnG9EIWRwf8mPPAXZPxmb6IQU_O2spp0wQyPQwfS8ae0KQPUC3qX38ARiHer8sBSGHw/exec',
  version: '0.1.0',
};
