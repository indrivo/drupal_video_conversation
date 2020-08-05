const fs = require("fs");
var credentials = {};

if (fs.existsSync("cert/key.pem") && fs.existsSync("cert/cert.pem")) {
  credentials.key = fs.readFileSync("cert/key.pem"),
  credentials.cert = fs.readFileSync("cert/cert.pem");
}

module.exports = credentials;
