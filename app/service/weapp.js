const uuidGenerator = require("uuid/v4");
const Service = require("egg").Service;
const ERRORS = {
  // 授权模板错误
  ERR_HEADER_MISSED: "ERR_HEADER_MISSED",
  ERR_GET_SESSION_KEY: "ERR_GET_SESSION_KEY",
  ERR_IN_DECRYPT_DATA: "ERR_IN_DECRYPT_DATA",
  ERR_SKEY_INVALID: "ERR_SKEY_INVALID",

  // 数据库错误
  DBERR: {
    ERR_WHEN_INSERT_TO_DB: "ERR_WHEN_INSERT_TO_DB",
    ERR_NO_SKEY_ON_CALL_GETUSERINFOFUNCTION:
      "ERR_NO_SKEY_ON_CALL_GETUSERINFOFUNCTION",
    ERR_NO_OPENID_ON_CALL_GETUSERINFOFUNCTION:
      "ERR_NO_OPENID_ON_CALL_GETUSERINFOFUNCTION"
  }
};
const LOGIN_STATE = {
  SUCCESS: 1, // 登陆成功
  FAILED: 0 // 登录失败
};

class WeappService extends Service {
  /**
   * 授权模块
   * @return {Object} 授权结果
   */
  async authorize() {
    const { ctx, app } = this;
    const {
      "x-wx-code": code,
      "x-wx-encrypted-data": encryptedData,
      "x-wx-iv": iv
    } = ctx.request.headers;

    // 检查 headers
    if ([code, encryptedData, iv].every(v => !v)) {
      app.logger.debug(ERRORS.ERR_HEADER_MISSED);
      throw new Error(ERRORS.ERR_HEADER_MISSED);
    }

    app.logger.debug("Auth: code: %s", code);

    // 如果只有 code 视为仅使用 code 登录
    if (code && !encryptedData && !iv) {
      const pkg = await ctx.service.weapp.getSessionKey(code);
      const { openid, session_key } = pkg;
      // 生成 3rd_session
      const skey = ctx.helper.sha1(session_key);

      const res = await ctx.service.weapp.getUserInfoByOpenId(openid);
      const wxUserInfo = JSON.parse(res.user_info);
      const saved = await ctx.service.weapp.saveUserInfo(
        wxUserInfo,
        skey,
        session_key
      );

      return {
        loginState: LOGIN_STATE.SUCCESS,
        userinfo: {
          userinfo: wxUserInfo,
          skey: saved.skey
        }
      };
    } else {
      app.logger.debug("Auth: encryptedData: %s, iv: %s", encryptedData, iv);

      // 获取 session key
      const pkg = await ctx.service.weapp.getSessionKey(code);
      const { session_key } = pkg;
      // 生成 3rd_session
      const skey = ctx.helper.sha1(session_key);

      // 解密数据
      let decryptedData;
      try {
        decryptedData = ctx.helper.aesDecrypt(session_key, iv, encryptedData);
        decryptedData = JSON.parse(decryptedData);
      } catch (e) {
        app.logger.debug("Auth: %s: %o", ERRORS.ERR_IN_DECRYPT_DATA, e);
        throw new Error(`${ERRORS.ERR_IN_DECRYPT_DATA}\n${e}`);
      }

      // 存储到数据库中
      const userinfo = await ctx.service.weapp.saveUserInfo(
        decryptedData,
        skey,
        session_key
      );

      return {
        loginState: LOGIN_STATE.SUCCESS,
        userinfo
      };
    }
  }
  /**
   * 鉴权模块
   * @return {Promise}
   */
  async validate() {
    const { ctx, app } = this;
    const { "x-wx-skey": skey } = ctx.request.headers;
    if (!skey) throw new Error(ERRORS.ERR_SKEY_INVALID);

    app.logger.debug("Valid: skey: %s", skey);
    const res = await ctx.service.weapp.getUserInfoBySKey(skey);

    if (!res) {
      throw new Error(ERRORS.ERR_SKEY_INVALID);
    }

    // 效验登录态是否过期
    const { last_visit_time: lastVisitTime, user_info: userInfo } = res;
    const expires = 7200 * 1000;

    if (new Date(lastVisitTime).getTime() + expires < Date.now()) {
      app.logger.debug("Valid: skey expired, login failed.");
      return {
        loginState: LOGIN_STATE.FAILED,
        userinfo: {}
      };
    } else {
      app.logger.debug("Valid: login success.");
      return {
        loginState: LOGIN_STATE.SUCCESS,
        userinfo: JSON.parse(userInfo)
      };
    }
  }
  async getSessionKey(code) {
    const { ctx, app } = this;
    const appid = app.config.weappAuth.appId;
    const appsecret = app.config.weappAuth.appSecret;

    const res = await ctx.curl(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${appsecret}&js_code=${code}&grant_type=authorization_code`,
      {
        dataType: "json"
      }
    );

    const data = res.data;
    if (data.errcode || !data.openid || !data.session_key) {
      app.logger.debug("%s: %O", ERRORS.ERR_GET_SESSION_KEY, data.errmsg);
      throw new Error(`${ERRORS.ERR_GET_SESSION_KEY}\n${JSON.stringify(data)}`);
    } else {
      app.logger.debug(
        "openid: %s, session_key: %s",
        data.openid,
        data.session_key
      );
      return data;
    }
  }
  /**
   * 通过 openid 获取用户信息
   * @param {string} openid 用户的 openid
   */
  async getUserInfoByOpenId(openId) {
    const { ctx, app } = this;

    if (!openId)
      throw new Error(ERRORS.DBERR.ERR_NO_OPENID_ON_CALL_GETUSERINFOFUNCTION);

    return await app.mysql.get("cSessionInfo", { open_id: openId });
  }
  /**
   * 通过 skey 获取用户信息
   * @param {string} skey 登录时颁发的 skey 为登录态标识
   */
  async getUserInfoBySKey(skey) {
    const { ctx, app } = this;

    if (!skey)
      throw new Error(ERRORS.DBERR.ERR_NO_SKEY_ON_CALL_GETUSERINFOFUNCTION);

    return await app.mysql.get("cSessionInfo", { skey });
  }
  /**
   * 储存用户信息
   * @param {object} userInfo
   * @param {string} sessionKey
   */
  async saveUserInfo(userInfo, skey, session_key) {
    const { ctx, app } = this;
    const uuid = uuidGenerator();
    const open_id = userInfo.openId;
    const user_info = JSON.stringify(userInfo);

    try {
      // 查重并决定是插入还是更新数据
      const hasUser = await app.mysql.count("cSessionInfo", { open_id });

      // 如果存在用户则更新
      if (hasUser) {
        const row = {
          skey,
          last_visit_time: app.mysql.literals.now,
          session_key,
          user_info
        };
        await app.mysql.update("cSessionInfo", row, { where: { open_id } });
      } else {
        const row = {
          uuid,
          skey,
          create_time: app.mysql.literals.now,
          last_visit_time: app.mysql.literals.now,
          open_id,
          session_key,
          user_info
        };
        await app.mysql.insert("cSessionInfo", row);
      }

      return {
        userinfo: userInfo,
        skey: skey
      };
    } catch (e) {
      app.logger.debug("%s: %O", ERRORS.DBERR.ERR_WHEN_INSERT_TO_DB, e);
      throw new Error(`${ERRORS.DBERR.ERR_WHEN_INSERT_TO_DB}\n${e}`);
    }
  }
}

module.exports = WeappService;
