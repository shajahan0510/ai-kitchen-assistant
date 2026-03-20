try {
    console.log("Loading app...");
    require('dotenv').config();
    const app = require('./backend/app.js');
    console.log("App loaded successfully.");
} catch (e) {
    console.error("CRASH DETECTED:");
    console.error(e);
}
