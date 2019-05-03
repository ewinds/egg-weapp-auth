"use strict";

const assert = require("assert");

module.exports = app => {
  const { config } = app;
  assert(
    config.weappAuth.appId && config.weappAuth.appSecret,
    `[egg-weapp-auth] 'appId: ${config.weappAuth.appId}', 'appSecret: ${
      config.weappAuth.appSecret
    }' are required on config`
  );

  app.coreLogger.info(`[egg-weapp-auth] is ready`);
};
