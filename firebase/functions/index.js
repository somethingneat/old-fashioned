const functions = require("firebase-functions");
const rp = require("request-promise");
const admin = require("firebase-admin");
const { validateHMAC } = require("./utils");
const SHOPIFY_CLIENT_SECRET = functions.config().env.shopify.client.secret;
const SHOPIFY_CLIENT_ID = functions.config().env.shopify.client.key;
const FRONTEND_RESOURCE_URL = functions.config().env.frontend.resource.url;
const TEST_MODE = functions.config().env.test.mode === "true";
const TEST_SHOPS = functions.config().env.test.shops
  ? functions.config().env.test.shops.split(",")
  : [];
const EMULATING = functions.config().env.test.emulate === "true";
const app = admin.initializeApp(
  EMULATING
    ? {
        projectId: "old-fashioned-boilerplate",
        databaseURL: "http://localhost:9000/?ns=old-fashioned-boilerplate",
      }
    : {}
);
const database = app.database();

exports.helloWorld = functions.https.onRequest((req, res) => {
  res.send("Hello from Firebase!");
});

exports.erase = functions.https.onRequest((req, res) => {
  // GDPR mandatory webhooks
  res.send("Thank you");
});

exports.requestData = functions.https.onRequest((req, res) => {
  // GDPR mandatory webhooks
  res.send("Request recieved");
});

exports.oauthCallback = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  const shop = req.query.shop;
  const code = req.query.code;
  const hmac = req.query.hmac;
  if (!(shop && hmac && code))
    return res.redirect(
      `https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}/error.html`
    );

  const hashEquals = validateHMAC({
    reqQuery: req.query,
    hmac,
    apiSecret: SHOPIFY_CLIENT_SECRET,
  });
  if (!hashEquals)
    return res.redirect(
      `https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}/error.html?message=HMAC validation failed`
    );

  return rp
    .post({
      uri: `https://${shop}/admin/oauth/access_token`,
      form: {
        code: code,
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      },
      transform: JSON.parse,
    })
    .then((body) => {
      const accessToken = body["access_token"];
      if (!accessToken)
        return res.redirect(
          `https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}/error.html`
        );
      return database
        .ref(`${shop.split(".myshopify.com")[0]}`)
        .once("value")
        .then((snap) => {
          const shopInDb = snap.val();
          if (!shopInDb)
            return database.ref(`${shop.split(".myshopify.com")[0]}`).set({
              installDate: Date.now(),
              accessToken,
            });
          else
            return database
              .ref(`${shop.split(".myshopify.com")[0]}`)
              .child("accessToken")
              .set(accessToken);
        })
        .then(() =>
          res.redirect(
            `https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}` +
              `/index.html?access_token=${accessToken}&shop=${shop}`
          )
        );
    })
    .catch((err) => {
      return res.redirect(
        `https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}/error.html`
      );
    });
});

exports.getResource = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  const shop = req.query.shop;
  const token = req.query.token;
  const resource = req.query.resource;

  return rp({
    uri: `https://${shop}/admin/api/2019-07/${resource}.json`,
    headers: { "X-Shopify-Access-Token": token },
    method: "GET",
    json: true,
  })
    .then((body) => res.send(body))
    .catch((err) => {
      return res.sendStatus((err && err.statusCode) || 500);
    });
});
