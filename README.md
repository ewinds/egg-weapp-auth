# egg-weapp-auth

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/egg-weapp-auth.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-weapp-auth
[travis-image]: https://img.shields.io/travis/eggjs/egg-weapp-auth.svg?style=flat-square
[travis-url]: https://travis-ci.org/eggjs/egg-weapp-auth
[codecov-image]: https://img.shields.io/codecov/c/github/eggjs/egg-weapp-auth.svg?style=flat-square
[codecov-url]: https://codecov.io/github/eggjs/egg-weapp-auth?branch=master
[david-image]: https://img.shields.io/david/eggjs/egg-weapp-auth.svg?style=flat-square
[david-url]: https://david-dm.org/eggjs/egg-weapp-auth
[snyk-image]: https://snyk.io/test/npm/egg-weapp-auth/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/egg-weapp-auth
[download-image]: https://img.shields.io/npm/dm/egg-weapp-auth.svg?style=flat-square
[download-url]: https://npmjs.org/package/egg-weapp-auth

为微信小程序提供授权功能

此插件基于 [wafer2-node-sdk](https://github.com/tencentyun/wafer2-node-sdk) 授权模块

## 安装

```bash
$ npm i egg-weapp-auth --save
```

## 依赖说明

### 依赖的 egg 版本

egg-weapp-auth 版本 | egg 2.x
--- | ---
2.x | 😁
1.x | ❌

### 依赖的插件

- mysql

## 开启插件

```js
// config/plugin.js
exports.weappAuth = {
  enable: true,
  package: 'egg-weapp-auth',
};
```

## 使用指南

### 依赖的表

```sql
DROP TABLE IF EXISTS `csessioninfo`;
CREATE TABLE `csessioninfo` (
  `open_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uuid` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `skey` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_visit_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `session_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_info` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`open_id`),
  KEY `openid` (`open_id`) USING BTREE,
  KEY `skey` (`skey`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话管理用户信息';
```

### 配置

```javascript
// config/config.${env}.js
exports.weappAuth = {
  appId: 'xxxxxxxxxxx',
  appSecret: 'xxxxxxxxxxxxxxxxxx'
};
```

### 使用方式

```javascript
// app/router.js
module.exports = app => {
  const { router, controller } = app
  const authorization = app.middleware.authorization()
  const validation = app.middleware.validation()

  // user
  router.get('/login', authorization, controller.user.login)
  router.get('/user', validation, controller.user.validate)
};

// app/controller/user.js
const Controller = require('egg').Controller

class UserController extends Controller {
  async validate() {
    const { ctx } = this
    if (ctx.state.$wxInfo.loginState === 1) {
      // loginState 为 1，登录态校验成功
      ctx.state.data = ctx.state.$wxInfo.userinfo
    } else {
      ctx.state.code = -1
    }
  }

  async login() {
    const { ctx, app } = this

    if (ctx.state.$wxInfo.loginState) {
      ctx.state.data = ctx.state.$wxInfo.userinfo
      ctx.state.data['time'] = Math.floor(Date.now() / 1000)
    }
  }
}

module.exports = UserController

```

## License

[MIT](LICENSE)
