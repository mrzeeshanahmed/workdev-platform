export const notImplemented = (feature: string): never => {
  throw new Error(`${feature} is not implemented yet.`);
};
