// Lets admin handlers clear the customer catalogue cache without a circular require.
let bustFn = () => {};

module.exports = {
  register(fn) {
    bustFn = fn;
  },
  bust() {
    bustFn();
  },
};
