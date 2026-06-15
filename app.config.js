const { expo } = require('./app.json');

module.exports = () => ({
  ...expo,
  extra: {
    ...(expo.extra || {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL || expo.extra?.apiUrl,
  },
});
