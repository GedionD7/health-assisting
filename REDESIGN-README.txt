HEALTH ASSISTING — REDESIGNED PROJECT

IMPORTANT: Use this extracted project folder, not the older health-assisting-master folder you were running before. This package includes front end/css/app-redesign.css and links it from the existing HTML pages while retaining the original page scripts and backend files.

RUN ON WINDOWS / WEBSTORM
1. Extract this ZIP completely.
2. Open the extracted health-assisting-master folder in WebStorm.
3. Start the backend from the project root in one terminal:
   node server.mjs
   Keep that terminal running. Use your existing database configuration.
4. In a second terminal, start the frontend:
   cd "front end"
   npm install
   npm start
5. Open the login page at http://localhost:8081/ (if the dev server prints a different port, use the printed URL).
6. After login, test patient selection and each form. Do not enter real patient data until security and authentication have been reviewed.

TROUBLESHOOTING
- Do not use Live Server on port 8080 for this project; it can serve a different/older folder.
- If the browser shows a directory listing, check that you opened the URL printed by `npm start` and that you opened the extracted project folder from this ZIP.
- This is a visual redesign, not a security audit. Test login, signup, patient selection, form submission, and database behavior before relying on it.
