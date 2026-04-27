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
  webhookUrl: '',
  dashboardJsonUrl: '',
  version: '0.1.0',
};
