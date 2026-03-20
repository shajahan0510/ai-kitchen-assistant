console.log('Starting diag_server');
process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
});
require('./backend/server.js');
console.log('Finished require');
