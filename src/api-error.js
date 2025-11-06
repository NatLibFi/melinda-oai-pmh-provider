export default class extends Error {
  constructor({code, verb}, ...params) {
    super(...params);
    this.code = code;
    this.verb = verb;
  }
}
