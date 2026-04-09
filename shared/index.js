// Load secrets FIRST — unpacks APP_SECRETS into individual env vars
require("./config/loadSecrets");

module.exports = {
  middleware: require("./middleware"),
  utils: require("./utils")
};
