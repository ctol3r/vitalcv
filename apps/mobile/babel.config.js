module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [require.resolve('expo-router/babel')],
  };
};
