const crypto = require("crypto");
const querystring = require("querystring");

const validateHMAC = ({ reqQuery, hmac, apiSecret }) => {
  const map = Object.assign({}, reqQuery);
  delete map["hmac"];
  const message = querystring.stringify(map);
  const providedHmac = Buffer.from(hmac, "utf-8");
  const generatedHash = Buffer.from(
    crypto
      .createHmac("sha256", apiSecret)
      .update(message)
      .digest("hex"),
    "utf-8"
  );

  let hashEquals = false;
  try {
    hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
  } catch (e) {
    hashEquals = false;
  }

  return hashEquals;
};

module.exports = {
  validateHMAC
};
