require('dotenv').config();
const app = require('./src/app');
const listEndpoints = (expressApp) => {
  const endpoints = [];
  const stack = expressApp._router.stack;

  const getPath = (middleware, parentPath = '') => {
    if (middleware.route) {
      endpoints.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${parentPath}${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      const newParent = parentPath + (middleware.regexp.source.replace('\\/?(?=\\/|$)', '').replace('^', '').replace('\\/', '/').replace('\\', ''));
      middleware.handle.stack.forEach(handler => getPath(handler, newParent));
    }
  };

  stack.forEach(middleware => getPath(middleware));
  return endpoints;
};

console.log('--- REGISTERED BACKEND ROUTES ---');
console.log(listEndpoints(app).join('\n'));
console.log('---------------------------------');

console.log('\n--- GMAIL CONFIG CHECK ---');
console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`GOOGLE_REDIRECT_URI (from .env): ${process.env.GOOGLE_REDIRECT_URI}`);
console.log('---------------------------');
