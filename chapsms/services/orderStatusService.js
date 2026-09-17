let listeners = [];

export const orderStatusService = {
  subscribe(callback) {
    listeners.push(callback);

    return () => {
      listeners = listeners.filter((item) => item !== callback);
    };
  },

  emit(order) {
    listeners.forEach((callback) => callback(order));
  },
};