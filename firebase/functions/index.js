const functions = require("firebase-functions");
const request = require("request");
const rp = require("request-promise");
const SHOPIFY_CLIENT_SECRET = functions.config().env.shopify.client.secret;
const SHOPIFY_CLIENT_ID = functions.config().env.shopify.client.id;
const FRONTEND_RESOURCE_URL = functions.config().env.frontend.resource.url;
const TEST_MODE = functions.config().env.test.mode === "true";
const EMULATING = functions.config().env.test.emulate === "true";
const TEST_SHOPS = functions.config().env.test.shops
  ? functions.config().env.test.shops.split(",")
  : [];
const admin = require("firebase-admin");
const app = admin.initializeApp(EMULATING ? {
  projectId: "neatshop-dev",
  databaseURL: "http://localhost:9000/?ns=neatshop-dev"
} : {});
const database = app.database();
const { validateHMAC } = require("./utils")

exports.helloWorld = functions.https.onRequest((req, res) => {
  res.send("Hello from Firebase!");
});

exports.erase = functions.https.onRequest((req, res) => {
  res.send("Thank you");
});

exports.requestData = functions.https.onRequest((req, res) => {
  res.send("Request recieved");
});

exports.oauthCallback = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  const shop = req.query.shop;
  const code = req.query.code;
  const hmac = req.query.hmac

  const url = "https://" + shop + "/admin/oauth/access_token";

  const data = {
    code: code,
    client_id: id,
    client_secret: secret,
  };

  if (!(shop && hmac && code)) return res.redirect(`https://${shop}/admin/apps/${id}/error.html`)
  const hashEquals = validateHMAC({
    reqQuery: req.query,
    hmac,
    apiSecret:SHOPIFY_CLIENT_SECRET,
  });
  if (!hashEquals) return res.redirect(`https://${shop}/admin/apps/${id}/error.html?message=HMAC validation failed`);

  // check firebase, if no shop, create shop
  // if shop no installDate, create intallDate
  // if have both, do nothing

  request.post({ url: url, form: data }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const accessToken = JSON.parse(body)["access_token"];
      res.redirect(
        `https://${shop}/admin/apps/${id}/index.html?access_token=${accessToken}&shop=${shop}`
      );
    }
  });
});

exports.getToken = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  const shop = req.query.shop;
  const code = req.query.code;

  const url = "https://" + shop + "/admin/oauth/access_token";

  const data = {
    code: code,
    client_id: id,
    client_secret: secret,
  };

  request.post({ url: url, form: data }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.send(body);
    }
  });
});

exports.requestAuth = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  if (req.header("Origin") === FRONTEND_RESOURCE_URL) {
    admin
      .auth()
      .createCustomToken(uuidv4())
      .then((customToken) => {
        // Send token back to client
        return res.send({ auth: true, easygeo_token: customToken });
        // and store token in firebase
      })
      .catch((error) => {
        console.log("Error creating custom token:", error);
        return res.send({ auth: false });
      });
  } else {
    return res.send({ auth: false });
  }
});

exports.getResource = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  const shop = req.query.shop;
  const token = req.query.token;
  const resource = req.query.resource;

  const url = "https://" + shop + "/admin/api/2019-07/" + resource + ".json";

  request(
    {
      headers: { "X-Shopify-Access-Token": token },
      uri: url,
      method: "GET",
    },
    (err, resonse, body) => {
      if (!err && resonse.statusCode === 200) {
        res.send(body);
      } else {
        res.send("forbidden");
      }
    }
  );
});
