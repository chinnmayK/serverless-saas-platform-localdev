const registry = {};

function registerBreaker(name, breaker) {
  registry[name] = breaker;
}

function getAllBreakers() {
  return registry;
}

module.exports = { registerBreaker, getAllBreakers };
