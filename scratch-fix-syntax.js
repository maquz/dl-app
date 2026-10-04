const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');
code = code.replace(`        </div>\r\n      </main>\r\n    </div>\r\n\r\n      {/* Glassmorphism Popup`, `        </div>\r\n      </main>\r\n\r\n      {/* Glassmorphism Popup`);
fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
