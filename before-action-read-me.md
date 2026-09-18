# 🛑 CRITICAL: READ BEFORE EDITING 🛑
* **Repository:** [https://github.com/Indranilsaha7/backend-bcs-pos](https://github.com/Indranilsaha7/backend-bcs-pos)
## 1. System Architecture
* **Environment:** Cloudflare Pages Functions (Serverless).
* **Database:** Cloudflare D1 (Relational SQLite). 
* **Rule:** WE DO NOT USE FIREBASE ANYMORE. Do NOT write or suggest any Firebase SDK code.
* **Routing:** All API endpoints exist inside the `./functions/api/` folder.
* **backend url:** https://backend.bcs.bcsdeveloper.com
## 2. Security & Authentication Strict Rules
* **API Key Protection:** Every single endpoint MUST verify the `x-api-key` header.
* **The Master API Key is:** `backend-bcs-pos`
* If `request.headers.get('x-api-key') !== context.env.API_KEY`, immediately return a `401 Unauthorized` JSON response.
* **Never hardcode secrets in production code.** Always use `context.env.VARIABLE_NAME`.

## 3. Database Execution Standards
* ALWAYS use Prepared Statements with `.bind()` to prevent SQL injection.
* Example: `await context.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();`

## 4. AI Agent Directives
* DO NOT print code blocks, explanations, or step-by-step guides in the chat.
* TAKE ACTION DIRECTLY: Write code directly into the workspace files.
* Keep the code modular, clean, and follow the existing file structure.
