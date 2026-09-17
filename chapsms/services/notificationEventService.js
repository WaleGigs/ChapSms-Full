let listeners = [];

export const notificationEventService = {
  subscribe(callback) {
    listeners.push(callback);

    return () => {
      listeners = listeners.filter((listener) => listener !== callback);
    };
  },

  emit(notification) {
    listeners.forEach((listener) => listener(notification));
  },
};