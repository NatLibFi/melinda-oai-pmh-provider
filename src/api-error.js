export default class extends Error {
  constructor({code, verb}, ...params) {
    super(...params);
    this.code = code; // eslint-disable-line functional/no-this-expressions
    this.verb = verb; // eslint-disable-line functional/no-this-expressions
  }
}
