const crypto = require("crypto");

module.exports = {
  sha1(message) {
    return crypto
      .createHash("sha1")
      .update(message, "utf8")
      .digest("hex");
  },
  aesDecrypt(key, iv, crypted) {
    crypted = new Buffer(crypted, "base64");
    key = new Buffer(key, "base64");
    iv = new Buffer(iv, "base64");
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    let decoded = decipher.update(crypted, "base64", "utf8");
    decoded += decipher.final("utf8");
    return decoded;
  }
};
