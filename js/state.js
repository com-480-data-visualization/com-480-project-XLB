const state = {
  genre: "All",
  decade: "all",
};

const subscribers = new Set();

export function getState() {
  return { ...state };
}

export function setState(update) {
  Object.assign(state, update);
  subscribers.forEach((subscriber) => subscriber(getState()));
}

export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
