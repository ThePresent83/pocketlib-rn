const { expo } = require('./app.json');

const apiUrl = (process.env.EXPO_PUBLIC_API_URL || expo.extra?.apiUrl || '').trim().replace(/\/+$/, '');

module.exports = () => ({
  ...expo,
  extra: {
    ...(expo.extra || {}),
    ...(apiUrl ? { apiUrl } : {}),
  },
});
